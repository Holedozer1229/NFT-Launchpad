import { createThirdwebClient, getContract, sendTransaction } from "thirdweb";
import { zkSyncSepolia, baseSepolia, zkSync } from "thirdweb/chains";
import { claimTo } from "thirdweb/extensions/erc1155";
import { Engine } from "thirdweb";

const SKYNT_CONTRACT_ADDRESS = "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20";
const TREASURY_WALLET = "0x7Fbe68677e63272ECB55355a6778fCee974d4895";

let _client: ReturnType<typeof createThirdwebClient> | null = null;

function getClient() {
  if (!_client) {
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      throw new Error("THIRDWEB_SECRET_KEY is not configured");
    }
    _client = createThirdwebClient({ secretKey });
  }
  return _client;
}

function getServerWallet() {
  const client = getClient();
  return Engine.serverWallet({
    client,
    address: TREASURY_WALLET,
  });
}

function getSkyntContract(chainOverride?: typeof zkSync) {
  const client = getClient();
  return getContract({
    client,
    address: SKYNT_CONTRACT_ADDRESS,
    chain: chainOverride || zkSync,
  });
}

export async function mintNftViaEngine(params: {
  recipientAddress: string;
  tokenId: bigint;
  quantity: bigint;
  chain?: typeof zkSync;
}): Promise<{
  transactionId: string;
  txHash: string | null;
  status: string;
}> {
  const serverWallet = getServerWallet();
  const contract = getSkyntContract(params.chain);

  const transaction = claimTo({
    contract,
    to: params.recipientAddress,
    tokenId: params.tokenId,
    quantity: params.quantity,
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });

  const client = getClient();

  try {
    const txHash = await Engine.waitForTransactionHash({
      client,
      transactionId,
    });

    return {
      transactionId,
      txHash: txHash ? String(txHash) : null,
      status: "confirmed",
    };
  } catch (err) {
    const executionResult = await Engine.getTransactionStatus({
      client,
      transactionId,
    });

    return {
      transactionId,
      txHash: null,
      status: executionResult?.status || "pending",
    };
  }
}

export async function getEngineTransactionStatus(transactionId: string) {
  const client = getClient();
  return Engine.getTransactionStatus({
    client,
    transactionId,
  });
}

export function isEngineConfigured(): boolean {
  return !!process.env.THIRDWEB_SECRET_KEY;
}

export { SKYNT_CONTRACT_ADDRESS, TREASURY_WALLET };
