// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CMAccountFactory} from "./CMAccountFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IEAS, Attestation, AttestationRequest, AttestationRequestData, RevocationRequest, RevocationRequestData} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

/**
 * @title CMRegistry
 * @dev This contract manages factories, tokens, pools, and interacts with EAS for attestations in the CM Protocol.
 *
 * @notice This contract emits events for adding and removing factories, tokens, and pools.
 * It also integrates with the Ethereum Attestation Service (EAS) for managing attestations.
 */
contract CMRegistry is AccessControl, Pausable {
    // Roles
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant CREDIT_FACILITATOR_ROLE =
        keccak256("CREDIT_FACILITATOR_ROLE");

    // Events
    event FactoryAdded(CMAccountFactory indexed factoryAddress);
    event FactoryRemoved(CMAccountFactory indexed factoryAddress);
    event TokenAdded(
        IERC20[] tokenAddresses,
        AggregatorV3Interface[] priceFeedAddresses
    );
    event TokenRemoved(IERC20[] tokenAddresses);
    event PoolAdded(IERC20[] poolAddresses);
    event PoolRemoved(IERC20[] poolAddresses);
    event KycAttested(
        address indexed smartWallet,
        uint256 kycId,
        uint256 kycLevel,
        bytes32 attestationUid
    );
    event KycRevoked(address indexed smartWallet, bytes32 attestationUid);

    // Constants
    uint256 public constant VERSION = 1;
    uint256 public constant MAX_BATCH_SIZE = 100;

    // EAS contract
    IEAS public immutable EAS;

    // Fee Receiver wallet
    address public feeReceiver;

    // Schema UIDs
    bytes32 public kycSchemaUid;

    constructor(address _eas, bytes32 _kycSchemaUid, address _feeReceiver) {
        EAS = IEAS(_eas);
        kycSchemaUid = _kycSchemaUid;
        feeReceiver = _feeReceiver;
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ATTESTER_ROLE, _msgSender());
        _grantRole(OPERATOR_ROLE, _msgSender());
    }

    /**
     * @dev Adds a new factory to the registry.
     * @param factoryAddress The address of the factory to add.
     * @notice This function only emits an event and does not store the factory address on-chain.
     */
    function addFactory(
        CMAccountFactory factoryAddress
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            address(factoryAddress) != address(0),
            "Factory address cannot be zero"
        );
        emit FactoryAdded(factoryAddress);
    }

    /**
     * @dev Removes a factory from the registry.
     * @param factoryAddress The address of the factory to remove.
     * @notice This function only emits an event and does not remove any on-chain data.
     */
    function removeFactory(
        CMAccountFactory factoryAddress
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            address(factoryAddress) != address(0),
            "Factory address cannot be zero"
        );
        emit FactoryRemoved(factoryAddress);
    }

    /**
     * @dev Adds multiple tokens and their corresponding price feed addresses to the registry.
     * @param tokenAddresses An array of token addresses to add.
     * @param priceFeedAddresses An array of price feed addresses corresponding to the tokens.
     * @notice This function emits an event with both token and price feed addresses.
     */
    function addToken(
        IERC20[] memory tokenAddresses,
        AggregatorV3Interface[] memory priceFeedAddresses
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            tokenAddresses.length > 0 &&
                tokenAddresses.length <= MAX_BATCH_SIZE,
            "Invalid token array length"
        );
        require(
            tokenAddresses.length == priceFeedAddresses.length,
            "Array lengths must match"
        );
        for (uint i = 0; i < tokenAddresses.length; i++) {
            require(
                address(tokenAddresses[i]) != address(0),
                "Invalid token address"
            );
            require(
                address(priceFeedAddresses[i]) != address(0),
                "Invalid price feed address"
            );
        }
        emit TokenAdded(tokenAddresses, priceFeedAddresses);
    }

    /**
     * @dev Removes multiple tokens from the registry.
     * @param tokenAddresses An array of token addresses to remove.
     * @notice This function only emits an event and does not remove any on-chain data.
     */
    function removeToken(
        IERC20[] memory tokenAddresses
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            tokenAddresses.length > 0 &&
                tokenAddresses.length <= MAX_BATCH_SIZE,
            "Invalid token array length"
        );
        emit TokenRemoved(tokenAddresses);
    }

    /**
     * @dev Adds multiple pools to the registry.
     * @param poolAddresses An array of pool addresses to add.
     * @notice This function only emits an event and does not store the pool addresses on-chain.
     */
    function addPool(
        IERC20[] memory poolAddresses
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            poolAddresses.length > 0 && poolAddresses.length <= MAX_BATCH_SIZE,
            "Invalid Pool array length"
        );
        emit PoolAdded(poolAddresses);
    }

    /**
     * @dev Removes multiple pools from the registry.
     * @param poolAddresses An array of pool addresses to remove.
     * @notice This function only emits an event and does not remove any on-chain data.
     */
    function removePool(
        IERC20[] memory poolAddresses
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(
            poolAddresses.length > 0 && poolAddresses.length <= MAX_BATCH_SIZE,
            "Invalid pool array length"
        );
        emit PoolRemoved(poolAddresses);
    }

    /**
     * @dev Attests a user's KYC information using EAS.
     * @param kycId User's KYC ID on the third-party platform.
     * @param kycLevel The KYC level to assign to the user.
     * @param smartWallet User's Smart Wallet address.
     * @notice Only accounts with the ATTESTER_ROLE can call this function.
     */
    function attestKyc(
        uint256 kycId,
        uint256 kycLevel,
        address smartWallet
    ) external onlyRole(ATTESTER_ROLE) whenNotPaused {
        require(kycLevel > 0, "Invalid KYC level");
        require(smartWallet != address(0), "Invalid smart wallet address");
        require(kycSchemaUid != bytes32(0), "KYC schema not set");

        AttestationRequestData memory data = AttestationRequestData({
            recipient: smartWallet,
            expirationTime: 0, // No expiration
            revocable: true,
            refUID: bytes32(0),
            data: abi.encode(kycId, kycLevel, smartWallet),
            value: 0
        });

        AttestationRequest memory request = AttestationRequest({
            schema: kycSchemaUid,
            data: data
        });

        bytes32 attestationUid = EAS.attest(request);

        // Emit the KycAttested event
        emit KycAttested(smartWallet, kycId, kycLevel, attestationUid);
    }

    /**
     * @dev Revokes a user's KYC attestation using EAS.
     * @param uid The UID of the attestation to revoke.
     * @notice Only accounts with the ATTESTER_ROLE can call this function.
     */
    function revokeKyc(
        bytes32 uid
    ) external onlyRole(ATTESTER_ROLE) whenNotPaused {
        require(uid != bytes32(0), "Invalid attestation UID");

        // Get the attestation data before revoking
        Attestation memory attestation = EAS.getAttestation(uid);
        require(attestation.uid == uid, "Attestation does not exist");

        EAS.revoke(
            RevocationRequest({
                schema: kycSchemaUid,
                data: RevocationRequestData({uid: uid, value: 0})
            })
        );

        // Emit the KycRevoked event
        emit KycRevoked(attestation.recipient, uid);
    }

    /**
     * @dev Grants the ATTESTER_ROLE to an account.
     * @param account The address to grant the role to.
     * @notice Only the admin can call this function.
     */
    function grantAttesterRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ATTESTER_ROLE, account);
    }

    /**
     * @dev Revokes the ATTESTER_ROLE from an account.
     * @param account The address to revoke the role from.
     * @notice Only the admin can call this function.
     */
    function revokeAttesterRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ATTESTER_ROLE, account);
    }

    /**
     * @dev Grants the CREDIT_FACILITATOR_ROLE to an account.
     * @param account The address to grant the role to.
     * @notice Only the admin can call this function.
     */
    function grantCfRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(CREDIT_FACILITATOR_ROLE, account);
    }

    /**
     * @dev Revokes the CREDIT_FACILITATOR_ROLE from an account.
     * @param account The address to revoke the role from.
     * @notice Only the admin can call this function.
     */
    function revokeCfRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(CREDIT_FACILITATOR_ROLE, account);
    }

    /**
     * @dev Grants the OPERATOR_ROLE to an account.
     * @param account The address to grant the role to.
     * @notice Only the admin can call this function.
     */
    function grantOperatorRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, account);
    }

    /**
     * @dev Revokes the OPERATOR_ROLE from an account.
     * @param account The address to revoke the role from.
     * @notice Only the admin can call this function.
     */
    function revokeOperatorRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, account);
    }

    /**
     * @dev Sets the KYC schema UID.
     * @param _kycSchemaUid The UID of the KYC schema in EAS.
     */
    function setKycSchemaUid(
        bytes32 _kycSchemaUid
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        kycSchemaUid = _kycSchemaUid;
    }

    /**
     * @dev Sets the fee receiver address.
     * @param _feeReceiver The new fee receiver address.
     * @notice Only accounts with the DEFAULT_ADMIN_ROLE can call this function.
     */
    function setFeeReceiver(
        address _feeReceiver
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _feeReceiver != address(0),
            "Fee receiver cannot be zero address"
        );
        feeReceiver = _feeReceiver;
    }

    /**
     * @dev Pauses the contract, preventing certain operations from being executed.
     * @notice This function can only be called by the contract owner.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract, allowing normal operation to resume.
     * @notice This function can only be called by the contract owner.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
