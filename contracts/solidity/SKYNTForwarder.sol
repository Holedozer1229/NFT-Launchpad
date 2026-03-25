// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SKYNTForwarder
 * @notice EIP-2771 minimal meta-transaction forwarder for the SKYNT Protocol.
 *         Treasury wallet (relayer) pays gas; users only sign EIP-712 requests.
 * @dev Consumer contracts must inherit ERC2771Context and trust this forwarder.
 */
contract SKYNTForwarder is EIP712, Ownable {
    using ECDSA for bytes32;

    // ─── Custom Errors ────────────────────────────────────────────────────────
    error InvalidSignature();
    error ExpiredRequest();
    error ExecutionFailed(bytes reason);
    error InsufficientRelayBalance();
    error RelayerNotAuthorized();

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct ForwardRequestData {
        address from;     // original tx signer
        address to;       // target contract
        uint256 value;    // ETH to forward (0 for gasless)
        uint256 gas;      // gas limit for the sub-call
        uint48  deadline; // unix expiry timestamp
        bytes   data;     // encoded calldata
        bytes   signature;// EIP-712 sig by `from`
    }

    // ─── EIP-712 Type Hash ────────────────────────────────────────────────────
    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    // ─── State ────────────────────────────────────────────────────────────────
    mapping(address => uint256) private _nonces;
    mapping(address => bool)    public  authorizedRelayers;

    // ─── Events ──────────────────────────────────────────────────────────────
    event RequestExecuted(address indexed from, address indexed to, uint256 nonce, bool success);
    event RelayerUpdated(address indexed relayer, bool authorized);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _treasury) EIP712("SKYNTForwarder", "1") Ownable(_treasury) {
        authorizedRelayers[_treasury] = true;
    }

    // ─── Relayer Management ───────────────────────────────────────────────────
    function setRelayer(address relayer, bool authorized) external onlyOwner {
        authorizedRelayers[relayer] = authorized;
        emit RelayerUpdated(relayer, authorized);
    }

    // ─── Nonce ────────────────────────────────────────────────────────────────
    function nonces(address owner) external view returns (uint256) {
        return _nonces[owner];
    }

    // ─── Verify ───────────────────────────────────────────────────────────────
    function verify(ForwardRequestData calldata request) public view returns (bool) {
        (bool ok,) = _validate(request);
        return ok && block.timestamp <= request.deadline;
    }

    // ─── Execute ──────────────────────────────────────────────────────────────
    function execute(ForwardRequestData calldata request)
        external
        payable
        returns (bool success, bytes memory returndata)
    {
        if (!authorizedRelayers[msg.sender]) revert RelayerNotAuthorized();
        if (block.timestamp > request.deadline)  revert ExpiredRequest();
        if (address(this).balance < request.value) revert InsufficientRelayBalance();

        (bool ok,) = _validate(request);
        if (!ok) revert InvalidSignature();

        uint256 currentNonce = _nonces[request.from]++;

        // Append `request.from` as the last 20 bytes for ERC2771Context.
        (success, returndata) = request.to.call{gas: request.gas, value: request.value}(
            abi.encodePacked(request.data, request.from)
        );

        emit RequestExecuted(request.from, request.to, currentNonce, success);

        if (!success) revert ExecutionFailed(returndata);
    }

    // ─── Batch Execute ────────────────────────────────────────────────────────
    function executeBatch(ForwardRequestData[] calldata requests)
        external
        payable
        returns (bool[] memory successes)
    {
        if (!authorizedRelayers[msg.sender]) revert RelayerNotAuthorized();
        successes = new bool[](requests.length);
        for (uint256 i; i < requests.length;) {
            if (block.timestamp > requests[i].deadline || address(this).balance < requests[i].value) {
                unchecked { ++i; }
                continue;
            }
            (bool ok,) = _validate(requests[i]);
            if (!ok) { unchecked { ++i; } continue; }

            uint256 currentNonce = _nonces[requests[i].from]++;
            bool success;
            bytes memory returndata;
            (success, returndata) = requests[i].to.call{gas: requests[i].gas, value: requests[i].value}(
                abi.encodePacked(requests[i].data, requests[i].from)
            );
            successes[i] = success;
            emit RequestExecuted(requests[i].from, requests[i].to, currentNonce, success);
            unchecked { ++i; }
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _validate(ForwardRequestData calldata request)
        internal
        view
        returns (bool isTrusted, bytes32 digest)
    {
        digest = _hashTypedDataV4(keccak256(abi.encode(
            _TYPEHASH,
            request.from,
            request.to,
            request.value,
            request.gas,
            _nonces[request.from],
            request.deadline,
            keccak256(request.data)
        )));
        address recovered = ECDSA.recover(digest, request.signature);
        isTrusted = recovered == request.from;
    }

    // ─── Funding ──────────────────────────────────────────────────────────────
    function withdrawETH(uint256 amount) external onlyOwner {
        (bool ok,) = owner().call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    receive() external payable {}
}
