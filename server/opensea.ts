import { Alchemy, Network, Wallet, Utils } from "alchemy-sdk";
import { createHash } from "crypto";

const OPENSEA_API_BASE = "https://api.opensea.io";

interface OpenSeaListingParams {
  chain: string;
  contractAddress: string;
  tokenId: string;
  price: string;
  sellerAddress: string;
  title: string;
}

interface OpenSeaListingResult {
  success: boolean;
  openseaUrl: string | null;
  listingId: string | null;
  error: string | null;
  chain: string;
  txHash?: string | null;
}

const CHAIN_NETWORK_MAP: Record<string, Network> = {
  ethereum: Network.ETH_MAINNET,
  polygon: Network.MATIC_MAINNET,
  base: Network.BASE_MAINNET,
  arbitrum: Network.ARB_MAINNET,
};

const CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "matic",
  arbitrum: "arbitrum",
  base: "base",
};

const OPENSEA_SUPPORTED_CHAINS = new Set(["ethereum", "polygon", "arbitrum", "base"]);

export function isOpenSeaSupported(chain: string): boolean {
  return OPENSEA_SUPPORTED_CHAINS.has(chain);
}

function getOpenSeaChain(chain: string): string {
  return CHAIN_MAP[chain] || "ethereum";
}

function getOpenSeaNftUrl(chain: string, contractAddress: string, tokenId: string): string {
  const osChain = getOpenSeaChain(chain);
  return `https://opensea.io/assets/${osChain}/${contractAddress}/${tokenId}`;
}

function getOpenSeaCollectionUrl(collectionSlug: string): string {
  return `https://opensea.io/collection/${collectionSlug}`;
}

