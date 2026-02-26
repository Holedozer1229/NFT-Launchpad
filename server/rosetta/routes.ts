/**
 * Coinbase Rosetta API Routes — SphinxSkynet (SKYNT) Blockchain
 *
 * Implements the Rosetta API specification v1.4.13.
 * Spec: https://docs.cdp.coinbase.com/rosetta/docs/api-reference
 *
 * Mount at /rosetta in the main Express app.
 * All endpoints use POST with JSON bodies.
 */

import { Router, type Request, type Response } from "express";
import { createHash } from "crypto";
import {
  getChainInfo,
  getBalance,
  getTransaction,
  getBlock,
  addPendingTransaction,
} from "../skynt-blockchain";
import type {
  NetworkIdentifier,
  BlockIdentifier,
  PartialBlockIdentifier,
  RosettaBlock,
  RosettaTransaction,
  Operation,
  Amount,
  Currency,
  RosettaError,
  NetworkListResponse,
  NetworkStatusResponse,
  NetworkOptionsResponse,
  AccountBalanceResponse,
  AccountCoinsResponse,
  BlockResponse,
  BlockTransactionResponse,
  MempoolResponse,
  MempoolTransactionResponse,
  ConstructionDeriveResponse,
  ConstructionPreprocessResponse,
  ConstructionMetadataResponse,
  ConstructionPayloadsResponse,
  ConstructionCombineResponse,
  ConstructionParseResponse,
  TransactionIdentifierResponse,
} from "./types";
import type { SkyntTransaction, SkyntBlock } from "../skynt-blockchain";

export const rosettaRouter = Router();

// ==================== Constants ====================

const BLOCKCHAIN = "SphinxSkynet";
const NETWORK = "mainnet";
const ROSETTA_VERSION = "1.4.13";
const NODE_VERSION = "1.0.0";

const SKYNT_CURRENCY: Currency = {
  symbol: "SKYNT",
  decimals: 8,
};

const NETWORK_IDENTIFIER: NetworkIdentifier = {
  blockchain: BLOCKCHAIN,
  network: NETWORK,
};

const OPERATION_TYPES = ["TRANSFER", "NFT_MINT", "COINBASE"];
const OPERATION_STATUSES = [
  { status: "SUCCESS", successful: true },
  { status: "REVERTED", successful: false },
];

// ==================== Rosetta Error Codes ====================
// Standard Rosetta error codes (spec §3.1.4)

const ERRORS: Record<string, RosettaError> = {
  INVALID_NETWORK: {
    code: 1,
    message: "Network identifier is not valid",
    description: "The blockchain or network field does not match SphinxSkynet mainnet.",
    retriable: false,
  },
  INVALID_ACCOUNT: {
    code: 2,
    message: "Account is invalid",
    description: "The account address provided could not be found or is malformed.",
    retriable: false,
  },
  INVALID_BLOCK: {
    code: 3,
    message: "Block is invalid",
    description: "The block identifier could not be found.",
    retriable: false,
  },
  INVALID_TRANSACTION: {
    code: 4,
    message: "Transaction is invalid",
    description: "The transaction identifier could not be found.",
    retriable: false,
  },
  INVALID_ADDRESS: {
    code: 5,
    message: "Address is invalid",
    description: "The public key could not be mapped to a valid SKYNT address.",
    retriable: false,
  },
  UNSUPPORTED_CURVE: {
    code: 6,
    message: "Signature type is not supported",
    description: "Only secp256k1 keys are supported for SKYNT address derivation.",
    retriable: false,
  },
  BROADCAST_FAILED: {
    code: 7,
    message: "Transaction broadcast failed",
    description: "The signed transaction could not be submitted to the SKYNT chain.",
    retriable: true,
  },
  PARSE_ERROR: {
    code: 8,
    message: "Unable to parse intent",
    description: "The transaction blob could not be parsed into operations.",
    retriable: false,
  },
};

// ==================== Helper functions ====================

function errorResponse(res: Response, err: RosettaError, status = 500): void {
  res.status(status).json(err);
}

