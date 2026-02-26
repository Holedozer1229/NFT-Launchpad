/**
 * Coinbase Rosetta API Type Definitions
 *
 * Implements the Rosetta API specification v1.4.13 for the SphinxSkynet (SKYNT) blockchain.
 * Spec: https://docs.cdp.coinbase.com/rosetta/docs/api-reference
 *
 * The Rosetta API provides a standardized interface for blockchain node interactions,
 * enabling wallets, exchanges, and developer tools to integrate with any blockchain
 * via a consistent REST API.
 */

// ==================== Identifiers ====================

export interface NetworkIdentifier {
  /** Blockchain name — always "SphinxSkynet" for this implementation. */
  blockchain: string;
  /** Network name — "mainnet" or "testnet". */
  network: string;
  sub_network_identifier?: SubNetworkIdentifier;
}

export interface SubNetworkIdentifier {
  network: string;
  metadata?: Record<string, unknown>;
}

export interface BlockIdentifier {
  /** Block height (index). */
  index: number;
  /** Block hash (hex string). */
  hash: string;
}

export interface PartialBlockIdentifier {
  index?: number;
  hash?: string;
}

export interface TransactionIdentifier {
  /** Transaction hash (hex string, prefixed with 0x for SKYNT). */
  hash: string;
}

export interface AccountIdentifier {
  /** Account address string. */
  address: string;
  sub_account?: SubAccountIdentifier;
  metadata?: Record<string, unknown>;
}

export interface SubAccountIdentifier {
  address: string;
  metadata?: Record<string, unknown>;
}

// ==================== Currency & Amount ====================

export interface Currency {
  /** Ticker symbol (e.g., "SKYNT"). */
  symbol: string;
  /** Number of decimal places (SKYNT uses 8). */
  decimals: number;
  metadata?: Record<string, unknown>;
}

export interface Amount {
  /**
   * Decimal string representation of the amount in the smallest unit.
   * Negative for debits, positive for credits.
   */
  value: string;
  currency: Currency;
  metadata?: Record<string, unknown>;
}

// ==================== Operations ====================

export interface OperationIdentifier {
  index: number;
  network_index?: number;
}

export interface Operation {
  operation_identifier: OperationIdentifier;
  /** Must be one of OPERATION_TYPES. */
  type: string;
  /** Must be "SUCCESS" or "REVERTED". Only set for confirmed transactions. */
  status?: string;
  account?: AccountIdentifier;
  amount?: Amount;
  coin_change?: CoinChange;
  metadata?: Record<string, unknown>;
  related_operations?: OperationIdentifier[];
}

export interface CoinIdentifier {
  identifier: string;
}

export interface CoinChange {
  coin_identifier: CoinIdentifier;
  coin_action: "coin_created" | "coin_spent";
}

// ==================== Transactions & Blocks ====================

export interface RosettaTransaction {
  transaction_identifier: TransactionIdentifier;
  operations: Operation[];
  related_transactions?: RelatedTransaction[];
  metadata?: Record<string, unknown>;
}

export interface RelatedTransaction {
  network_identifier?: NetworkIdentifier;
  transaction_identifier: TransactionIdentifier;
  direction: "forward" | "backward";
}

export interface RosettaBlock {
  block_identifier: BlockIdentifier;
  parent_block_identifier: BlockIdentifier;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  transactions: RosettaTransaction[];
  metadata?: Record<string, unknown>;
}

// ==================== Network ====================

export interface Peer {
  peer_id: string;
  metadata?: Record<string, unknown>;
}

export interface Version {
  rosetta_version: string;
  node_version: string;
  middleware_version?: string;
  metadata?: Record<string, unknown>;
}

export interface Allow {
  operation_statuses: OperationStatus[];
  operation_types: string[];
  errors: RosettaError[];
  historical_balance_lookup: boolean;
  timestamp_start_index?: number;
  call_methods?: string[];
  balance_exemptions?: BalanceExemption[];
  mempool_coins?: boolean;
}

export interface OperationStatus {
  status: string;
  successful: boolean;
}

export interface BalanceExemption {
  sub_account_address?: string;
  currency?: Currency;
  exemption_type: "greater_or_equal" | "less_or_equal" | "dynamic";
}

// ==================== Errors ====================

export interface RosettaError {
  code: number;
  message: string;
  description?: string;
  retriable: boolean;
  details?: Record<string, unknown>;
}

// ==================== Construction API ====================

export interface PublicKey {
  /** Hex-encoded public key bytes. */
  hex_bytes: string;
  curve_type: "secp256k1" | "secp256r1" | "edwards25519" | "tweedle";
}

export interface SigningPayload {
  /** Deprecated — use account_identifier. */
  address?: string;
  account_identifier?: AccountIdentifier;
  /** Hex-encoded bytes to sign. */
  hex_bytes: string;
  signature_type?: SignatureType;
}

export type SignatureType =
  | "ecdsa"
  | "ecdsa_recovery"
  | "ed25519"
  | "schnorr_1"
  | "schnorr_poseidon";

export interface Signature {
  signing_payload: SigningPayload;
  public_key: PublicKey;
  signature_type: SignatureType;
  /** Hex-encoded signature bytes. */
  hex_bytes: string;
}

// ==================== Request / Response shapes ====================

