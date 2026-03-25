// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title SpaceFlightNFT
 * @notice Gas-optimised commemorative Space Flight NFTs with tiered pricing and OpenSea integration.
 *         Supports EIP-2771 gasless minting via SKYNTForwarder.
 */
contract SpaceFlightNFT is ERC721, ERC721URIStorage, AccessControl, ERC2771Context, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    error InvalidPhiScore();
    error InvalidRarity();
    error InvalidTreasury();
    error InsufficientAllowance();
    error NotTokenOwner();
    error AlreadyListed();
    error TokenDoesNotExist();
    error NoEarningsToWithdraw();
    error WithdrawalFailed();
    error SelfReferralNotAllowed();

    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;

    // Renamed: sphinxToken → skyntToken
    IERC20  public immutable skyntToken;
    address public treasury;
    address public openSeaProxy;

    uint256 public constant COMMON_FEE    = 500   * 10**18;
    uint256 public constant UNCOMMON_FEE  = 1000  * 10**18;
    uint256 public constant RARE_FEE      = 2500  * 10**18;
    uint256 public constant EPIC_FEE      = 10000 * 10**18;
    uint256 public constant LEGENDARY_FEE = 50000 * 10**18;

    uint256 public constant ROYALTY_BPS   = 1000;
    uint256 public constant REFERRAL_BPS  = 500;
    uint256 private constant BPS_DENOMINATOR = 10000;

    mapping(address => uint256) public referralEarnings;

    enum Rarity { COMMON, UNCOMMON, RARE, EPIC, LEGENDARY }

    struct NFTMetadata {
        uint128 phiScore;
        uint64  launchTimestamp;
        Rarity  rarity;
        bool    listedOnOpenSea;
        uint256 mintPrice;
        string  theme;
        string  missionName;
        string  rocketType;
    }

    mapping(uint256 => NFTMetadata) public nftMetadata;

    uint256 public totalMinted;
    uint256 public totalRevenue;
    mapping(Rarity => uint256) public mintedByRarity;

    uint256 public legendaryStartPrice = 10 ether;

    event NFTMinted(uint256 indexed tokenId, address indexed minter, Rarity rarity, uint256 fee, address referrer);
    event ListedOnOpenSea(uint256 indexed tokenId, uint256 price);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 amount);
    event ReferralPaid(address indexed referrer, uint256 amount);

    constructor(
        address _skyntToken,
        address _treasury,
        address _openSeaProxy,
        address _trustedForwarder
    ) ERC721("SphinxOS Space Flight", "SPACE") ERC2771Context(_trustedForwarder) {
        if (_treasury == address(0)) revert InvalidTreasury();

        skyntToken  = IERC20(_skyntToken);
        treasury    = _treasury;
        openSeaProxy = _openSeaProxy;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        _nextTokenId = 1;
    }

    function mintSpaceFlightNFT(
        Rarity rarity,
        string calldata theme,
        string calldata missionName,
        string calldata rocketType,
        uint256 phiScore,
        address referrer
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (phiScore < 200 || phiScore > 1000) revert InvalidPhiScore();
        uint256 fee    = getMintFee(rarity);
        address sender = _msgSender();

        skyntToken.safeTransferFrom(sender, address(this), fee);

        uint256 treasuryAmount = fee;
        if (referrer != address(0) && referrer != sender) {
            uint256 referralReward;
            unchecked {
                referralReward = (fee * REFERRAL_BPS) / BPS_DENOMINATOR;
                treasuryAmount = fee - referralReward;
            }
            referralEarnings[referrer] += referralReward;
            skyntToken.safeTransfer(referrer, referralReward);
            emit ReferralPaid(referrer, referralReward);
        }

        skyntToken.safeTransfer(treasury, treasuryAmount);

        uint256 newTokenId;
        unchecked { newTokenId = _nextTokenId++; }
        _safeMint(sender, newTokenId);

        nftMetadata[newTokenId] = NFTMetadata({
            phiScore:        uint128(phiScore),
            launchTimestamp: uint64(block.timestamp),
            rarity:          rarity,
            listedOnOpenSea: false,
            mintPrice:       fee,
            theme:           theme,
            missionName:     missionName,
            rocketType:      rocketType
        });

        unchecked {
            totalMinted++;
            totalRevenue += fee;
            mintedByRarity[rarity]++;
        }

        emit NFTMinted(newTokenId, sender, rarity, fee, referrer);

        if (rarity == Rarity.LEGENDARY) {
            _listOnOpenSea(newTokenId);
        }

        return newTokenId;
    }

    function autoMintAtLaunch(
        address recipient,
        string calldata theme,
        string calldata missionName,
        string calldata rocketType,
        uint256 phiScore
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        if (phiScore < 200 || phiScore > 1000) revert InvalidPhiScore();
        Rarity rarity = _determineRarity(phiScore);

        uint256 newTokenId;
        unchecked { newTokenId = _nextTokenId++; }
        _safeMint(recipient, newTokenId);

        nftMetadata[newTokenId] = NFTMetadata({
            phiScore:        uint128(phiScore),
            launchTimestamp: uint64(block.timestamp),
            rarity:          rarity,
            listedOnOpenSea: false,
            mintPrice:       0,
            theme:           theme,
            missionName:     missionName,
            rocketType:      rocketType
        });

        unchecked {
            totalMinted++;
            mintedByRarity[rarity]++;
        }

        if (rarity == Rarity.LEGENDARY) {
            _listOnOpenSea(newTokenId);
        }

        return newTokenId;
    }

    function _listOnOpenSea(uint256 tokenId) internal {
        NFTMetadata storage metadata = nftMetadata[tokenId];
        uint256 listPrice = _calculateOpenSeaPrice(metadata.rarity, metadata.phiScore);
        metadata.listedOnOpenSea = true;
        emit ListedOnOpenSea(tokenId, listPrice);
    }

    function _calculateOpenSeaPrice(Rarity rarity, uint128 phiScore) internal view returns (uint256) {
        uint256 basePrice = legendaryStartPrice;
        if (rarity == Rarity.EPIC)     { basePrice >>= 1; }
        else if (rarity == Rarity.RARE)   { basePrice >>= 2; }
        else if (rarity == Rarity.UNCOMMON) { basePrice /= 10; }
        else if (rarity == Rarity.COMMON)   { basePrice /= 20; }
        unchecked {
            uint256 phiMultiplier = 100 + (uint256(phiScore) - 200) / 10;
            basePrice = (basePrice * phiMultiplier) / 100;
        }
        return basePrice;
    }

    function listOnOpenSea(uint256 tokenId) external {
        if (ownerOf(tokenId) != _msgSender()) revert NotTokenOwner();
        if (nftMetadata[tokenId].listedOnOpenSea) revert AlreadyListed();
        _listOnOpenSea(tokenId);
    }

    function royaltyInfo(uint256, uint256 salePrice)
        external view returns (address receiver, uint256 royaltyAmount)
    {
        receiver = treasury;
        unchecked { royaltyAmount = (salePrice * ROYALTY_BPS) / BPS_DENOMINATOR; }
    }

    function payRoyalty(uint256 tokenId, address seller, address buyer)
        external payable nonReentrant
    {
        uint256 royaltyAmount;
        uint256 sellerAmount;
        unchecked {
            royaltyAmount = (msg.value * ROYALTY_BPS) / BPS_DENOMINATOR;
            sellerAmount  = msg.value - royaltyAmount;
        }
        (bool royaltyOk,) = treasury.call{value: royaltyAmount}("");
        require(royaltyOk, "Royalty payment failed");
        (bool sellerOk,)  = seller.call{value: sellerAmount}("");
        require(sellerOk, "Seller payment failed");
        emit RoyaltyPaid(tokenId, seller, buyer, royaltyAmount);
    }

    function getMintFee(Rarity rarity) public pure returns (uint256) {
        if (rarity == Rarity.COMMON)    return COMMON_FEE;
        if (rarity == Rarity.UNCOMMON)  return UNCOMMON_FEE;
        if (rarity == Rarity.RARE)      return RARE_FEE;
        if (rarity == Rarity.EPIC)      return EPIC_FEE;
        if (rarity == Rarity.LEGENDARY) return LEGENDARY_FEE;
        revert InvalidRarity();
    }

    function _determineRarity(uint256 phiScore) internal pure returns (Rarity) {
        if (phiScore >= 950) return Rarity.LEGENDARY;
        if (phiScore >= 800) return Rarity.EPIC;
        if (phiScore >= 600) return Rarity.RARE;
        if (phiScore >= 400) return Rarity.UNCOMMON;
        return Rarity.COMMON;
    }

    function getNFTMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        // OZ v5: _exists removed — use _ownerOf instead
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return nftMetadata[tokenId];
    }

    function getMintingStats() external view returns (uint256 total, uint256 revenue, uint256[5] memory byRarity) {
        total   = totalMinted;
        revenue = totalRevenue;
        byRarity = [
            mintedByRarity[Rarity.COMMON],
            mintedByRarity[Rarity.UNCOMMON],
            mintedByRarity[Rarity.RARE],
            mintedByRarity[Rarity.EPIC],
            mintedByRarity[Rarity.LEGENDARY]
        ];
    }

    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
    function setLegendaryStartPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) { legendaryStartPrice = newPrice; }
    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidTreasury();
        treasury = newTreasury;
    }
    function setOpenSeaProxy(address newProxy) external onlyRole(ADMIN_ROLE) { openSeaProxy = newProxy; }

    function withdrawReferralEarnings() external nonReentrant {
        address sender = _msgSender();
        uint256 earnings = referralEarnings[sender];
        if (earnings == 0) revert NoEarningsToWithdraw();
        referralEarnings[sender] = 0;
        skyntToken.safeTransfer(sender, earnings);
    }

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

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) { super._burn(tokenId); }
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) { return super.tokenURI(tokenId); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) { return super.supportsInterface(interfaceId); }
}
