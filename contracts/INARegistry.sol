// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Registry {
    // Event emitted when a new factory is added to the registry
    event FactoryAdded(address indexed factoryAddress);

    // Event emitted when a factory is removed from the registry
    event FactoryRemoved(address indexed factoryAddress);

    // Event emitted when multiple tokens are added to the token list
    event TokenAdded(address[] tokenAddresses);

    // Event emitted when multiple tokens are removed from the token list
    event TokenRemoved(address[] tokenAddresses);

    // Event emitted when products are added to the platform
    event ProductAdded(address[] productAddresses);

    // Event emitted when products are removed from the platform
    event ProductRemoved(address[] productAddresses);

    // Function to add a factory to the registry (emit only event)
    function addFactory(address factoryAddress) external {
        require(factoryAddress != address(0), "Factory address cannot be zero");
        emit FactoryAdded(factoryAddress);
    }

    // Function to remove a factory from the registry (emit only event)
    function removeFactory(address factoryAddress) external {
        require(factoryAddress != address(0), "Factory address cannot be zero");
        emit FactoryRemoved(factoryAddress);
    }

    // Function to add multiple tokens to the token list (emit only event)
    function addToken(address[] memory tokenAddresses) external {
        require(tokenAddresses.length > 0, "Token address array is empty");
        emit TokenAdded(tokenAddresses);
    }

    // Function to remove multiple tokens from the token list (emit only event)
    function removeToken(address[] memory tokenAddresses) external {
        require(tokenAddresses.length > 0, "Token address array is empty");
        emit TokenRemoved(tokenAddresses);
    }

    // Function to add products to the platform (emit only event)
    function addProduct(address[] memory productAddresses) external {
        require(productAddresses.length > 0, "Product address array is empty");
        emit ProductAdded(productAddresses);
    }

    // Function to remove products from the platform (emit only event)
    function removeProduct(address[] memory productAddresses) external {
        require(productAddresses.length > 0, "Product address array is empty");
        emit ProductRemoved(productAddresses);
    }
}
