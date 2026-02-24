// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title SpaceFlightNFT
 * @notice Commemorative Space Flight NFTs with tiered pricing and OpenSea integration
 * @dev Maximizes monetization through:
 *  - Tiered minting fees (500 SPX - 50,000 SPX)
 *  - 10% royalties on all secondary sales
 *  - Automatic OpenSea listing for Legendary tier
 *  - Referral rewards (5% of mint fees)
 */
contract SpaceFlightNFT is ERC721, ERC721URIStorage, Ownable, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    using Address for address;
    
    // ========== ROLES ==========
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // ========== STATE VARIABLES ==========
    
    Counters.Counter private _tokenIds;
    
    address public sphinxToken;
    address public treasury;
    address public openSeaProxy;
    
    uint256 public constant COMMON_FEE = 500 * 10**18;
    uint256 public constant UNCOMMON_FEE = 1000 * 10**18;
    uint256 public constant RARE_FEE = 2500 * 10**18;
    uint256 public constant EPIC_FEE = 10000 * 10**18;
    uint256 public constant LEGENDARY_FEE = 50000 * 10**18;
    
    uint256 public constant ROYALTY_PERCENTAGE = 1000;
    
    uint256 public constant REFERRAL_REWARD = 500;
    mapping(address => uint256) public referralEarnings;
    
    enum Rarity { COMMON, UNCOMMON, RARE, EPIC, LEGENDARY }
    
    struct NFTMetadata {
        uint256 tokenId;
        Rarity rarity;
        string theme;
        string missionName;
        string rocketType;
        uint256 launchTimestamp;
        uint256 phiScore;
        bool listedOnOpenSea;
        uint256 mintPrice;
    }
    
    mapping(uint256 => NFTMetadata) public nftMetadata;
    
    uint256 public totalMinted;
    uint256 public totalRevenue;
    mapping(Rarity => uint256) public mintedByRarity;
    
    uint256 public legendaryStartPrice = 10 ether;
    
    // ========== EVENTS ==========
    
    event NFTMinted(uint256 indexed tokenId, address indexed minter, Rarity rarity, uint256 fee, address referrer);
    event ListedOnOpenSea(uint256 indexed tokenId, uint256 price);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 amount);
    event ReferralPaid(address indexed referrer, uint256 amount);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);
    
    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _sphinxToken,
        address _treasury,
        address _openSeaProxy
    ) ERC721("SphinxOS Space Flight", "SPACE") {
        require(_sphinxToken.isContract(), "Invalid SPX token");
        require(_treasury != address(0), "Invalid treasury");
        
        sphinxToken = _sphinxToken;
        treasury = _treasury;
        openSeaProxy = _openSeaProxy;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }
    
    // ========== MINTING FUNCTIONS ==========
    
    function mintSpaceFlightNFT(
        Rarity rarity,
        string memory theme,
        string memory missionName,
        string memory rocketType,
        uint256 phiScore,
        address referrer
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(phiScore >= 200 && phiScore <= 1000, "Invalid phi score");
        uint256 fee = getMintFee(rarity);
        
        require(IERC20(sphinxToken).transferFrom(msg.sender, address(this), fee), "SPX transfer failed");
        
        if (referrer != address(0) && referrer != msg.sender) {
            uint256 referralReward = (fee * REFERRAL_REWARD) / 10000;
            referralEarnings[referrer] += referralReward;
            require(IERC20(sphinxToken).transfer(referrer, referralReward), "Referral payment failed");
            emit ReferralPaid(referrer, referralReward);
            uint256 netFee = fee - referralReward;
            require(IERC20(sphinxToken).transfer(treasury, netFee), "Treasury payment failed");
        } else {
            require(IERC20(sphinxToken).transfer(treasury, fee), "Treasury payment failed");
        }
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _safeMint(msg.sender, newTokenId);
        
        nftMetadata[newTokenId] = NFTMetadata({
            tokenId: newTokenId,
            rarity: rarity,
            theme: theme,
            missionName: missionName,
            rocketType: rocketType,
            launchTimestamp: block.timestamp,
            phiScore: phiScore,
            listedOnOpenSea: false,
            mintPrice: fee
        });
        
        totalMinted++;
        totalRevenue += fee;
        mintedByRarity[rarity]++;
        
        emit NFTMinted(newTokenId, msg.sender, rarity, fee, referrer);
        
        if (rarity == Rarity.LEGENDARY) {
            _listOnOpenSea(newTokenId);
        }
        
        return newTokenId;
    }
    
    function autoMintAtLaunch(
        address recipient,
        string memory theme,
        string memory missionName,
        string memory rocketType,
        uint256 phiScore
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        Rarity rarity = _determineRarity(phiScore);
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _safeMint(recipient, newTokenId);
        
        nftMetadata[newTokenId] = NFTMetadata({
            tokenId: newTokenId,
            rarity: rarity,
            theme: theme,
            missionName: missionName,
            rocketType: rocketType,
            launchTimestamp: block.timestamp,
            phiScore: phiScore,
            listedOnOpenSea: false,
            mintPrice: 0
        });
        
        totalMinted++;
        mintedByRarity[rarity]++;
        
        if (rarity == Rarity.LEGENDARY) {
            _listOnOpenSea(newTokenId);
        }
        
        return newTokenId;
    }
    
    // ========== OPENSEA INTEGRATION ==========
    
    function _listOnOpenSea(uint256 tokenId) internal {
        NFTMetadata storage metadata = nftMetadata[tokenId];
        uint256 listPrice = _calculateOpenSeaPrice(metadata);
        metadata.listedOnOpenSea = true;
        emit ListedOnOpenSea(tokenId, listPrice);
    }
    
    function _calculateOpenSeaPrice(NFTMetadata memory metadata) internal view returns (uint256) {
        uint256 basePrice = legendaryStartPrice;
        
        if (metadata.rarity == Rarity.EPIC) {
            basePrice = basePrice / 2;
        } else if (metadata.rarity == Rarity.RARE) {
            basePrice = basePrice / 4;
        } else if (metadata.rarity == Rarity.UNCOMMON) {
            basePrice = basePrice / 10;
        } else if (metadata.rarity == Rarity.COMMON) {
            basePrice = basePrice / 20;
        }
        
        uint256 phiMultiplier = 100 + (metadata.phiScore - 200) / 10;
        basePrice = (basePrice * phiMultiplier) / 100;
        
        return basePrice;
    }
    
    function listOnOpenSea(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!nftMetadata[tokenId].listedOnOpenSea, "Already listed");
        _listOnOpenSea(tokenId);
    }
    
    // ========== ROYALTY FUNCTIONS ==========
    
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external view returns (address receiver, uint256 royaltyAmount)
    {
        receiver = treasury;
        royaltyAmount = (salePrice * ROYALTY_PERCENTAGE) / 10000;
    }
    
    function payRoyalty(uint256 tokenId, address seller, address buyer)
        external payable nonReentrant
    {
        uint256 royaltyAmount = (msg.value * ROYALTY_PERCENTAGE) / 10000;
        uint256 sellerAmount = msg.value - royaltyAmount;
        (bool royaltySuccess, ) = treasury.call{value: royaltyAmount}("");
        require(royaltySuccess, "Royalty payment failed");
        (bool sellerSuccess, ) = seller.call{value: sellerAmount}("");
        require(sellerSuccess, "Seller payment failed");
        emit RoyaltyPaid(tokenId, seller, buyer, royaltyAmount);
    }
    
    // ========== HELPER FUNCTIONS ==========
    
    function getMintFee(Rarity rarity) public pure returns (uint256) {
        if (rarity == Rarity.COMMON) return COMMON_FEE;
        if (rarity == Rarity.UNCOMMON) return UNCOMMON_FEE;
        if (rarity == Rarity.RARE) return RARE_FEE;
        if (rarity == Rarity.EPIC) return EPIC_FEE;
        if (rarity == Rarity.LEGENDARY) return LEGENDARY_FEE;
        revert("Invalid rarity");
    }
    
    function _determineRarity(uint256 phiScore) internal pure returns (Rarity) {
        if (phiScore >= 950) return Rarity.LEGENDARY;
        if (phiScore >= 800) return Rarity.EPIC;
        if (phiScore >= 600) return Rarity.RARE;
        if (phiScore >= 400) return Rarity.UNCOMMON;
        return Rarity.COMMON;
    }
    
    function getNFTMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        require(_exists(tokenId), "Token does not exist");
        return nftMetadata[tokenId];
    }
    
    function getMintingStats() external view returns (uint256 total, uint256 revenue, uint256[5] memory byRarity) {
        total = totalMinted;
        revenue = totalRevenue;
        byRarity = [
            mintedByRarity[Rarity.COMMON],
            mintedByRarity[Rarity.UNCOMMON],
            mintedByRarity[Rarity.RARE],
            mintedByRarity[Rarity.EPIC],
            mintedByRarity[Rarity.LEGENDARY]
        ];
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    function pause() external onlyRole(ADMIN_ROLE) { _pause(); emit ContractPaused(msg.sender); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); emit ContractUnpaused(msg.sender); }
    function setLegendaryStartPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) { legendaryStartPrice = newPrice; }
    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) { require(newTreasury != address(0), "Invalid treasury"); treasury = newTreasury; }
    function setOpenSeaProxy(address newProxy) external onlyRole(ADMIN_ROLE) { openSeaProxy = newProxy; }
    
    function withdrawReferralEarnings() external nonReentrant {
        uint256 earnings = referralEarnings[msg.sender];
        require(earnings > 0, "No earnings to withdraw");
        referralEarnings[msg.sender] = 0;
        require(IERC20(sphinxToken).transfer(msg.sender, earnings), "Withdrawal failed");
    }
    
    // ========== OVERRIDES ==========
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) { super._burn(tokenId); }
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) { return super.tokenURI(tokenId); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) { return super.supportsInterface(interfaceId); }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
