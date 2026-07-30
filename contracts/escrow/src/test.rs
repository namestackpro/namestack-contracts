#![cfg(test)]
#![allow(deprecated)]

use crate::{EscrowContract, EscrowContractClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

#[test]
fn test_initialize_happy() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let fee_address = Address::generate(&env);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    client.initialize(&admin, &arbitrator, &fee_address, &250);
}

#[test]
fn test_initialize_double_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let fee_address = Address::generate(&env);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    client.initialize(&admin, &arbitrator, &fee_address, &250);
    let result = client.try_initialize(&admin, &arbitrator, &fee_address, &250);
    assert!(result.is_err());
}

#[test]
fn test_initialize_no_auth_fails() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let fee_address = Address::generate(&env);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let result = client.try_initialize(&admin, &arbitrator, &fee_address, &250);
    assert!(result.is_err());
}
