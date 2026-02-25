use anchor_lang::prelude::*;

pub mod pow;
pub mod difficulty;
pub mod mint;

use pow::*;
use difficulty::*;
use mint::*;

// Replace this with the actual program ID after running: anchor keys list
declare_id!("11111111111111111111111111111111");

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
}

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

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid proof of work - hash does not meet difficulty target")]
    InvalidProofOfWork,
}

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
