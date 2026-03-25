// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

interface IECDSAVerifier {
    function verify(bytes memory proof, uint256 nonce) external view returns (bool);
}

/**
 * @title SkynetBridge
 * @notice Solana→Ethereum NFT bridge, guarded by treasury-signed ECDSA proofs.
 *         Supports EIP-2771 gasless minting via SKYNTForwarder.
 * @dev Fixed: tokenId counter uses pre-increment (local var) for clarity.
 *      Added: MAX_SUPPLY cap. Added: Ownable for admin management.
 */
contract SkynetBridge is ERC721, ERC2771Context, Ownable {

    error NonceAlreadyUsed();
    error InvalidProof();
    error MaxSupplyReached();
    error InvalidVerifier();

    IECDSAVerifier public verifier;

    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 1_000_000;

    mapping(uint256 => bool) public usedNonces;

    event MintedFromSolana(address indexed recipient, uint256 indexed tokenId, uint256 solNonce);

    constructor(
        address _verifier,
        address _trustedForwarder
    ) ERC721("SKYNT", "SKYNT") ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        if (_verifier == address(0)) revert InvalidVerifier();
        verifier = IECDSAVerifier(_verifier);
    }

    function mintFromSolana(bytes memory proof, uint256 solNonce) external {
        if (usedNonces[solNonce])                   revert NonceAlreadyUsed();
        if (!verifier.verify(proof, solNonce))      revert InvalidProof();
        if (_nextTokenId >= MAX_SUPPLY)             revert MaxSupplyReached();

        usedNonces[solNonce] = true;

        uint256 tokenId = _nextTokenId++;
        _mint(_msgSender(), tokenId);

        emit MintedFromSolana(_msgSender(), tokenId, solNonce);
    }

    function setVerifier(address _verifier) external onlyOwner {
        if (_verifier == address(0)) revert InvalidVerifier();
        verifier = IECDSAVerifier(_verifier);
    }

    function totalMinted() external view returns (uint256) { return _nextTokenId; }

    // ─── ERC2771 overrides ────────────────────────────────────────────────────
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
