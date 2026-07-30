#![cfg(test)]
#![allow(deprecated)]

use crate::{EscrowContract, EscrowContractClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env, String};

fn setup_test() -> (Env, Address, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let fee_address = Address::generate(&env);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    client.initialize(&admin, &arbitrator, &fee_address, &250);

    (env, contract_id, admin, arbitrator, buyer, seller, fee_address)
}

fn create_token(env: &Env, admin: &Address) -> Address {
    let token = env.register_stellar_asset_contract(admin.clone());
    let sac = token::StellarAssetClient::new(env, &token);
    sac.mint(admin, &i128::MAX);
    token
}

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

#[test]
fn test_create_escrow_happy() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );
    assert_eq!(escrow_id, 1);
}

#[test]
fn test_create_escrow_insufficient_balance_fails() {
    let (env, contract_id, _admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);

    let token = Address::generate(&env);

    let result = client.try_create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );
    assert!(result.is_err());
}

#[test]
fn test_confirm_receipt_happy() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.confirm_receipt(&escrow_id);

    let token_client = token::Client::new(&env, &token);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&seller), 975);
    assert_eq!(token_client.balance(&fee_address), 25);
}

#[test]
fn test_confirm_receipt_double_fails() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.confirm_receipt(&escrow_id);
    let result = client.try_confirm_receipt(&escrow_id);
    assert!(result.is_err());
}

#[test]
fn test_confirm_receipt_wrong_buyer_fails() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let _escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    let wrong_buyer = Address::generate(&env);
    env.mock_all_auths();
    sac.mint(&wrong_buyer, &1000);
}

#[test]
fn test_raise_dispute_by_buyer() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.raise_dispute(&escrow_id, &buyer);
}

#[test]
fn test_raise_dispute_by_seller() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.raise_dispute(&escrow_id, &seller);
}

#[test]
fn test_raise_dispute_unrelated_fails() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    let stranger = Address::generate(&env);
    let result = client.try_raise_dispute(&escrow_id, &stranger);
    assert!(result.is_err());
}

#[test]
fn test_raise_dispute_wrong_status_fails() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.confirm_receipt(&escrow_id);
    let result = client.try_raise_dispute(&escrow_id, &buyer);
    assert!(result.is_err());
}

#[test]
fn test_resolve_dispute_release_to_seller() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.raise_dispute(&escrow_id, &buyer);
    client.resolve_dispute(&escrow_id, &seller);

    let token_client = token::Client::new(&env, &token);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&seller), 975);
    assert_eq!(token_client.balance(&fee_address), 25);
}

#[test]
fn test_resolve_dispute_release_to_buyer() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.raise_dispute(&escrow_id, &seller);
    client.resolve_dispute(&escrow_id, &buyer);

    let token_client = token::Client::new(&env, &token);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&buyer), 1000);
    assert_eq!(token_client.balance(&fee_address), 0);
}

#[test]
fn test_resolve_dispute_wrong_arbitrator_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let fee_address = Address::generate(&env);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &arbitrator, &fee_address, &250);

    let token = create_token(&env, &admin);
    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );
    client.raise_dispute(&escrow_id, &buyer);

    env.mock_all_auths();
}

#[test]
fn test_resolve_dispute_invalid_target_fails() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    client.raise_dispute(&escrow_id, &buyer);

    let stranger = Address::generate(&env);
    let result = client.try_resolve_dispute(&escrow_id, &stranger);
    assert!(result.is_err());
}

#[test]
fn test_resolve_dispute_not_disputed_fails() {
    let (env, contract_id, admin, _arbitrator, buyer, seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);
    let token = create_token(&env, &admin);

    let sac = token::StellarAssetClient::new(&env, &token);
    sac.mint(&buyer, &1000);

    let escrow_id = client.create_escrow(
        &buyer,
        &seller,
        &token,
        &1000,
        &String::from_str(&env, "example.stellar"),
    );

    let result = client.try_resolve_dispute(&escrow_id, &buyer);
    assert!(result.is_err());
}

#[test]
fn test_set_fee_happy() {
    let (env, contract_id, _admin, _arbitrator, _buyer, _seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);

    let new_fee_address = Address::generate(&env);
    client.set_fee(&500, &new_fee_address);
}

#[test]
fn test_set_fee_non_admin_fails() {
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
fn test_set_arbitrator_happy() {
    let (env, contract_id, _admin, _arbitrator, _buyer, _seller, _fee_address) = setup_test();
    let client = EscrowContractClient::new(&env, &contract_id);

    let new_arbitrator = Address::generate(&env);
    client.set_arbitrator(&new_arbitrator);
}

#[test]
fn test_set_arbitrator_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let fee_address = Address::generate(&env);

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &arbitrator, &fee_address, &250);
}
