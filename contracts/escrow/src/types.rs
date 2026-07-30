use soroban_sdk::{contracttype, Address, String};

#[contracttype]
pub enum DataKey {
    Admin,
    Arbitrator,
    FeeAddress,
    FeeBps,
    EscrowCount,
    Escrow(u64),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracttype]
pub enum EscrowStatus {
    Funded,
    Disputed,
    Released,
    Refunded,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Escrow {
    pub buyer: Address,
    pub seller: Address,
    pub token: Address,
    pub amount: i128,
    pub domain_ref: String,
    pub status: EscrowStatus,
    pub created_ledger: u32,
}
