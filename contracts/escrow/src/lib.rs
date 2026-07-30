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

        events::escrow_created(&env, escrow_id, &buyer, &seller, amount, &domain_ref);

        Ok(escrow_id)
    }
}
