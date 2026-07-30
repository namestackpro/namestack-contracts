#![allow(deprecated)]

use soroban_sdk::{Address, Env, String};

use crate::types::EscrowStatus;

pub fn escrow_created(env: &Env, escrow_id: u64, buyer: &Address, seller: &Address, amount: i128, domain_ref: &String) {
    env.events().publish(
        ("escrow_created",),
        (escrow_id, buyer, seller, amount, domain_ref),
    );
}

pub fn escrow_released(env: &Env, escrow_id: u64, seller: &Address, amount_paid: i128, fee_amount: i128) {
    env.events().publish(
        ("escrow_released",),
        (escrow_id, seller, amount_paid, fee_amount),
    );
}

pub fn escrow_refunded(env: &Env, escrow_id: u64, buyer: &Address, amount: i128) {
    env.events().publish(
        ("escrow_refunded",),
        (escrow_id, buyer, amount),
    );
}

pub fn dispute_raised(env: &Env, escrow_id: u64, caller: &Address) {
    env.events().publish(
        ("dispute_raised",),
        (escrow_id, caller),
    );
}

pub fn dispute_resolved(env: &Env, escrow_id: u64, release_to: &Address, resulting_status: EscrowStatus) {
    env.events().publish(
        ("dispute_resolved",),
        (escrow_id, release_to, resulting_status),
    );
}
