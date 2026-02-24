// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SphinxBridge
 * @dev Cross-chain bridge for SphinxSkynet Blockchain
 * Supports lock/mint and burn/release mechanisms with multi-sig validation
 */
contract SphinxBridge {
    enum Status { Pending, Locked, Minted, Burned, Released, Failed }
    
    struct BridgeTransaction {
        bytes32 txHash;
        address sender;
        address recipient;
        uint256 amount;
        string sourceChain;
        string destinationChain;
        Status status;
        uint256 timestamp;
        uint8 signatures;
    }
    
    mapping(bytes32 => BridgeTransaction) public transactions;
    mapping(address => uint256) public lockedBalances;
    mapping(address => uint256) public wrappedBalances;
    mapping(address => bool) public guardians;
    
    address[] public guardianList;
    uint8 public constant REQUIRED_SIGNATURES = 5;
    uint8 public constant TOTAL_GUARDIANS = 9;
    uint256 public constant BRIDGE_FEE = 1; // 0.1% (in basis points: 1/1000)
    
    event TokensLocked(bytes32 indexed txHash, address indexed sender, uint256 amount, string destinationChain);
    event TokensMinted(bytes32 indexed txHash, address indexed recipient, uint256 amount);
    event TokensBurned(bytes32 indexed txHash, address indexed sender, uint256 amount, string destinationChain);
    event TokensReleased(bytes32 indexed txHash, address indexed recipient, uint256 amount);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    
    modifier onlyGuardian() {
        require(guardians[msg.sender], "Not a guardian");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be positive");
        _;
    }
    
    constructor(address[] memory _guardians) {
        require(_guardians.length == TOTAL_GUARDIANS, "Must have exactly 9 guardians");
        
        for (uint i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != address(0), "Invalid guardian address");
            guardians[_guardians[i]] = true;
            guardianList.push(_guardians[i]);
        }
    }
    
    function lockTokens(
        string memory destinationChain,
        address recipient
    ) external payable validAmount(msg.value) returns (bytes32) {
        uint256 fee = (msg.value * BRIDGE_FEE) / 1000;
        uint256 netAmount = msg.value - fee;
        
        bytes32 txHash = keccak256(abi.encodePacked(
            msg.sender, recipient, msg.value, destinationChain, block.timestamp
        ));
        
        transactions[txHash] = BridgeTransaction({
            txHash: txHash,
            sender: msg.sender,
            recipient: recipient,
            amount: netAmount,
            sourceChain: "ethereum",
            destinationChain: destinationChain,
            status: Status.Locked,
            timestamp: block.timestamp,
            signatures: 0
        });
        
        lockedBalances[msg.sender] += netAmount;
        emit TokensLocked(txHash, msg.sender, netAmount, destinationChain);
        return txHash;
    }
    
    function mintTokens(bytes32 txHash) external onlyGuardian {
        BridgeTransaction storage bridgeTx = transactions[txHash];
        require(bridgeTx.status == Status.Locked, "Invalid status");
        require(bridgeTx.signatures < REQUIRED_SIGNATURES, "Already processed");
        
        bridgeTx.signatures++;
        
        if (bridgeTx.signatures >= REQUIRED_SIGNATURES) {
            bridgeTx.status = Status.Minted;
            wrappedBalances[bridgeTx.recipient] += bridgeTx.amount;
            emit TokensMinted(txHash, bridgeTx.recipient, bridgeTx.amount);
        }
    }
    
    function burnTokens(
        uint256 amount,
        string memory destinationChain,
        address recipient
    ) external validAmount(amount) returns (bytes32) {
        require(wrappedBalances[msg.sender] >= amount, "Insufficient balance");
        
        uint256 fee = (amount * BRIDGE_FEE) / 1000;
        uint256 netAmount = amount - fee;
        
        wrappedBalances[msg.sender] -= amount;
        
        bytes32 txHash = keccak256(abi.encodePacked(
            msg.sender, recipient, amount, destinationChain, block.timestamp
        ));
        
        transactions[txHash] = BridgeTransaction({
            txHash: txHash,
            sender: msg.sender,
            recipient: recipient,
            amount: netAmount,
            sourceChain: "sphinx",
            destinationChain: destinationChain,
            status: Status.Burned,
            timestamp: block.timestamp,
            signatures: 0
        });
        
        emit TokensBurned(txHash, msg.sender, netAmount, destinationChain);
        return txHash;
    }
    
    function releaseTokens(bytes32 txHash) external onlyGuardian {
        BridgeTransaction storage bridgeTx = transactions[txHash];
        require(bridgeTx.status == Status.Burned, "Invalid status");
        require(bridgeTx.signatures < REQUIRED_SIGNATURES, "Already processed");
        
        bridgeTx.signatures++;
        
        if (bridgeTx.signatures >= REQUIRED_SIGNATURES) {
            bridgeTx.status = Status.Released;
            require(lockedBalances[bridgeTx.sender] >= bridgeTx.amount, "Insufficient locked balance");
            lockedBalances[bridgeTx.sender] -= bridgeTx.amount;
            payable(bridgeTx.recipient).transfer(bridgeTx.amount);
            emit TokensReleased(txHash, bridgeTx.recipient, bridgeTx.amount);
        }
    }
    
    function getTransactionStatus(bytes32 txHash) external view returns (
        address sender, address recipient, uint256 amount, Status status, uint8 signatures
    ) {
        BridgeTransaction memory bridgeTx = transactions[txHash];
        return (bridgeTx.sender, bridgeTx.recipient, bridgeTx.amount, bridgeTx.status, bridgeTx.signatures);
    }
    
    function getWrappedBalance(address account) external view returns (uint256) {
        return wrappedBalances[account];
    }
    
    function getLockedBalance(address account) external view returns (uint256) {
        return lockedBalances[account];
    }
}