function assertNetwork(
  body: { network_identifier?: NetworkIdentifier },
  res: Response
): boolean {
  const ni = body.network_identifier;
  if (
    !ni ||
    ni.blockchain !== BLOCKCHAIN ||
    ni.network !== NETWORK
  ) {
    errorResponse(res, ERRORS.INVALID_NETWORK, 400);
    return false;
  }
  return true;
}

/** Convert a raw SKYNT amount (float) to the atomic integer string (×10^8). */
function toAtomicString(amount: number): string {
  return Math.round(amount * 1e8).toString();
}

/** Build a Rosetta Amount from a raw SKYNT float. */
function skyntAmount(value: number): Amount {
  return {
    value: toAtomicString(value),
    currency: SKYNT_CURRENCY,
  };
}

/** Build a negative Rosetta Amount (debit) from a raw SKYNT float. */
function skyntDebit(value: number): Amount {
  return {
    value: "-" + toAtomicString(value),
    currency: SKYNT_CURRENCY,
  };
}

/** Map a SkyntTransaction to an array of Rosetta Operations. */
function txToOperations(tx: SkyntTransaction, startIndex = 0): Operation[] {
  const ops: Operation[] = [];

  const opType =
    tx.type === "coinbase" ? "COINBASE" :
    tx.type === "nft_mint"  ? "NFT_MINT" :
    "TRANSFER";

  // Debit from sender (skip for coinbase and nft_mint which have null fromAddress)
  if (tx.fromAddress) {
    ops.push({
      operation_identifier: { index: startIndex },
      type: opType,
      status: "SUCCESS",
      account: { address: tx.fromAddress },
      amount: skyntDebit(tx.amount + tx.fee),
    });
    startIndex++;
  }

  // Credit to recipient
  const meta: Record<string, unknown> = {};
  if (tx.nftMetadata) {
    meta.nft_metadata = tx.nftMetadata;
  }

  ops.push({
    operation_identifier: { index: startIndex },
    type: opType,
    status: "SUCCESS",
    account: { address: tx.toAddress },
    amount: skyntAmount(tx.amount),
    ...(Object.keys(meta).length > 0 ? { metadata: meta } : {}),
  });

  return ops;
}

/** Map a SkyntBlock to a Rosetta Block. */
function blockToRosetta(block: SkyntBlock, parentBlock: SkyntBlock | null): RosettaBlock {
  const parentId: BlockIdentifier = parentBlock
    ? { index: parentBlock.index, hash: parentBlock.hash }
    : { index: 0, hash: block.previousHash };

  const transactions: RosettaTransaction[] = block.transactions.map((tx, tIdx) => ({
    transaction_identifier: { hash: tx.txHash },
    operations: txToOperations(tx, tIdx * 10),
    metadata: {
      type: tx.type,
      signature: tx.signature,
      fee: tx.fee,
      phi_score: block.phiScore,
      pow_algorithm: block.powAlgorithm,
    },
  }));

  return {
    block_identifier: { index: block.index, hash: block.hash },
    parent_block_identifier: parentId,
    timestamp: block.timestamp || 1,
    transactions,
    metadata: {
      miner: block.miner,
      difficulty: block.difficulty,
      nonce: block.nonce,
      phi_score: block.phiScore,
      pow_algorithm: block.powAlgorithm,
    },
  };
}

// ==================== Data API ====================

// POST /rosetta/network/list
rosettaRouter.post("/network/list", (_req: Request, res: Response) => {
  const response: NetworkListResponse = {
    network_identifiers: [NETWORK_IDENTIFIER],
  };
  res.json(response);
});

// POST /rosetta/network/status
rosettaRouter.post("/network/status", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const info = getChainInfo();
  const genesisBlock = getBlock(0);
  const latestBlock = getBlock(info.latestBlockHeight);

  if (!genesisBlock || !latestBlock) {
    return errorResponse(res, ERRORS.INVALID_BLOCK, 500);
  }

  const response: NetworkStatusResponse = {
    current_block_identifier: {
      index: info.latestBlockHeight,
      hash: info.latestBlockHash,
    },
    current_block_timestamp: latestBlock.timestamp || Date.now(),
    genesis_block_identifier: {
      index: genesisBlock.index,
      hash: genesisBlock.hash,
    },
    sync_status: {
      current_index: info.latestBlockHeight,
      synced: info.isValid,
    },
    peers: [],
  };
  res.json(response);
});

