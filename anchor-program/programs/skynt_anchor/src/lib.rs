use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;

pub mod pow;
pub mod difficulty;
pub mod mint;

use pow::*;
use difficulty::*;
use mint::*;

// Replace this with the actual program ID after running: anchor keys list
declare_id!("11111111111111111111111111111111");

// Space constants for account sizing
// PowChallenge: discriminator(8) + authority(32) + seed(32) + difficulty_target(16) +
//               expires_at(8) + solutions_count(4) + status(1) + padding(3) = 104
const POW_CHALLENGE_SPACE: usize = 8 + 32 + 32 + 16 + 8 + 4 + 1 + 3;
// SolutionRecord: discriminator(8) + challenge(32) + miner(32) + nonce(8) +
//                 pow_hash(32) + submitted_at(8) = 120
const SOLUTION_RECORD_SPACE: usize = 8 + 32 + 32 + 8 + 32 + 8;

#[program]
pub mod skynt_anchor {
    use super::*;

    pub fn init_genesis(ctx: Context<InitGenesis>) -> Result<()> {
        initialize_difficulty(&mut ctx.accounts.difficulty)?;
        Ok(())
    }

    pub fn submit_pow(ctx: Context<SubmitPow>, nonce: u64) -> Result<()> {
        let pow_hash = recursive_pow(nonce, &ctx.accounts.miner.key());
        require!(
            verify_pow(&pow_hash, &ctx.accounts.difficulty),
            ErrorCode::InvalidProofOfWork
        );
        
        mint_nft(ctx.accounts.mint.clone(), ctx.accounts.minter.clone())?;
        update_difficulty(&mut ctx.accounts.difficulty)?;
        
        msg!("PoW verified and NFT minted for nonce: {}", nonce);
        Ok(())
    }

    /// Admin creates a new PoW challenge with a unique seed, difficulty target, and expiration.
    /// The challenge seed is stored on-chain so miners can fetch and work against it.
    pub fn create_challenge(
        ctx: Context<CreateChallenge>,
        seed: [u8; 32],
        difficulty_target: u128,
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(expires_at > now, ErrorCode::ChallengeAlreadyExpired);
        require!(difficulty_target > 0, ErrorCode::InvalidDifficulty);

        let challenge = &mut ctx.accounts.challenge;
        challenge.authority = ctx.accounts.authority.key();
        challenge.seed = seed;
        challenge.difficulty_target = difficulty_target;
        challenge.expires_at = expires_at;
        challenge.solutions_count = 0;
        challenge.status = ChallengeStatus::Active;

        msg!(
            "Challenge created: seed={} difficulty={} expires_at={}",
            hex_encode_8(&seed),
            difficulty_target,
            expires_at
        );
        Ok(())
    }

    /// Miner submits a PoW solution for a challenge.
    /// Uses a PDA seeded by [challenge, miner] to enforce one solution record per miner per challenge
    /// (replay protection). On-chain SHA-256 verification via solana_program::hash.
    pub fn submit_challenge_solution(
        ctx: Context<SubmitChallengeSolution>,
        nonce: u64,
    ) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        let now = Clock::get()?.unix_timestamp;

        require!(
            challenge.status == ChallengeStatus::Active,
            ErrorCode::ChallengeNotActive
        );
        require!(now <= challenge.expires_at, ErrorCode::ChallengeAlreadyExpired);

        // Compute SHA-256: hash(seed || nonce_le || miner_pubkey)
        let nonce_bytes = nonce.to_le_bytes();
        let pow_hash_result = hashv(&[
            &challenge.seed,
            &nonce_bytes,
            ctx.accounts.miner.key().as_ref(),
        ]);
        let pow_hash: [u8; 32] = pow_hash_result.to_bytes();

        // Verify hash meets difficulty target (compare first 16 bytes as big-endian u128)
        let hash_num = u128::from_be_bytes(pow_hash[0..16].try_into().unwrap());
        require!(
            hash_num < challenge.difficulty_target,
            ErrorCode::InvalidProofOfWork
        );

        // Record the solution (PDA ensures uniqueness per miner per challenge)
        let record = &mut ctx.accounts.solution_record;
        record.challenge = challenge.key();
        record.miner = ctx.accounts.miner.key();
        record.nonce = nonce;
        record.pow_hash = pow_hash;
        record.submitted_at = now;

