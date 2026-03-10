import { Alchemy, Network, Utils as AlchemyUtils } from "alchemy-sdk";
import { verifyMessage as ethersVerifyMessage } from "@ethersproject/wallet";
import { recoverAddress } from "@ethersproject/transactions";
import { hashMessage } from "@ethersproject/hash";
import { splitSignature, hexlify, arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { defaultAbiCoder } from "@ethersproject/abi";
import { toUtf8Bytes } from "@ethersproject/strings";

let _signer: AlchemySigner | null = null;

const ERC1271_MAGIC_VALUE = "0x1626ba7e";

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

  async verifySignature(message: string, signature: string, expectedAddress: string): Promise<{
    isValid: boolean;
    recoveredAddress: string | null;
    error: string | null;
  }> {
    let sigStr = signature.trim();
    if (!sigStr.startsWith("0x")) sigStr = `0x${sigStr}`;

    const normalized = expectedAddress.trim().toLowerCase();
    const sigBytes = arrayify(sigStr);

    console.log(`[AlchemySigner] Verifying signature for address: ${expectedAddress.slice(0, 10)}... sigLen: ${sigBytes.length}`);

    if (sigBytes.length === 65) {
      const result = this.verifyEOASignature(message, sigStr, sigBytes, normalized);
      if (result.isValid) return result;
    }

    if (sigBytes.length !== 65) {
      console.log(`[AlchemySigner] Non-standard signature length (${sigBytes.length} bytes), trying ERC-1271 on-chain verification...`);
      const erc1271Result = await this.verifyERC1271(message, sigStr, expectedAddress);
      if (erc1271Result.isValid) return erc1271Result;
    }

    if (sigBytes.length === 65) {
      console.log(`[AlchemySigner] EOA verification failed, checking if address is a contract for ERC-1271...`);
      try {
        const isContract = await this.isContractAddress(expectedAddress);
        if (isContract) {
          const erc1271Result = await this.verifyERC1271(message, sigStr, expectedAddress);
          if (erc1271Result.isValid) return erc1271Result;
        }
      } catch (e: any) {
        console.log(`[AlchemySigner] Contract check failed: ${e.message}`);
      }
    }

    console.log(`[AlchemySigner] All verification methods failed for ${expectedAddress.slice(0, 10)}...`);
    return {
      isValid: false,
      recoveredAddress: null,
      error: "All signature verification methods failed",
    };
  }

  private verifyEOASignature(
    message: string,
    sigStr: string,
    sigBytes: Uint8Array,
    normalizedAddress: string
  ): { isValid: boolean; recoveredAddress: string | null; error: string | null } {
    const mutableSigBytes = new Uint8Array(sigBytes);
    let mutableSigStr = sigStr;

    const v = mutableSigBytes[64];
    if (v < 27) {
      mutableSigBytes[64] = v + 27;
      mutableSigStr = hexlify(mutableSigBytes);
      console.log(`[AlchemySigner] Adjusted v from ${v} to ${v + 27}`);
    }

    try {
      const recovered = ethersVerifyMessage(message, mutableSigStr);
      const isValid = recovered.toLowerCase() === normalizedAddress;
      console.log(`[AlchemySigner] Primary verify: recovered=${recovered.slice(0, 10)}... match=${isValid}`);
      if (isValid) return { isValid: true, recoveredAddress: recovered, error: null };
    } catch (e: any) {
      console.log(`[AlchemySigner] Primary verify threw: ${e.message?.slice(0, 80)}`);
    }

    try {
      const digest = hashMessage(message);
      const sig = splitSignature(mutableSigStr);
      const recovered = recoverAddress(digest, sig);
      const isValid = recovered.toLowerCase() === normalizedAddress;
      console.log(`[AlchemySigner] Fallback splitSig+recoverAddress: recovered=${recovered.slice(0, 10)}... match=${isValid}`);
      if (isValid) return { isValid: true, recoveredAddress: recovered, error: null };
    } catch (e: any) {
      console.log(`[AlchemySigner] Fallback recoverAddress threw: ${e.message?.slice(0, 80)}`);
    }

    try {
      const flipped = new Uint8Array(mutableSigBytes);
      flipped[64] = flipped[64] === 27 ? 28 : 27;
      const flippedSig = hexlify(flipped);
      const recovered = ethersVerifyMessage(message, flippedSig);
      const isValid = recovered.toLowerCase() === normalizedAddress;
      console.log(`[AlchemySigner] Flipped-v verify: recovered=${recovered.slice(0, 10)}... match=${isValid}`);
      if (isValid) return { isValid: true, recoveredAddress: recovered, error: null };
    } catch (e: any) {
      console.log(`[AlchemySigner] Flipped-v verify threw: ${e.message?.slice(0, 80)}`);
    }

    try {
      const digest = hashMessage(message);
      for (const vVal of [27, 28, 0, 1]) {
        try {
          const r = hexlify(mutableSigBytes.slice(0, 32));
          const s = hexlify(mutableSigBytes.slice(32, 64));
          const recovered = recoverAddress(digest, { r, s, v: vVal });
          if (recovered.toLowerCase() === normalizedAddress) {
            console.log(`[AlchemySigner] Manual v=${vVal} recovery matched`);
            return { isValid: true, recoveredAddress: recovered, error: null };
          }
        } catch {}
      }
    } catch {}

    return { isValid: false, recoveredAddress: null, error: "EOA verification failed" };
  }

  private async verifyERC1271(
    message: string,
    signature: string,
    contractAddress: string
  ): Promise<{ isValid: boolean; recoveredAddress: string | null; error: string | null }> {
    try {
      const messageHash = hashMessage(message);

      const callData = defaultAbiCoder.encode(
        ["bytes32", "bytes"],
        [messageHash, signature]
      );
      const selector = keccak256(toUtf8Bytes("isValidSignature(bytes32,bytes)")).slice(0, 10);
      const data = selector + callData.slice(2);

      console.log(`[AlchemySigner] ERC-1271 eth_call to ${contractAddress.slice(0, 10)}...`);

      const result = await this.alchemy.core.call({
        to: contractAddress,
        data,
      });

      if (result && result.length >= 10) {
        const returnedSelector = result.slice(0, 10).toLowerCase();
        const isValid = returnedSelector === ERC1271_MAGIC_VALUE;
        console.log(`[AlchemySigner] ERC-1271 returned: ${returnedSelector}, magic: ${ERC1271_MAGIC_VALUE}, match: ${isValid}`);
        if (isValid) {
          return { isValid: true, recoveredAddress: contractAddress, error: null };
        }
      } else {
        console.log(`[AlchemySigner] ERC-1271 returned empty/short result: ${result}`);
      }

      return { isValid: false, recoveredAddress: null, error: "ERC-1271 verification returned non-magic value" };
    } catch (e: any) {
      console.log(`[AlchemySigner] ERC-1271 call failed: ${e.message?.slice(0, 120)}`);
      return { isValid: false, recoveredAddress: null, error: `ERC-1271 call failed: ${e.message?.slice(0, 80)}` };
    }
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