// POST /rosetta/network/options
rosettaRouter.post("/network/options", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const response: NetworkOptionsResponse = {
    version: {
      rosetta_version: ROSETTA_VERSION,
      node_version: NODE_VERSION,
    },
    allow: {
      operation_statuses: OPERATION_STATUSES,
      operation_types: OPERATION_TYPES,
      errors: Object.values(ERRORS),
      historical_balance_lookup: false,
      mempool_coins: false,
    },
  };
  res.json(response);
});

// POST /rosetta/account/balance
rosettaRouter.post("/account/balance", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { account_identifier } = req.body;
  if (!account_identifier?.address) {
    return errorResponse(res, ERRORS.INVALID_ACCOUNT, 400);
  }

  const info = getChainInfo();
  const rawBalance = getBalance(account_identifier.address);

  const response: AccountBalanceResponse = {
    block_identifier: {
      index: info.latestBlockHeight,
      hash: info.latestBlockHash,
    },
    balances: [skyntAmount(rawBalance)],
    metadata: { address: account_identifier.address },
  };
  res.json(response);
});

// POST /rosetta/account/coins
rosettaRouter.post("/account/coins", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { account_identifier } = req.body;
  if (!account_identifier?.address) {
    return errorResponse(res, ERRORS.INVALID_ACCOUNT, 400);
  }

  const info = getChainInfo();
  const rawBalance = getBalance(account_identifier.address);

  const response: AccountCoinsResponse = {
    block_identifier: {
      index: info.latestBlockHeight,
      hash: info.latestBlockHash,
    },
    coins:
      rawBalance > 0
        ? [
            {
              coin_identifier: {
                identifier: `${account_identifier.address}:0`,
              },
              amount: skyntAmount(rawBalance),
            },
          ]
        : [],
  };
  res.json(response);
});

// POST /rosetta/block
rosettaRouter.post("/block", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const blockId: PartialBlockIdentifier = req.body.block_identifier ?? {};

  let block: SkyntBlock | null = null;
  if (blockId.hash !== undefined) {
    block = getBlock(blockId.hash);
  } else if (blockId.index !== undefined) {
    block = getBlock(blockId.index);
  }

  if (!block) {
    return errorResponse(res, ERRORS.INVALID_BLOCK, 404);
  }

  const parentBlock = block.index > 0 ? getBlock(block.index - 1) : null;
  const response: BlockResponse = {
    block: blockToRosetta(block, parentBlock),
  };
  res.json(response);
});

// POST /rosetta/block/transaction
rosettaRouter.post("/block/transaction", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { block_identifier, transaction_identifier } = req.body;
  if (!block_identifier || !transaction_identifier?.hash) {
    return errorResponse(res, ERRORS.INVALID_TRANSACTION, 400);
  }

  const block = getBlock(block_identifier.index ?? block_identifier.hash);
  if (!block) {
    return errorResponse(res, ERRORS.INVALID_BLOCK, 404);
  }

  const tx = block.transactions.find(t => t.txHash === transaction_identifier.hash);
  if (!tx) {
    return errorResponse(res, ERRORS.INVALID_TRANSACTION, 404);
  }

  const response: BlockTransactionResponse = {
    transaction: {
      transaction_identifier: { hash: tx.txHash },
      operations: txToOperations(tx),
      metadata: {
        type: tx.type,
        signature: tx.signature,
        fee: tx.fee,
        phi_score: block.phiScore,
      },
    },
  };
  res.json(response);
});

// POST /rosetta/mempool
rosettaRouter.post("/mempool", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const info = getChainInfo();
  // The in-memory SKYNT blockchain exposes pending count via chainInfo.
  // Pending hashes are not individually enumerable from the exported API,
  // so we return an empty list (correct per Rosetta spec when count is 0).
  const response: MempoolResponse = {
    transaction_identifiers: Array.from(
      { length: info.pendingTransactions },
      (_, i) => ({ hash: `pending-${i}` })
    ),
  };
  res.json(response);
});