export async function listNftOnOpenSea(params: OpenSeaListingParams): Promise<OpenSeaListingResult> {
  const openseaUrl = isOpenSeaSupported(params.chain)
    ? getOpenSeaNftUrl(params.chain, params.contractAddress, params.tokenId)
    : null;

  if (!isOpenSeaSupported(params.chain)) {
    return {
      success: false,
      openseaUrl: null,
      listingId: null,
      error: `Chain "${params.chain}" is not supported by OpenSea. Supported chains: Ethereum, Polygon, Arbitrum, Base.`,
      chain: params.chain,
    };
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      openseaUrl,
      listingId: null,
      error: "OpenSea API key not configured — add OPENSEA_API_KEY to enable real listings",
      chain: params.chain,
    };
  }

  const osChain = getOpenSeaChain(params.chain);
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY;

  if (!treasuryKey) {
    return {
      success: false,
      openseaUrl,
      listingId: null,
      error: "TREASURY_PRIVATE_KEY not configured — required to sign Seaport orders",
      chain: params.chain,
    };
  }

  try {
    const priceInWei = parseEthToWei(params.price);
    const numericTokenId = hexToNumericTokenId(params.tokenId);
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 60 * 60 * 24 * 30;
    const salt = generateSalt();
    const conduitKey = "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
    const seaportAddress = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";

    const orderParameters = {
      offerer: params.sellerAddress,
      zone: "0x0000000000000000000000000000000000000000",
      offer: [
        {
          itemType: 2,
          token: params.contractAddress,
          identifierOrCriteria: numericTokenId,
          startAmount: "1",
          endAmount: "1",
        },
      ],
      consideration: [
        {
          itemType: 0,
          token: "0x0000000000000000000000000000000000000000",
          identifierOrCriteria: "0",
          startAmount: priceInWei,
          endAmount: priceInWei,
          recipient: params.sellerAddress,
        },
      ],
      orderType: 0,
      startTime: startTime.toString(),
      endTime: endTime.toString(),
      salt,
      conduitKey,
      totalOriginalConsiderationItems: 1,
    };

    const signature = await signSeaportOrder(orderParameters, params.chain, treasuryKey);

    const orderPayload = {
      parameters: orderParameters,
      signature,
      protocol_address: seaportAddress,
    };

    const response = await fetch(
      `${OPENSEA_API_BASE}/v2/orders/${osChain}/seaport/listings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(orderPayload),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`[OpenSea] Listed ${params.title} on ${params.chain} — order: ${data.order?.order_hash || "pending"}`);
      return {
        success: true,
        openseaUrl,
        listingId: data.order?.order_hash || data.order_hash || null,
        error: null,
        chain: params.chain,
      };
    } else {
      const errorData = await response.text();
      console.error("[OpenSea] Listing error:", response.status, errorData);

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          openseaUrl,
          listingId: null,
          error: "OpenSea API key invalid or insufficient permissions",
          chain: params.chain,
        };
      }

      return {
        success: false,
        openseaUrl,
        listingId: null,
        error: `OpenSea API returned ${response.status}: ${errorData.slice(0, 200)}`,
        chain: params.chain,
      };
    }
  } catch (error: any) {
    console.error("[OpenSea] Listing exception:", error);
    return {
      success: false,
      openseaUrl,
      listingId: null,
      error: error.message || "Failed to connect to OpenSea",
      chain: params.chain,
    };
  }
}

export async function fetchNftFromOpenSea(
  chain: string,
  contractAddress: string,
  tokenId: string
): Promise<any | null> {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return null;

  const osChain = getOpenSeaChain(chain);

  try {
    const response = await fetch(
      `${OPENSEA_API_BASE}/api/v2/chain/${osChain}/contract/${contractAddress}/nfts/${tokenId}`,
      {
        headers: { "X-API-KEY": apiKey },
      }
    );

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchCollectionNfts(
  collectionSlug: string,
  limit: number = 50
): Promise<any[]> {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      `${OPENSEA_API_BASE}/api/v2/collection/${collectionSlug}/nfts?limit=${limit}`,
      {
        headers: { "X-API-KEY": apiKey },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.nfts || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchBestListing(
  collectionSlug: string,
  tokenId: string
): Promise<any | null> {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `${OPENSEA_API_BASE}/api/v2/listings/collection/${collectionSlug}/nfts/${tokenId}/best`,
      {
        headers: { "X-API-KEY": apiKey },
      }
    );

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

async function signSeaportOrder(
  orderParameters: any,
  chain: string,
  privateKey: string
): Promise<string> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw new Error("ALCHEMY_API_KEY required for signing");

  const network = CHAIN_NETWORK_MAP[chain] || Network.ETH_MAINNET;
  const alchemy = new Alchemy({ apiKey, network });
  const provider = await alchemy.config.getProvider();
  const wallet = new Wallet(privateKey, provider);

  const SEAPORT_ADDRESS = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";

  const chainId = chain === "polygon" ? 137 : chain === "base" ? 8453 : chain === "arbitrum" ? 42161 : 1;

  const domain = {
    name: "Seaport",
    version: "1.6",
    chainId,
    verifyingContract: SEAPORT_ADDRESS,
  };

  const types = {
    OrderComponents: [
      { name: "offerer", type: "address" },
      { name: "zone", type: "address" },
      { name: "offer", type: "OfferItem[]" },
      { name: "consideration", type: "ConsiderationItem[]" },
      { name: "orderType", type: "uint8" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "zoneHash", type: "bytes32" },
      { name: "salt", type: "uint256" },
      { name: "conduitKey", type: "bytes32" },
      { name: "counter", type: "uint256" },
    ],
    OfferItem: [
      { name: "itemType", type: "uint8" },
      { name: "token", type: "address" },
      { name: "identifierOrCriteria", type: "uint256" },
      { name: "startAmount", type: "uint256" },
      { name: "endAmount", type: "uint256" },
    ],
    ConsiderationItem: [
      { name: "itemType", type: "uint8" },
      { name: "token", type: "address" },
      { name: "identifierOrCriteria", type: "uint256" },
      { name: "startAmount", type: "uint256" },
      { name: "endAmount", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
  };

  const orderHash = createHash("sha256")
    .update(JSON.stringify(orderParameters))
    .digest("hex");

  const value = {
    offerer: orderParameters.offerer,
    zone: orderParameters.zone,
    offer: orderParameters.offer,
    consideration: orderParameters.consideration,
    orderType: orderParameters.orderType,
    startTime: orderParameters.startTime,
    endTime: orderParameters.endTime,
    zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    salt: orderParameters.salt,
    conduitKey: orderParameters.conduitKey,
    counter: "0",
  };

  const signature = await wallet._signTypedData(domain, types, value);
  return signature;
}

function hexToNumericTokenId(tokenId: string): string {
  const cleaned = tokenId.replace(/0x/gi, "").replace(/[^a-fA-F0-9]/g, "");
  if (!cleaned) return "1";
  try {
    return BigInt("0x" + cleaned).toString();
  } catch {
    return "1";
  }
}

function parseEthToWei(priceStr: string): string {
  const match = priceStr.match(/([\d.]+)/);
  if (!match) return "100000000000000000";
  const ethValue = parseFloat(match[1]);
  const weiValue = BigInt(Math.floor(ethValue * 1e18));
  return weiValue.toString();
}

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export { getOpenSeaNftUrl, getOpenSeaCollectionUrl, getOpenSeaChain };
