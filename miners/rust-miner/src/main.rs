use sha2::{Sha256, Digest};
use std::time::Instant;
use rand::Rng;

/// SKYNT Rust Miner
/// High-performance proof-of-work miner for the SKYNT network

pub struct SkynetMiner {
    miner_address: String,
    difficulty_target: u128,
    hashes_computed: u64,
    start_time: Instant,
}

impl SkynetMiner {
    pub fn new(miner_address: String, difficulty_target: Option<u128>) -> Self {
        Self {
            miner_address,
            difficulty_target: difficulty_target.unwrap_or(u128::MAX / 1_000_000),
            hashes_computed: 0,
            start_time: Instant::now(),
        }
    }

    /// Compute recursive proof-of-work hash
    /// Matches the Solana Anchor program's recursive_pow function
    pub fn recursive_pow(&self, nonce: u64) -> [u8; 32] {
        let mut hash = [0u8; 32];
        
        for _ in 0..10 {
            let mut hasher = Sha256::new();
            hasher.update(&hash);
            hasher.update(&nonce.to_le_bytes());
            hasher.update(self.miner_address.as_bytes());
            hash = hasher.finalize().into();
        }
        
        hash
    }

    /// Verify if the proof-of-work hash meets the difficulty target
    pub fn verify_pow(&self, pow_hash: &[u8; 32]) -> bool {
        let hash_num = u128::from_be_bytes(pow_hash[0..16].try_into().unwrap());
        hash_num < self.difficulty_target
    }

    /// Mine for a valid proof-of-work
    /// Returns nonce and hash when found
    pub fn mine(&mut self, max_iterations: Option<u64>) -> Option<(u64, [u8; 32])> {
        let mut rng = rand::thread_rng();
        let mut nonce: u64 = rng.gen();
        let mut iterations = 0u64;

        println!("Starting mining with difficulty target: {}", self.difficulty_target);
        println!("Miner address: {}", self.miner_address);

        loop {
            let pow_hash = self.recursive_pow(nonce);
            self.hashes_computed += 1;
            iterations += 1;

            if self.verify_pow(&pow_hash) {
                let elapsed = self.start_time.elapsed().as_secs_f64();
                let hashrate = self.hashes_computed as f64 / elapsed;

                println!("\n✓ Found valid proof!");
                println!("  Nonce: {}", nonce);
                println!("  Hash: {}", hex::encode(pow_hash));
                println!("  Iterations: {}", iterations);
                println!("  Time: {:.2}s", elapsed);
                println!("  Hashrate: {:.2} H/s", hashrate);

                return Some((nonce, pow_hash));
            }

            if iterations % 10000 == 0 {
                let elapsed = self.start_time.elapsed().as_secs_f64();
                let hashrate = if elapsed > 0.0 {
                    self.hashes_computed as f64 / elapsed
                } else {
                    0.0
                };
                print!("\rMining... {} attempts, {:.2} H/s", iterations, hashrate);
            }

            if let Some(max) = max_iterations {
                if iterations >= max {
                    println!("\nReached max iterations: {}", max);
                    return None;
                }
            }

            nonce = nonce.wrapping_add(1);
        }
    }

    pub fn submit_pow(&self, nonce: u64) {
        // This would interact with the Solana blockchain
        // For now, just print the submission data
        println!("\nSubmitting to Solana program:");
        println!("{{");
        println!("  \"nonce\": {},", nonce);
        println!("  \"miner\": \"{}\",", self.miner_address);
        println!("  \"timestamp\": {}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs());
        println!("}}");
    }
}

// Helper module for hex encoding (simple implementation)
mod hex {
    pub fn encode(data: [u8; 32]) -> String {
        data.iter()
            .map(|b| format!("{:02x}", b))
            .collect()
    }
}

fn main() {
    // Example miner address (would be Solana public key in production)
    let miner_address = "ExampleSolanaMinerAddress123456789".to_string();

    println!("{}", "=".repeat(60));
    println!("SKYNT RUST MINER");
    println!("{}", "=".repeat(60));

    let mut miner = SkynetMiner::new(miner_address, None);

    if let Some((nonce, _hash)) = miner.mine(None) {
        miner.submit_pow(nonce);
    }
}