// POST /rosetta/mempool/transaction
rosettaRouter.post("/mempool/transaction", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { transaction_identifier } = req.body;
  if (!transaction_identifier?.hash) {
    return errorResponse(res, ERRORS.INVALID_TRANSACTION, 400);
  }

  const tx = getTransaction(transaction_identifier.hash);
  if (!tx) {
    return errorResponse(res, ERRORS.INVALID_TRANSACTION, 404);
  }

  const response: MempoolTransactionResponse = {
    transaction: {
      transaction_identifier: { hash: tx.txHash },
      operations: txToOperations(tx),
      metadata: { type: tx.type, fee: tx.fee },
    },
  };
  res.json(response);
});

// ==================== Construction API ====================

// POST /rosetta/construction/derive
// Derives a SKYNT address from a secp256k1 public key (SHA-256 of the key bytes).
rosettaRouter.post("/construction/derive", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { public_key } = req.body;
  if (!public_key?.hex_bytes) {
    return errorResponse(res, ERRORS.INVALID_ADDRESS, 400);
  }
  if (public_key.curve_type && public_key.curve_type !== "secp256k1") {
    return errorResponse(res, ERRORS.UNSUPPORTED_CURVE, 400);
  }

  const addressBytes = createHash("sha256")
    .update(Buffer.from(public_key.hex_bytes, "hex"))
    .digest("hex")
    .slice(0, 40);

  const response: ConstructionDeriveResponse = {
    account_identifier: { address: `0x${addressBytes}` },
  };
  res.json(response);
});

// POST /rosetta/construction/preprocess
// Validates operations and returns the options needed for /construction/metadata.
rosettaRouter.post("/construction/preprocess", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { operations } = req.body;
  if (!Array.isArray(operations) || operations.length === 0) {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  // Identify the sender (first debit operation)
  const debit = operations.find(
    (op: Operation) => op.amount?.value?.startsWith("-")
  );

  const response: ConstructionPreprocessResponse = {
    options: {
      from_address: debit?.account?.address ?? null,
      operation_count: operations.length,
    },
    required_public_keys: debit?.account
      ? [debit.account]
      : [],
  };
  res.json(response);
});

// POST /rosetta/construction/metadata
// Returns the metadata (nonce / suggested fee) needed to build the transaction.
rosettaRouter.post("/construction/metadata", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { options } = req.body;
  const info = getChainInfo();

  const response: ConstructionMetadataResponse = {
    metadata: {
      chain_height: info.latestBlockHeight,
      difficulty: info.difficulty,
      pow_algorithm: info.powAlgorithm,
      from_address: options?.from_address ?? null,
    },
    suggested_fee: [skyntAmount(0)], // SKYNT is gasless
  };
  res.json(response);
});

