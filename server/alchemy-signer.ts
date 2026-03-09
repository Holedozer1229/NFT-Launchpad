import { Alchemy, Network, Utils as AlchemyUtils } from "alchemy-sdk";
import { verifyMessage as ethersVerifyMessage } from "@ethersproject/wallet";
import { recoverAddress } from "@ethersproject/transactions";
import { hashMessage } from "@ethersproject/hash";
import { splitSignature, joinSignature, hexlify, arrayify } from "@ethersproject/bytes";

let _signer: AlchemySigner | null = null;

class AlchemySigner {
  private alchemy: Alchemy;

  constructor(apiKey?: string) {
    this.alchemy = new Alchemy({
      apiKey: apiKey || process.env.ALCHEMY_API_KEY || "",
      network: Network.ETH_MAINNET,
    });
  }

  hashMessage(message: string): string {
    return AlchemyUtils.hashMessage(message);
  }

  verifySignature(message: string, signature: string, expectedAddress: string): {
    isValid: boolean;
    recoveredAddress: string | null;
    error: string | null;
  } {
    let sigStr = signature.trim();
    if (!sigStr.startsWith("0x")) sigStr = `0x${sigStr}`;

    const normalized = expectedAddress.trim().toLowerCase();
    const sigBytes = arrayify(sigStr);

    console.log(`[AlchemySigner] Verifying signature for address: ${expectedAddress.slice(0, 10)}... sigLen: ${sigBytes.length}`);

    if (sigBytes.length === 65) {
      const v = sigBytes[64];
      if (v < 27) {
        sigBytes[64] = v + 27;
        sigStr = hexlify(sigBytes);
        console.log(`[AlchemySigner] Adjusted v from ${v} to ${v + 27}`);
      }
    }

    try {
      const recovered = ethersVerifyMessage(message, sigStr);
      const isValid = recovered.toLowerCase() === normalized;
      console.log(`[AlchemySigner] Primary verify: recovered=${recovered.slice(0, 10)}... match=${isValid}`);
      if (isValid) return { isValid: true, recoveredAddress: recovered, error: null };
    } catch (e: any) {
      console.log(`[AlchemySigner] Primary verify threw: ${e.message}`);
    }

    try {
      const digest = hashMessage(message);
      const sig = splitSignature(sigStr);
      const recovered = recoverAddress(digest, sig);
      const isValid = recovered.toLowerCase() === normalized;
      console.log(`[AlchemySigner] Fallback splitSig+recoverAddress: recovered=${recovered.slice(0, 10)}... match=${isValid}`);
      if (isValid) return { isValid: true, recoveredAddress: recovered, error: null };
    } catch (e: any) {
      console.log(`[AlchemySigner] Fallback recoverAddress threw: ${e.message}`);
    }

    if (sigBytes.length === 65) {
      try {
        const flipped = new Uint8Array(sigBytes);
        flipped[64] = flipped[64] === 27 ? 28 : 27;
        const flippedSig = hexlify(flipped);
        const recovered = ethersVerifyMessage(message, flippedSig);
        const isValid = recovered.toLowerCase() === normalized;
        console.log(`[AlchemySigner] Flipped-v verify: recovered=${recovered.slice(0, 10)}... match=${isValid}`);
        if (isValid) return { isValid: true, recoveredAddress: recovered, error: null };
      } catch (e: any) {
        console.log(`[AlchemySigner] Flipped-v verify threw: ${e.message}`);
      }
    }

    try {
      const digest = hashMessage(message);
      for (const vVal of [27, 28, 0, 1]) {
        try {
          const r = hexlify(sigBytes.slice(0, 32));
          const s = hexlify(sigBytes.slice(32, 64));
          const recovered = recoverAddress(digest, { r, s, v: vVal });
          if (recovered.toLowerCase() === normalized) {
            console.log(`[AlchemySigner] Manual v=${vVal} recovery matched`);
            return { isValid: true, recoveredAddress: recovered, error: null };
          }
        } catch {}
      }
    } catch {}

    console.log(`[AlchemySigner] All verification methods failed for ${expectedAddress.slice(0, 10)}...`);
    return {
      isValid: false,
      recoveredAddress: null,
      error: "All signature verification methods failed",
    };
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.alchemy.core.getBalance(address);
    return balance.toString();
  }

  async isContractAddress(address: string): Promise<boolean> {
    const code = await this.alchemy.core.getCode(address);
    return code !== "0x";
  }

  getAlchemy(): Alchemy {
    return this.alchemy;
  }
}

export function getAlchemySigner(): AlchemySigner {
  if (!_signer) {
    _signer = new AlchemySigner();
  }
  return _signer;
}

export { AlchemySigner };