// --- /network/list ---
export interface NetworkListRequest {
  metadata?: Record<string, unknown>;
}
export interface NetworkListResponse {
  network_identifiers: NetworkIdentifier[];
}

// --- /network/status ---
export interface NetworkStatusRequest {
  network_identifier: NetworkIdentifier;
  metadata?: Record<string, unknown>;
}
export interface NetworkStatusResponse {
  current_block_identifier: BlockIdentifier;
  current_block_timestamp: number;
  genesis_block_identifier: BlockIdentifier;
  oldest_block_identifier?: BlockIdentifier;
  sync_status?: SyncStatus;
  peers: Peer[];
}

export interface SyncStatus {
  current_index?: number;
  target_index?: number;
  stage?: string;
  synced?: boolean;
}

// --- /network/options ---
export interface NetworkOptionsRequest {
  network_identifier: NetworkIdentifier;
  metadata?: Record<string, unknown>;
}
export interface NetworkOptionsResponse {
  version: Version;
  allow: Allow;
}

// --- /account/balance ---
export interface AccountBalanceRequest {
  network_identifier: NetworkIdentifier;
  account_identifier: AccountIdentifier;
  block_identifier?: PartialBlockIdentifier;
  currencies?: Currency[];
}
export interface AccountBalanceResponse {
  block_identifier: BlockIdentifier;
  balances: Amount[];
  metadata?: Record<string, unknown>;
}

// --- /account/coins ---
export interface AccountCoinsRequest {
  network_identifier: NetworkIdentifier;
  account_identifier: AccountIdentifier;
  include_mempool?: boolean;
  currencies?: Currency[];
}
export interface AccountCoinsResponse {
  block_identifier: BlockIdentifier;
  coins: Coin[];
  metadata?: Record<string, unknown>;
}

export interface Coin {
  coin_identifier: CoinIdentifier;
  amount: Amount;
}

// --- /block ---
export interface BlockRequest {
  network_identifier: NetworkIdentifier;
  block_identifier: PartialBlockIdentifier;
}
export interface BlockResponse {
  block?: RosettaBlock;
  other_transactions?: TransactionIdentifier[];
}

// --- /block/transaction ---
export interface BlockTransactionRequest {
  network_identifier: NetworkIdentifier;
  block_identifier: BlockIdentifier;
  transaction_identifier: TransactionIdentifier;
}
export interface BlockTransactionResponse {
  transaction: RosettaTransaction;
}

// --- /mempool ---
export interface MempoolRequest {
  network_identifier: NetworkIdentifier;
  metadata?: Record<string, unknown>;
}
export interface MempoolResponse {
  transaction_identifiers: TransactionIdentifier[];
}

// --- /mempool/transaction ---
export interface MempoolTransactionRequest {
  network_identifier: NetworkIdentifier;
  transaction_identifier: TransactionIdentifier;
}
export interface MempoolTransactionResponse {
  transaction: RosettaTransaction;
  metadata?: Record<string, unknown>;
}

// --- /construction/derive ---
export interface ConstructionDeriveRequest {
  network_identifier: NetworkIdentifier;
  public_key: PublicKey;
  metadata?: Record<string, unknown>;
}
export interface ConstructionDeriveResponse {
  address?: string;
  account_identifier?: AccountIdentifier;
  metadata?: Record<string, unknown>;
}

// --- /construction/preprocess ---
export interface ConstructionPreprocessRequest {
  network_identifier: NetworkIdentifier;
  operations: Operation[];
  metadata?: Record<string, unknown>;
  max_fee?: Amount[];
  suggested_fee_multiplier?: number;
}
export interface ConstructionPreprocessResponse {
  options?: Record<string, unknown>;
  required_public_keys?: AccountIdentifier[];
}

// --- /construction/metadata ---
export interface ConstructionMetadataRequest {
  network_identifier: NetworkIdentifier;
  options?: Record<string, unknown>;
  public_keys?: PublicKey[];
}
export interface ConstructionMetadataResponse {
  metadata: Record<string, unknown>;
  suggested_fee?: Amount[];
}

// --- /construction/payloads ---
export interface ConstructionPayloadsRequest {
  network_identifier: NetworkIdentifier;
  operations: Operation[];
  metadata?: Record<string, unknown>;
  public_keys?: PublicKey[];
}
export interface ConstructionPayloadsResponse {
  unsigned_transaction: string;
  payloads: SigningPayload[];
}

// --- /construction/combine ---
export interface ConstructionCombineRequest {
  network_identifier: NetworkIdentifier;
  unsigned_transaction: string;
  signatures: Signature[];
}
export interface ConstructionCombineResponse {
  signed_transaction: string;
}

// --- /construction/parse ---
export interface ConstructionParseRequest {
  network_identifier: NetworkIdentifier;
  signed: boolean;
  transaction: string;
}
export interface ConstructionParseResponse {
  operations: Operation[];
  account_identifier_signers?: AccountIdentifier[];
  signers?: string[];
  metadata?: Record<string, unknown>;
}

// --- /construction/hash ---
export interface ConstructionHashRequest {
  network_identifier: NetworkIdentifier;
  signed_transaction: string;
}
export interface TransactionIdentifierResponse {
  transaction_identifier: TransactionIdentifier;
  metadata?: Record<string, unknown>;
}

// --- /construction/submit ---
export interface ConstructionSubmitRequest {
  network_identifier: NetworkIdentifier;
  signed_transaction: string;
}
