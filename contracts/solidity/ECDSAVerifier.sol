// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ECDSAVerifier
 * @notice Production ECDSA signature verifier with full EIP-712 typed-data signing.
 *
 * verify()       — verifies treasury-signed nonces for SkynetBridge PoW auth.
 * verifyProof()  — IZKVerifier-compatible interface for SkynetZkBridge / ZkWormhole /
 *                  SKYNTZkEVM until real Groth16 circuits are deployed.
 *
 * @dev The treasury signs off-chain using EIP-712 typed data:
 *      Domain: { name: "ECDSAVerifier", version: "1", chainId, verifyingContract }
 *      Types:
 *        NonceAuth(uint256 nonce)
 *        ZKProof(uint256[2] a,uint256[4] b,uint256[2] c,bytes32 inputsHash)
 *
 *      When ZK circuits are ready, swap this contract for the snarkjs-generated verifier.
 */
contract ECDSAVerifier is Ownable {
    using ECDSA for bytes32;

    // ─── Errors ───────────────────────────────────────────────────────────────
    error InvalidProofLength();
    error InvalidNonce();
    error ZeroSigner();

    // ─── EIP-712 Type Hashes ─────────────────────────────────────────────────
    bytes32 private constant DOMAIN_TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NONCE_AUTH_TYPE_HASH = keccak256(
        "NonceAuth(uint256 nonce)"
    );
    // b is packed as uint256[4] (flattened 2×2 matrix) to keep within ABI limits
    bytes32 private constant ZK_PROOF_TYPE_HASH = keccak256(
        "ZKProof(uint256[2] a,uint256[4] b,uint256[2] c,bytes32 inputsHash)"
    );

    // ─── State ────────────────────────────────────────────────────────────────
    bytes32 public immutable DOMAIN_SEPARATOR;
    address public authorizedSigner;

    event AuthorizedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _signer) Ownable(msg.sender) {
        require(_signer != address(0), "Invalid signer");
        authorizedSigner = _signer;

        DOMAIN_SEPARATOR = keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256("ECDSAVerifier"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function setAuthorizedSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroSigner();
        emit AuthorizedSignerUpdated(authorizedSigner, _signer);
        authorizedSigner = _signer;
    }

    // ─── Internal: EIP-712 digest ─────────────────────────────────────────────
    function _hashTyped(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    // ─── verify() ─────────────────────────────────────────────────────────────
    /**
     * @notice Verify a treasury-signed nonce using EIP-712 typed data.
     *         Treasury signs off-chain: signTypedData(domain, { NonceAuth: [{nonce}] })
     *
     * @param proof  65-byte (r ++ s ++ v) ECDSA signature over EIP-712 digest
     * @param nonce  Unique nonce embedded in the typed message
     */
    function verify(bytes memory proof, uint256 nonce) external view returns (bool) {
        if (proof.length != 65) revert InvalidProofLength();
        if (nonce == 0)         revert InvalidNonce();

        bytes32 structHash = keccak256(abi.encode(NONCE_AUTH_TYPE_HASH, nonce));
        bytes32 digest     = _hashTyped(structHash);
        address recovered  = digest.recover(proof);
        return recovered == authorizedSigner;
    }

    // ─── verifyProof() ────────────────────────────────────────────────────────
    /**
     * @notice IZKVerifier-compatible proof check using EIP-712 typed data.
     *         Encoding: a[0]=r, a[1]=s; b[1][0]&1 = v-27; publicInputs → keccak256.
     *         Treasury signs: signTypedData(domain, { ZKProof: [a, flatB, c, inputsHash] })
     *
     * @param a             Groth16 A point (r, s of signature)
     * @param b             Groth16 B point 2x2 matrix (b[1][0] LSB = v parity)
     * @param c             Groth16 C point (ignored in ECDSA mode, reserved)
     * @param publicInputs  Public inputs hashed into the signed payload
     */
    function verifyProof(
        uint256[2]    memory a,
        uint256[2][2] memory b,
        uint256[2]    memory c,
        uint256[]     memory publicInputs
    ) external view returns (bool) {
        bytes32 inputsHash = keccak256(abi.encodePacked(publicInputs));

        // Flatten b 2×2 → uint256[4] for type hash
        uint256[4] memory bFlat = [b[0][0], b[0][1], b[1][0], b[1][1]];

        bytes32 structHash = keccak256(abi.encode(
            ZK_PROOF_TYPE_HASH,
            keccak256(abi.encodePacked(a)),
            keccak256(abi.encodePacked(bFlat)),
            keccak256(abi.encodePacked(c)),
            inputsHash
        ));
        bytes32 digest = _hashTyped(structHash);

        uint8   v = uint8(b[1][0] & 1) + 27;
        bytes32 r = bytes32(a[0]);
        bytes32 s = bytes32(a[1]);

        address recovered = ecrecover(digest, v, r, s);
        return recovered == authorizedSigner;
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────
    /**
     * @notice Build the EIP-712 digest for off-chain treasury signing of a nonce.
     *         Use this in tests / SDK to match what verify() expects.
     */
    function buildNonceDigest(uint256 nonce) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(NONCE_AUTH_TYPE_HASH, nonce));
        return _hashTyped(structHash);
    }

    /**
     * @notice Build the EIP-712 digest for off-chain treasury signing of a ZK proof.
     */
    function buildProofDigest(
        uint256[2]    memory a,
        uint256[2][2] memory b,
        uint256[2]    memory c,
        uint256[]     memory publicInputs
    ) external view returns (bytes32) {
        bytes32 inputsHash = keccak256(abi.encodePacked(publicInputs));
        uint256[4] memory bFlat = [b[0][0], b[0][1], b[1][0], b[1][1]];
        bytes32 structHash = keccak256(abi.encode(
            ZK_PROOF_TYPE_HASH,
            keccak256(abi.encodePacked(a)),
            keccak256(abi.encodePacked(bFlat)),
            keccak256(abi.encodePacked(c)),
            inputsHash
        ));
        return _hashTyped(structHash);
    }
}
