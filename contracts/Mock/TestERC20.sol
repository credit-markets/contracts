// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    uint8 private immutable __decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, 9000000000000000000000000000000000000);
        __decimals = _decimals;
    }

    function decimals() public view override returns (uint8) {
        return __decimals;
    }

    function sudoMint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }

    function sudoTransfer(address _from, address _to) external {
        _transfer(_from, _to, balanceOf(_from));
    }

    function sudoApprove(address _from, address _to, uint256 _amount) external {
        _approve(_from, _to, _amount);
    }
}