        challenge.solutions_count = challenge.solutions_count.saturating_add(1);

        msg!(
            "Challenge solution accepted: miner={} nonce={} hash={} solutions_total={}",
            ctx.accounts.miner.key(),
            nonce,
            hex_encode_8(&pow_hash),
            challenge.solutions_count
        );
        Ok(())
    }
}

/// Encodes the first 8 bytes of a slice as a hex string for logging (abbreviated).
fn hex_encode_8(data: &[u8]) -> String {
    let mut s: String = data.iter().take(8).map(|b| format!("{:02x}", b)).collect();
    if data.len() > 8 { s.push_str("..."); }
    s
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[account]
pub struct Difficulty {
    pub value: u128,
    pub last_update: i64,
    pub halving_period: i64,
    pub blocks_mined: u64,
}

impl Difficulty {
    pub fn current_target(&self) -> u128 {
        self.value
    }
}

/// On-chain record of a PoW challenge posted by an authority.
#[account]
pub struct PowChallenge {
    /// The account that created this challenge (admin/authority).
    pub authority: Pubkey,
    /// 32-byte challenge seed published to miners.
    pub seed: [u8; 32],
    /// Difficulty target — hash_num (first 16 bytes, big-endian u128) must be < this value.
    pub difficulty_target: u128,
    /// Unix timestamp after which no new solutions are accepted.
    pub expires_at: i64,
    /// Number of valid solutions submitted so far.
    pub solutions_count: u32,
    /// Current lifecycle status.
    pub status: ChallengeStatus,
}

/// Lifecycle status for a PoW challenge.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChallengeStatus {
    Active,
    Expired,
    Completed,
}

/// Per-miner solution record (PDA: seeds = [b"solution", challenge_key, miner_key]).
/// One record per (challenge, miner) pair — provides replay protection.
#[account]
pub struct SolutionRecord {
    /// The challenge this solution targets.
    pub challenge: Pubkey,
    /// The miner's public key.
    pub miner: Pubkey,
    /// Winning nonce.
    pub nonce: u64,
    /// SHA-256 hash that satisfied the difficulty.
    pub pow_hash: [u8; 32],
    /// Submission timestamp.
    pub submitted_at: i64,
}

// ─── Error codes ─────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid proof of work - hash does not meet difficulty target")]
    InvalidProofOfWork,
    #[msg("Challenge is not in Active status")]
    ChallengeNotActive,
    #[msg("Challenge has already expired")]
    ChallengeAlreadyExpired,
    #[msg("Difficulty target must be greater than zero")]
    InvalidDifficulty,
}

// ─── Context structs ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitGenesis<'info> {
    #[account(init, payer = authority, space = 8 + 16 + 8 + 8 + 8)]
    pub difficulty: Account<'info, Difficulty>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitPow<'info> {
    #[account(mut)]
    pub difficulty: Account<'info, Difficulty>,
    pub miner: Signer<'info>,
    /// CHECK: This is safe as we're just passing it to mint function
    pub mint: AccountInfo<'info>,
    /// CHECK: This is safe as we're just passing it to mint function
    pub minter: AccountInfo<'info>,
}

/// Create a new PoW challenge. Only the authority (signer) can create challenges.
#[derive(Accounts)]
pub struct CreateChallenge<'info> {
    #[account(init, payer = authority, space = POW_CHALLENGE_SPACE)]
    pub challenge: Account<'info, PowChallenge>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Submit a solution to an existing challenge.
/// The `solution_record` PDA is unique per (challenge, miner) — prevents replay.
#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct SubmitChallengeSolution<'info> {
    #[account(mut)]
    pub challenge: Account<'info, PowChallenge>,
    #[account(
        init,
        payer = miner,
        space = SOLUTION_RECORD_SPACE,
        seeds = [b"solution", challenge.key().as_ref(), miner.key().as_ref()],
        bump,
    )]
    pub solution_record: Account<'info, SolutionRecord>,
    #[account(mut)]
    pub miner: Signer<'info>,
    pub system_program: Program<'info, System>,
}
