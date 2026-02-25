use anchor_lang::prelude::*;

pub fn initialize_difficulty(difficulty: &mut crate::Difficulty) -> Result<()> {
    difficulty.value = u128::MAX / 1_000_000; // initial target
    difficulty.last_update = Clock::get()?.unix_timestamp;
    difficulty.halving_period = 210_000 * 600; // 210,000 blocks * 600 seconds (10 min average block time)
    difficulty.blocks_mined = 0;
    Ok(())
}

pub fn update_difficulty(difficulty: &mut crate::Difficulty) -> Result<()> {
    difficulty.blocks_mined += 1;
    let now = Clock::get()?.unix_timestamp;
    
    // Check for halving based on time (simplified version)
    // In production, this should track actual block height from Solana
    if now - difficulty.last_update > difficulty.halving_period {
        difficulty.value /= 2;
        difficulty.last_update = now;
    }
    Ok(())
}
