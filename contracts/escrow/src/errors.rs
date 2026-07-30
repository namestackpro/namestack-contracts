use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    EscrowNotFound = 3,
    InvalidStatus = 4,
    Unauthorized = 5,
    InvalidReleaseTarget = 6,
    Overflow = 7,
}
