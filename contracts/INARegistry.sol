// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./InaAccountFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title Registry
 * @dev This contract manages factories, tokens, and products for the INA Protocol.
 *
 * @notice This contract emits events for adding and removing factories, tokens, and products.
 * It does not store these entities on-chain, relying instead on event emissions for off-chain tracking.
 *
 * ██╗███╗   ██╗ █████╗     ██████╗ ███████╗ ██████╗ ██╗███████╗████████╗██████╗ ██╗   ██╗
 * ██║████╗  ██║██╔══██╗    ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝
 * ██║██╔██╗ ██║███████║    ██████╔╝█████╗  ██║  ███╗██║███████╗   ██║   ██████╔╝ ╚████╔╝
 * ██║██║╚██╗██║██╔══██║    ██╔══██╗██╔══╝  ██║   ██║██║╚════██║   ██║   ██╔══██╗  ╚██╔╝
 * ██║██║ ╚████║██║  ██║    ██║  ██║███████╗╚██████╔╝██║███████║   ██║   ██║  ██║   ██║
 * ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝
 */
contract Registry is Ownable, Pausable {
    // Events
    event FactoryAdded(InaAccountFactory indexed factoryAddress);
    event FactoryRemoved(InaAccountFactory indexed factoryAddress);
    event TokenAdded(
        IERC20[] tokenAddresses,
        AggregatorV3Interface[] priceFeedAddresses
    );
    event TokenRemoved(IERC20[] tokenAddresses);
    event ProductAdded(IERC4626[] productAddresses);
    event ProductRemoved(IERC4626[] productAddresses);

    // Constants
    uint256 public constant VERSION = 1;
    uint256 public constant MAX_BATCH_SIZE = 100;

    constructor() Ownable(_msgSender()) {}

    /**
     * @dev Adds a new factory to the registry.
     * @param factoryAddress The address of the factory to add.
     * @notice This function only emits an event and does not store the factory address on-chain.
     */
    function addFactory(
        InaAccountFactory factoryAddress
    ) external onlyOwner whenNotPaused {
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
        InaAccountFactory factoryAddress
    ) external onlyOwner whenNotPaused {
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
    ) external onlyOwner whenNotPaused {
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
    ) external onlyOwner whenNotPaused {
        require(
            tokenAddresses.length > 0 &&
                tokenAddresses.length <= MAX_BATCH_SIZE,
            "Invalid token array length"
        );
        emit TokenRemoved(tokenAddresses);
    }

    /**
     * @dev Adds multiple products to the registry.
     * @param productAddresses An array of product addresses to add.
     * @notice This function only emits an event and does not store the product addresses on-chain.
     */
    function addProduct(
        IERC4626[] memory productAddresses
    ) external onlyOwner whenNotPaused {
        require(
            productAddresses.length > 0 &&
                productAddresses.length <= MAX_BATCH_SIZE,
            "Invalid product array length"
        );
        emit ProductAdded(productAddresses);
    }

    /**
     * @dev Removes multiple products from the registry.
     * @param productAddresses An array of product addresses to remove.
     * @notice This function only emits an event and does not remove any on-chain data.
     */
    function removeProduct(
        IERC4626[] memory productAddresses
    ) external onlyOwner whenNotPaused {
        require(
            productAddresses.length > 0 &&
                productAddresses.length <= MAX_BATCH_SIZE,
            "Invalid product array length"
        );
        emit ProductRemoved(productAddresses);
    }

    /**
     * @dev Pauses the contract, preventing certain operations from being executed.
     * @notice This function can only be called by the contract owner.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract, allowing normal operation to resume.
     * @notice This function can only be called by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
