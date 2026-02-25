// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SkynetBridge is ERC721, Ownable {
    IECDSAVerifier public verifier;
    uint256 public tokenId;
    
    mapping(uint256 => bool) public usedNonces;
    
    event MintedFromSolana(address indexed recipient, uint256 tokenId, uint256 solNonce);

    constructor(address _verifier) ERC721("SKYNT", "SKYNT") Ownable(msg.sender) {
        verifier = IECDSAVerifier(_verifier);
    }

    function mintFromSolana(bytes memory proof, uint256 solNonce) external {
        require(!usedNonces[solNonce], "Nonce already used");
        require(verifier.verify(proof, solNonce), "Invalid PoW proof");
        
        usedNonces[solNonce] = true;
        _mint(msg.sender, tokenId);
        
        emit MintedFromSolana(msg.sender, tokenId, solNonce);
        tokenId++;
    }
    
    function setVerifier(address _verifier) external onlyOwner {
        verifier = IECDSAVerifier(_verifier);
    }
}

interface IECDSAVerifier {
    function verify(bytes memory proof, uint256 nonce) external view returns (bool);
}
