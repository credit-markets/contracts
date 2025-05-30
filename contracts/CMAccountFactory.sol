// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {BaseLightAccountFactory} from "light-account/common/BaseLightAccountFactory.sol";
import {LibClone} from "light-account/external/solady/LibClone.sol";
import {MultiOwnerLightAccount} from "light-account/MultiOwnerLightAccount.sol";

/// @title CMAccountFactory - A factory contract for MultiOwnerLightAccount.
/// @dev This factory contract creates MultiOwnerLightAccount instances and emits an event when a new account is created.
contract CMAccountFactory is BaseLightAccountFactory {
    uint256 internal constant _MAX_OWNERS_ON_CREATION = 100;
    MultiOwnerLightAccount public immutable ACCOUNT_IMPLEMENTATION;

    // Event emitted when a new account is created
    event AccountCreated(address indexed accountAddress, address[] owners);

    error InvalidOwners();
    error OwnersArrayEmpty();
    error OwnersLimitExceeded();

    constructor(address owner, IEntryPoint entryPoint) Ownable(owner) {
        _verifyEntryPointAddress(address(entryPoint));
        ACCOUNT_IMPLEMENTATION = new MultiOwnerLightAccount(entryPoint);
        ENTRY_POINT = entryPoint;
    }

    /// @notice Create an account, and return its address. Returns the address even if the account is already deployed.
    /// @dev During UserOperation execution, this method is called only if the account is not deployed. This method
    /// returns an existing account address so that `entryPoint.getSenderAddress()` would work even after account
    /// creation.
    /// @param owners The owners of the account to be created.
    /// @param salt A salt, which can be changed to create multiple accounts with the same owners.
    /// @return account The address of either the newly deployed account or an existing account with these owners and salt.
    function createAccount(
        address[] calldata owners,
        uint256 salt
    ) external returns (MultiOwnerLightAccount account) {
        _validateOwnersArray(owners);

        (bool alreadyDeployed, address accountAddress) = LibClone
            .createDeterministicERC1967(
                address(ACCOUNT_IMPLEMENTATION),
                _getCombinedSalt(owners, salt)
            );

        account = MultiOwnerLightAccount(payable(accountAddress));

        if (!alreadyDeployed) {
            account.initialize(owners);
            // Emit AccountCreated event when a new account is initialized
            emit AccountCreated(accountAddress, owners);
        }
    }

    /// @notice Create an account, and return its address. Returns the address even if the account is already deployed.
    /// @dev This method uses less calldata than `createAccount` when creating accounts with a single initial owner.
    /// @param owner The owner of the account to be created.
    /// @param salt A salt, which can be changed to create multiple accounts with the same owner.
    /// @return account The address of either the newly deployed account or an existing account with this owner and salt.
    function createAccountSingle(
        address owner,
        uint256 salt
    ) external returns (MultiOwnerLightAccount account) {
        if (owner == address(0)) {
            revert InvalidOwners();
        }

        address[] memory owners = new address[](1);
        owners[0] = owner;

        (bool alreadyDeployed, address accountAddress) = LibClone
            .createDeterministicERC1967(
                address(ACCOUNT_IMPLEMENTATION),
                _getCombinedSalt(owners, salt)
            );

        account = MultiOwnerLightAccount(payable(accountAddress));

        if (!alreadyDeployed) {
            account.initialize(owners);
            // Emit AccountCreated event when a new account is initialized
            emit AccountCreated(accountAddress, owners);
        }
    }

    /// @notice Calculate the counterfactual address of this account as it would be returned by `createAccount`.
    /// @param owners The owners of the account to be created.
    /// @param salt A salt, which can be changed to create multiple accounts with the same owners.
    /// @return The address of the account that would be created with `createAccount`.
    function getAddress(
        address[] memory owners,
        uint256 salt
    ) external view returns (address) {
        _validateOwnersArray(owners);

        return
            LibClone.predictDeterministicAddressERC1967(
                address(ACCOUNT_IMPLEMENTATION),
                _getCombinedSalt(owners, salt),
                address(this)
            );
    }

    /// @notice Compute the hash of the owner and salt in scratch space memory.
    /// @param owners The owners of the account to be created.
    /// @param salt A salt, which can be changed to create multiple accounts with the same owner.
    /// @return combinedSalt The hash of the owner and salt.
    function _getCombinedSalt(
        address[] memory owners,
        uint256 salt
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(owners, salt));
    }

    /// @dev `owners` must be in strictly ascending order and not include the 0 address. The ordering requirement
    /// ensures a canonical counterfactual for a given set of initial owners. Also, its length must not be empty
    /// and not exceed `_MAX_OWNERS_ON_CREATION`.
    /// @param owners Array of owner addresses.
    function _validateOwnersArray(address[] memory owners) internal pure {
        if (owners.length == 0) {
            revert OwnersArrayEmpty();
        }

        // This protects against counterfactuals being generated against an exceptionally large number of owners
        // that may exceed the block gas limit when actually creating the account.
        if (owners.length > _MAX_OWNERS_ON_CREATION) {
            revert OwnersLimitExceeded();
        }

        address prevOwner;
        uint256 length = owners.length;
        for (uint256 i = 0; i < length; ++i) {
            if (owners[i] <= prevOwner) {
                revert InvalidOwners();
            }
            prevOwner = owners[i];
        }
    }
}
