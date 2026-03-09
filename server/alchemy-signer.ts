import { Alchemy, Network, Utils as AlchemyUtils } from "alchemy-sdk";
import { verifyMessage as ethersVerifyMessage } from "@ethersproject/wallet";
import { recoverAddress } from "@ethersproject/transactions";
import { hashMessage } from "@ethersproject/hash";
import { splitSignature } from "@ethersproject/bytes";

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

    try {
      const recovered = ethersVerifyMessage(message, sigStr);
      const isValid = recovered.toLowerCase() === normalized;
      return { isValid, recoveredAddress: recovered, error: null };
    } catch (primaryError: any) {
      try {
        const digest = hashMessage(message);
        const sig = splitSignature(sigStr);
        const recovered = recoverAddress(digest, sig);
        const isValid = recovered.toLowerCase() === normalized;
        return { isValid, recoveredAddress: recovered, error: null };
      } catch (fallbackError: any) {
        return {
          isValid: false,
          recoveredAddress: null,
          error: `Signature verification failed: ${primaryError.message}`,
        };
      }
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
