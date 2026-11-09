#![no_std]

pub(crate) mod errors;
pub(crate) mod events;
pub(crate) mod types;

#[cfg(test)]
mod test;

use errors::Error;
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use types::{DataKey, Escrow, EscrowStatus};

const TTL_THRESHOLD: u32 = 86400;
const TTL_EXTEND_TO: u32 = 518400;
const MAX_FEE_BPS: u32 = 10_000;

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        arbitrator: Address,
        fee_address: Address,
        fee_bps: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFee);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Arbitrator, &arbitrator);
        env.storage()
            .instance()
            .set(&DataKey::FeeAddress, &fee_address);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::EscrowCount, &0u64);
        Self::bump_instance(&env);

        Ok(())
    }

    pub fn create_escrow(
        env: Env,
        buyer: Address,
        seller: Address,
        token: Address,
        amount: i128,
        domain_ref: String,
    ) -> Result<u64, Error> {
        buyer.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if buyer == seller {
            return Err(Error::InvalidParties);
        }

        let mut escrow_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowCount)
            .unwrap_or(0);
        escrow_count += 1;
        let escrow_id = escrow_count;

        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        let escrow = Escrow {
            buyer: buyer.clone(),
            seller: seller.clone(),
            token,
            amount,
            domain_ref: domain_ref.clone(),
            status: EscrowStatus::Funded,
            created_ledger: env.ledger().sequence(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(escrow_id), TTL_THRESHOLD, TTL_EXTEND_TO);

        env.storage()
            .instance()
            .set(&DataKey::EscrowCount, &escrow_id);
        Self::bump_instance(&env);

        events::escrow_created(&env, escrow_id, &buyer, &seller, amount, &domain_ref);

        Ok(escrow_id)
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<Escrow, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(Error::EscrowNotFound)
    }

    pub fn confirm_receipt(env: Env, escrow_id: u64) -> Result<(), Error> {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(Error::EscrowNotFound)?;

        escrow.buyer.require_auth();

        if escrow.status != EscrowStatus::Funded {
            return Err(Error::InvalidStatus);
        }

        Self::release_to_seller(&env, escrow_id, &mut escrow)?;

        Ok(())
    }

    pub fn raise_dispute(env: Env, escrow_id: u64, caller: Address) -> Result<(), Error> {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(Error::EscrowNotFound)?;

        caller.require_auth();

        if caller != escrow.buyer && caller != escrow.seller {
            return Err(Error::Unauthorized);
        }

        if escrow.status != EscrowStatus::Funded {
            return Err(Error::InvalidStatus);
        }

        escrow.status = EscrowStatus::Disputed;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(escrow_id), TTL_THRESHOLD, TTL_EXTEND_TO);

        events::dispute_raised(&env, escrow_id, &caller);

        Ok(())
    }

    pub fn resolve_dispute(env: Env, escrow_id: u64, release_to: Address) -> Result<(), Error> {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .ok_or(Error::EscrowNotFound)?;

        let arbitrator: Address = env
            .storage()
            .instance()
            .get(&DataKey::Arbitrator)
            .ok_or(Error::NotInitialized)?;
        arbitrator.require_auth();

        if escrow.status != EscrowStatus::Disputed {
            return Err(Error::InvalidStatus);
        }

        if release_to != escrow.buyer && release_to != escrow.seller {
            return Err(Error::InvalidReleaseTarget);
        }

        if release_to == escrow.seller {
            Self::release_to_seller(&env, escrow_id, &mut escrow)?;
            events::dispute_resolved(&env, escrow_id, &release_to, EscrowStatus::Released);
        } else {
            let token_client = TokenClient::new(&env, &escrow.token);
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.buyer,
                &escrow.amount,
            );

            escrow.status = EscrowStatus::Refunded;
            env.storage()
                .persistent()
                .set(&DataKey::Escrow(escrow_id), &escrow);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::Escrow(escrow_id), TTL_THRESHOLD, TTL_EXTEND_TO);

            events::escrow_refunded(&env, escrow_id, &escrow.buyer, escrow.amount);
            events::dispute_resolved(&env, escrow_id, &release_to, EscrowStatus::Refunded);
        }

        Ok(())
    }

    pub fn set_fee(env: Env, fee_bps: u32, fee_address: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFee);
        }

        env.storage()
            .instance()
            .set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeAddress, &fee_address);
        Self::bump_instance(&env);

        Ok(())
    }

    pub fn set_arbitrator(env: Env, new_arbitrator: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::Arbitrator, &new_arbitrator);
        Self::bump_instance(&env);

        Ok(())
    }

    /// Pays the seller (minus the platform fee) and marks the escrow Released.
    fn release_to_seller(env: &Env, escrow_id: u64, escrow: &mut Escrow) -> Result<(), Error> {
        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::FeeBps)
            .unwrap_or(0);
        let fee_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeAddress)
            .ok_or(Error::NotInitialized)?;

        let fee_amount = Self::amount_to_fee(escrow.amount, fee_bps)?;
        let seller_amount = escrow
            .amount
            .checked_sub(fee_amount)
            .ok_or(Error::Overflow)?;

        let token_client = TokenClient::new(env, &escrow.token);
        let contract = env.current_contract_address();
        if fee_amount > 0 {
            token_client.transfer(&contract, &fee_address, &fee_amount);
        }
        token_client.transfer(&contract, &escrow.seller, &seller_amount);

        escrow.status = EscrowStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(escrow_id), TTL_THRESHOLD, TTL_EXTEND_TO);
        Self::bump_instance(env);

        events::escrow_released(env, escrow_id, &escrow.seller, seller_amount, fee_amount);
        Ok(())
    }

    /// Keeps contract config (admin, fee, counter) from expiring.
    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    fn amount_to_fee(amount: i128, fee_bps: u32) -> Result<i128, Error> {
        amount
            .checked_mul(fee_bps as i128)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(Error::Overflow)
    }
}
