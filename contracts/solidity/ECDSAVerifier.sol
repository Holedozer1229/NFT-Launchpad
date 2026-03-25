// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ECDSAVerifier
 * @notice Production ECDSA signature verifier — replaces the always-true placeholder.
 *
 * verify()       — used by SkynetBridge for PoW proof / treasury-signed nonces.
 * verifyProof()  — IZKVerifier-compatible interface for SkynetZkBridge / ZkWormhole /
 *                  SKYNTZkEVM until real Groth16 circuits are deployed.
 *
 * @dev The treasury signs (nonce) → verify; and signs (packed Groth16 inputs) → verifyProof.
 *      When ZK circuits are ready, swap this contract for the snarkjs-generated verifier.
 */
contract ECDSAVerifier is Ownable {
    using ECDSA for bytes32;

    error InvalidProofLength();
    error InvalidNonce();
    error ZeroSigner();

    address public authorizedSigner;

    event AuthorizedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    constructor(address _signer) Ownable(msg.sender) {
        require(_signer != address(0), "Invalid signer");
        authorizedSigner = _signer;
    }

    function setAuthorizedSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroSigner();
        emit AuthorizedSignerUpdated(authorizedSigner, _signer);
        authorizedSigner = _signer;
    }

    /**
     * @notice Verify a treasury-signed PoW authorization.
     *         The treasury signs: keccak256(abi.encode(nonce)) off-chain.
     *         The bridge calls this to confirm the treasury approved this nonce.
     *
     * @param proof  65-byte (r, s, v) ECDSA signature over EIP-191 hash of abi.encode(nonce)
     * @param nonce  Unique nonce embedded in the signed message
     */
    function verify(bytes memory proof, uint256 nonce) external view returns (bool) {
        if (proof.length != 65) revert InvalidProofLength();
        if (nonce == 0)         revert InvalidNonce();

        bytes32 messageHash    = keccak256(abi.encode(nonce));
        bytes32 ethSignedHash  = messageHash.toEthSignedMessageHash();
        address recovered      = ethSignedHash.recover(proof);
        return recovered == authorizedSigner;
    }

    /**
     * @notice IZKVerifier-compatible proof check using ECDSA.
     *         The Groth16 "A" point (a[0] = r, a[1] = s).
     *         b[1][0] & 1 gives v (0 = 27, 1 = 28).
     *         publicInputs are hashed as the signed payload.
     */
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) external view returns (bool) {
        bytes32 messageHash   = keccak256(abi.encode(a, b, c, publicInputs));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        uint8   v = uint8(b[1][0] & 1) + 27;
        bytes32 r = bytes32(a[0]);
        bytes32 s = bytes32(a[1]);

        address recovered = ecrecover(ethSignedHash, v, r, s);
        return recovered == authorizedSigner;
    }

    /**
     * @notice Helper: build the signed message hash for off-chain treasury signing.
     */
    function buildMessageHash(uint256 nonce) external pure returns (bytes32) {
        return keccak256(abi.encode(nonce)).toEthSignedMessageHash();
    }
}