// POST /rosetta/construction/payloads
// Builds an unsigned SKYNT transaction and the bytes that need to be signed.
rosettaRouter.post("/construction/payloads", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { operations, metadata } = req.body;
  if (!Array.isArray(operations) || operations.length === 0) {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  const credit = operations.find(
    (op: Operation) => !op.amount?.value?.startsWith("-")
  );
  const debit = operations.find(
    (op: Operation) => op.amount?.value?.startsWith("-")
  );

  if (!credit?.account?.address) {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  const unsignedTx = {
    from: debit?.account?.address ?? null,
    to: credit.account.address,
    amount: credit.amount?.value ?? "0",
    currency: credit.amount?.currency ?? SKYNT_CURRENCY,
    chain_height: metadata?.chain_height ?? 0,
    timestamp: Date.now(),
  };

  const unsignedTxHex = Buffer.from(JSON.stringify(unsignedTx)).toString("hex");

  const signingBytes = createHash("sha256")
    .update(JSON.stringify(unsignedTx))
    .digest("hex");

  const response: ConstructionPayloadsResponse = {
    unsigned_transaction: unsignedTxHex,
    payloads: debit?.account
      ? [
          {
            account_identifier: debit.account,
            hex_bytes: signingBytes,
            signature_type: "ecdsa",
          },
        ]
      : [],
  };
  res.json(response);
});

// POST /rosetta/construction/combine
// Attaches a signature to the unsigned transaction, producing a signed transaction blob.
rosettaRouter.post("/construction/combine", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { unsigned_transaction, signatures } = req.body;
  if (!unsigned_transaction || !Array.isArray(signatures)) {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  // Combine unsigned tx + signatures into a single signed blob
  const signedTx = {
    unsigned_transaction,
    signatures: signatures.map((s: { hex_bytes?: string; public_key?: { hex_bytes?: string } }) => ({
      hex_bytes: s.hex_bytes,
      public_key: s.public_key?.hex_bytes,
    })),
  };

  const response: ConstructionCombineResponse = {
    signed_transaction: Buffer.from(JSON.stringify(signedTx)).toString("hex"),
  };
  res.json(response);
});

// POST /rosetta/construction/parse
// Parses a signed or unsigned transaction blob back into operations.
rosettaRouter.post("/construction/parse", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { signed, transaction } = req.body;
  if (transaction === undefined || transaction === null) {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  let parsed: Record<string, unknown>;
  try {
    const blob = signed
      ? JSON.parse(Buffer.from(transaction, "hex").toString())
      : JSON.parse(Buffer.from(transaction, "hex").toString());

    const raw = signed ? JSON.parse(Buffer.from(String(blob.unsigned_transaction), "hex").toString()) : blob;
    parsed = raw as Record<string, unknown>;
  } catch {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  const ops: Operation[] = [];
  if (parsed.from) {
    ops.push({
      operation_identifier: { index: 0 },
      type: "TRANSFER",
      account: { address: String(parsed.from) },
      amount: { value: `-${parsed.amount}`, currency: SKYNT_CURRENCY },
    });
  }
  if (parsed.to) {
    ops.push({
      operation_identifier: { index: parsed.from ? 1 : 0 },
      type: "TRANSFER",
      account: { address: String(parsed.to) },
      amount: { value: String(parsed.amount), currency: SKYNT_CURRENCY },
    });
  }

  const response: ConstructionParseResponse = {
    operations: ops,
    account_identifier_signers: parsed.from
      ? [{ address: String(parsed.from) }]
      : [],
  };
  res.json(response);
});

// POST /rosetta/construction/hash
// Returns the transaction hash without submitting.
rosettaRouter.post("/construction/hash", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { signed_transaction } = req.body;
  if (!signed_transaction) {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  const txHash =
    "0x" +
    createHash("sha256")
      .update(signed_transaction)
      .digest("hex");

  const response: TransactionIdentifierResponse = {
    transaction_identifier: { hash: txHash },
  };
  res.json(response);
});

// POST /rosetta/construction/submit
// Submits a signed transaction to the SKYNT pending pool.
rosettaRouter.post("/construction/submit", (req: Request, res: Response) => {
  if (!assertNetwork(req.body, res)) return;

  const { signed_transaction } = req.body;
  if (!signed_transaction) {
    return errorResponse(res, ERRORS.BROADCAST_FAILED, 400);
  }

  let parsedTx: Record<string, unknown>;
  try {
    const outer = JSON.parse(Buffer.from(signed_transaction, "hex").toString());
    parsedTx = JSON.parse(
      Buffer.from(String(outer.unsigned_transaction), "hex").toString()
    ) as Record<string, unknown>;
  } catch {
    return errorResponse(res, ERRORS.PARSE_ERROR, 400);
  }

  if (!parsedTx.to || typeof parsedTx.to !== "string") {
    return errorResponse(res, ERRORS.INVALID_ACCOUNT, 400);
  }

  const amount = parseInt(String(parsedTx.amount ?? "0"), 10) / 1e8;

  const pendingTx = addPendingTransaction({
    fromAddress: parsedTx.from ? String(parsedTx.from) : null,
    toAddress: parsedTx.to,
    amount,
    type: "transfer",
    timestamp: Date.now(),
  });

  const response: TransactionIdentifierResponse = {
    transaction_identifier: { hash: pendingTx.txHash },
  };
  res.json(response);
});
