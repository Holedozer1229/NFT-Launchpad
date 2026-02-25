use sha2::{Sha256, Digest};
use anchor_lang::prelude::*;

pub fn recursive_pow(nonce: u64, miner: &Pubkey) -> [u8; 32] {
    let mut hash = [0u8; 32];
    for _ in 0..10 {
        let mut hasher = Sha256::new();
        hasher.update(&hash);
        hasher.update(&nonce.to_le_bytes());
        hasher.update(miner.as_ref());
        hash = hasher.finalize().into();
    }
    hash
}

pub fn verify_pow(pow_hash: &[u8; 32], difficulty: &crate::Difficulty) -> bool {
    let target = difficulty.current_target();
    let hash_num = u128::from_be_bytes(pow_hash[0..16].try_into().unwrap());
    hash_num < target
}
