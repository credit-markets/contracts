// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import OpenZeppelin Contracts
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICMRegistry} from "./interfaces/ICMRegistry.sol";
import {IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

/**
 * @title CMPool
 * @dev ERC4626-compliant investment pool with EAS integration and custom investment logic.
 *
 * @notice This contract allows investors to deposit assets during a specified investment period,
 * integrates with the Ethereum Attestation Service (EAS) for KYC verification, and handles
 * thresholds, refunds, and repayments. Users cannot transfer their shares; they can only hold them.
 *
 * Investment Pool with EAS Integration
 */
contract CMPool is ERC20, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events

    /**
     * @dev Emitted when the contract is deployed.
     */
    event CMPoolCreated(
        IERC20 indexed asset,
        string name,
        string symbol,
        uint256 startTime,
        uint256 endTime,
        uint256 threshold,
        uint256 amountToRaise,
        uint256 feeBasisPoints,
        uint256 estimatedReturnBasisPoints,
        address indexed creditFacilitator,
        uint256 kycLevel,
        uint256 term
    );

    /**
     * @dev Emitted when funds are taken by the credit facilitator.
     */
    event FundsTaken(address indexed creditFacilitator, uint256 amount);

    /**
     * @dev Emitted when repayment is made by the credit facilitator.
     */
    event Repaid(uint256 amount);

    /**
     * @dev Emitted when an investor is refunded.
     */
    event Refunded(address indexed investor, uint256 amount);

    // State Variables

    // Investment period variables
    uint256 public immutable START_TIME;
    uint256 public immutable END_TIME;

    // Threshold and maximum raise amounts
    uint256 public immutable THRESHOLD;
    uint256 public immutable AMOUNT_TO_RAISE;

    // Fee and estimated return (stored as basis points)
    uint256 public immutable FEE_BASIS_POINTS;
    uint256 public immutable ESTIMATED_RETURN_BASIS_POINTS;

    // Term for repayment
    uint256 public immutable TERM;

    // Addresses
    IERC20 private immutable _ASSET;
    address public immutable CREDIT_FACILITATOR;
    ICMRegistry public immutable CM_REGISTRY;

    // Investment tracking
    mapping(address => uint256) public investments;
    address[] public investors;
    mapping(address => bool) private isInvestor;

    // Flags and totals
    bool public fundsTaken;
    bool public repaid;
    bool public refunded;
    uint256 public totalInvested;
    uint256 public repaymentAmount;
    uint256 public immutable KYC_LEVEL;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Struct to group constructor parameters
    struct PoolParams {
        uint256 startTime;
        uint256 endTime;
        uint256 threshold;
        uint256 amountToRaise;
        uint256 feeBasisPoints;
        uint256 estimatedReturnBasisPoints;
        address creditFacilitator;
        uint256 kycLevel;
        uint256 term;
    }

    /**
     * @dev Constructor to initialize the investment pool.
     * @param cmRegistry_ Credit Markets Registry Address.
     * @param asset_ The underlying asset (ERC20 token).
     * @param name_ Name of the ERC20 token.
     * @param symbol_ Symbol of the ERC20 token.
     * @param pool Struct containing all other constructor parameters.
     */
    constructor(
        ICMRegistry cmRegistry_,
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        PoolParams memory pool
    ) ERC20(name_, symbol_) {
        require(
            pool.startTime < pool.endTime,
            "Start time must be before end time"
        );
        require(
            pool.creditFacilitator != address(0),
            "Invalid credit facilitator"
        );
        require(
            address(cmRegistry_) != address(0),
            "Invalid cmRegistry address"
        );
        require(pool.term > 0, "Term must be greater than zero");

        // Verify that the provided address has the CF role in the registry
        require(
            cmRegistry_.hasRole(
                cmRegistry_.OPERATOR_ROLE(),
                pool.creditFacilitator
            ),
            "Address does not have Operator role"
        );

        _ASSET = asset_;
        CM_REGISTRY = cmRegistry_;
        START_TIME = pool.startTime;
        END_TIME = pool.endTime;
        THRESHOLD = pool.threshold;
        AMOUNT_TO_RAISE = pool.amountToRaise;
        FEE_BASIS_POINTS = pool.feeBasisPoints;
        ESTIMATED_RETURN_BASIS_POINTS = pool.estimatedReturnBasisPoints;
        CREDIT_FACILITATOR = pool.creditFacilitator;
        KYC_LEVEL = pool.kycLevel;
        TERM = pool.term;

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ADMIN_ROLE, _msgSender());

        // Emit event with constructor parameters
        emit CMPoolCreated(
            asset_,
            name_,
            symbol_,
            pool.startTime,
            pool.endTime,
            pool.threshold,
            pool.amountToRaise,
            pool.feeBasisPoints,
            pool.estimatedReturnBasisPoints,
            pool.creditFacilitator,
            pool.kycLevel,
            pool.term
        );
    }

    // Modifiers

    /**
     * @dev Modifier to prevent share transfers.
     */
    modifier transfersNotAllowed() {
        revert("Share transfers are not allowed");
        _;
    }

    // ERC4626 Required Functions Implementation

    /**
     * @dev Returns the address of the underlying asset.
     * @return The asset address.
     */
    function asset() public view returns (address) {
        return address(_ASSET);
    }

    /**
     * @dev Returns the total amount of the underlying asset managed by the pool.
     * @return The total assets.
     */
    function totalAssets() public view returns (uint256) {
        return _ASSET.balanceOf(address(this));
    }

    /**
     * @dev Converts a given amount of assets to shares.
     * @param assets The amount of assets.
     * @return shares The equivalent amount of shares.
     */
    function convertToShares(
        uint256 assets
    ) public view returns (uint256 shares) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }

    /**
     * @dev Allows an investor to deposit assets and receive shares.
     * @param assets Amount of assets to deposit.
     * @param attestationUid UID of the attestation.
     * @return shares Amount of shares minted.
     */
    function deposit(
        uint256 assets,
        bytes32 attestationUid
    ) public nonReentrant returns (uint256 shares) {
        require(
            block.timestamp >= START_TIME && block.timestamp <= END_TIME,
            "Investment period is closed"
        );
        require(
            totalAssets() + assets <= AMOUNT_TO_RAISE,
            "Investment exceeds amount to raise"
        );

        // Verify attestation
        _verifyAttestation(attestationUid);

        // Calculate shares to mint
        shares = convertToShares(assets);
        require(shares > 0, "Zero shares");

        // Transfer assets from sender
        _ASSET.safeTransferFrom(_msgSender(), address(this), assets);

        // Mint shares to receiver
        _mint(_msgSender(), shares);

        // Update investment tracking
        investments[_msgSender()] += assets;
        totalInvested += assets;

        // Add investor to list if not already present
        if (!isInvestor[_msgSender()]) {
            isInvestor[_msgSender()] = true;
            investors.push(_msgSender());
        }

        return shares;
    }

    /**
     * @dev Override the transfer function to prevent share transfers.
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert("Share transfers are not allowed");
    }

    /**
     * @dev Override the transferFrom function to prevent share transfers.
     */
    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        revert("Share transfers are not allowed");
    }

    /**
     * @dev Function to refund all investors if threshold is not met.
     */
    function refund() external nonReentrant {
        require(block.timestamp > END_TIME, "Investment period not yet ended");
        require(
            totalAssets() < THRESHOLD,
            "Threshold met, refund not possible"
        );
        require(!refunded, "Already refunded");
        refunded = true;

        // Iterate over all investors and refund their investments
        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 investedAmount = investments[investor];
            uint256 investorShares = balanceOf(investor);

            if (investedAmount > 0 && investorShares > 0) {
                // Reset investor's investment
                investments[investor] = 0;

                // Burn the investor's shares
                _burn(investor, investorShares);

                // Transfer assets back to investor
                _ASSET.safeTransfer(investor, investedAmount);

                emit Refunded(investor, investedAmount);
            }
        }
    }

    /**
     * @dev Function for the credit facilitator to take funds after the investment period.
     */
    function takeFunds() external nonReentrant {
        require(
            _msgSender() == CREDIT_FACILITATOR,
            "Caller is not the credit facilitator"
        );
        require(block.timestamp > END_TIME, "Investment period not yet ended");
        require(totalAssets() >= THRESHOLD, "Threshold not met");
        require(!fundsTaken, "Funds already taken");
        require(!refunded, "Funds have been refunded");
        fundsTaken = true;

        uint256 totalFunds = totalAssets();

        // Calculate fee
        uint256 feeAmount = (totalFunds * FEE_BASIS_POINTS) / 10000;
        uint256 facilitatorAmount = totalFunds - feeAmount;

        // Transfer fee to CMAdmWallet
        _ASSET.safeTransfer(CM_REGISTRY.feeReceiver(), feeAmount);

        // Transfer remaining funds to credit facilitator
        _ASSET.safeTransfer(CREDIT_FACILITATOR, facilitatorAmount);

        emit FundsTaken(CREDIT_FACILITATOR, facilitatorAmount);
    }

    /**
     * @dev Function for the credit facilitator to repay after the term.
     */
    function repay() external nonReentrant {
        require(
            _msgSender() == CREDIT_FACILITATOR,
            "Caller is not the credit facilitator"
        );
        require(
            block.timestamp > END_TIME + TERM,
            "Repayment period not yet started"
        );
        require(fundsTaken, "Funds not yet taken");
        require(!repaid, "Already repaid");
        repaid = true;

        repaymentAmount = calculateRepaymentAmount();

        // Transfer repayment amount from credit facilitator to contract
        _ASSET.safeTransferFrom(
            CREDIT_FACILITATOR,
            address(this),
            repaymentAmount
        );

        // Distribute repayment proportionally and burn investor tokens
        uint256 totalSupplyTokens = totalSupply();

        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 investorBalance = balanceOf(investor);

            if (investorBalance > 0) {
                uint256 share = (investorBalance * repaymentAmount) /
                    totalSupplyTokens;

                // Burn investor's tokens
                _burn(investor, investorBalance);

                // Transfer share of repayment
                _ASSET.safeTransfer(investor, share);
            }
        }

        emit Repaid(repaymentAmount);
    }

    /**
     * @dev Helper function to calculate the total repayment amount.
     * @return amount Total amount to be repaid.
     */
    function calculateRepaymentAmount() public view returns (uint256 amount) {
        uint256 estimatedReturnAmount = (totalInvested *
            ESTIMATED_RETURN_BASIS_POINTS) / 10000;
        amount = totalInvested + estimatedReturnAmount;
        return amount;
    }

    // Internal Functions

    /**
     * @dev Internal function to verify attestation using EAS.
     * @param attestationUid UID of the attestation.
     */
    function _verifyAttestation(bytes32 attestationUid) internal view {
        Attestation memory attestation = IEAS(CM_REGISTRY.eas()).getAttestation(
            attestationUid
        );
        require(
            attestation.attester == address(CM_REGISTRY),
            "Invalid attester"
        );
        require(
            attestation.recipient == _msgSender(),
            "Invalid attestation recipient"
        );

        // Decode attestation data to get kycId, kycLevel, and smartWallet
        (, uint256 kyc, address smartWallet) = abi.decode(
            attestation.data,
            (uint256, uint256, address)
        );

        require(kyc >= KYC_LEVEL, "Invalid KYC level");
        require(
            smartWallet == _msgSender(),
            "Attestation does not match sender"
        );
    }
}
