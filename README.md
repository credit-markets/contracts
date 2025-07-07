# CM Contracts: Credit Markets Protocol

A comprehensive smart contract ecosystem for decentralized credit markets with Account Abstraction integration, KYC attestations, and investment pooling.

## Overview

The Credit Markets Protocol enables decentralized credit markets through three core components:

- **CMRegistry**: Central registry managing factories, tokens, pools, and KYC attestations via Ethereum Attestation Service (EAS)
- **CMPool**: Investment pools with ERC4626 compliance, KYC verification, and automated distribution
- **CMAccountFactory**: Factory for creating MultiOwnerLightAccount instances with Account Abstraction support

## Architecture

### Core Contracts

#### CMRegistry

- Manages protocol-wide configurations and permissions
- Integrates with Ethereum Attestation Service (EAS) for KYC verification
- Handles role-based access control (Attester, Operator, Credit Facilitator)
- Emits events for off-chain indexing of factories, tokens, and pools

#### CMPool

- ERC4626-compliant investment pools with custom logic
- KYC-gated investments using EAS attestations
- Automated fund distribution with threshold mechanisms
- Non-transferable shares to prevent secondary markets
- Built-in fee collection and repayment handling

#### CMAccountFactory

- Creates MultiOwnerLightAccount instances for Account Abstraction
- Supports multiple owners per account
- Deterministic address generation
- Integration with ERC-4337 EntryPoint

### Key Features

- **Account Abstraction**: Full ERC-4337 support via Light Account integration
- **KYC Integration**: EAS-based attestation system for compliance
- **Investment Pooling**: Sophisticated pool mechanics with thresholds and automated distributions
- **Role Management**: Granular permission system for different protocol participants
- **Oracle Integration**: Chainlink price feed support for token valuations

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org/) v18+
- [Git](https://git-scm.com/)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/credit-markets/contracts.git
cd contracts
```

2. Install Foundry dependencies:

```bash
forge install
```

3. Install Node.js dependencies (if using TypeScript tests):

```bash
npm install
```

## Building

```bash
# Build all contracts
forge build

# Build with size optimization
forge build --sizes
```

## Testing

```bash
# Run all Foundry tests
forge test

# Run tests with verbosity
forge test -vvv

# Run specific test file
forge test --match-path test/CMRegistry.test.sol

# Run TypeScript tests (if available)
npm test
```

## Deployment

### Local Development

1. Start local blockchain:

```bash
anvil
```

2. Deploy contracts:

```bash
# Deploy registry
forge script script/DeployRegistry.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy factory
forge script script/DeployCMAccountFactory.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy pool
forge script script/DeployCMPool.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Testnet Deployment

1. Set up environment variables:

```bash
export PRIVATE_KEY=your_private_key
export ARBISCAN_API_KEY=your_arbiscan_api_key
```

2. Deploy to Arbitrum Sepolia:

```bash
forge script script/DeployRegistry.s.sol --rpc-url arbitrum_sepolia --broadcast --verify
```

## Configuration

### Environment Variables

- `PRIVATE_KEY`: Deployer private key
- `ARBISCAN_API_KEY`: Arbiscan API key for contract verification
- `RPC_URL`: Custom RPC endpoint (optional)

### Foundry Configuration

The project uses `foundry.toml` for configuration:

- Source directory: `contracts/`
- Output directory: `out/`
- Test directory: `test/`
- Cache directory: `cache_forge/`

## Contract Addresses

### Arbitrum Sepolia

========================================
DEPLOYMENT COMPLETE
========================================

CORE CONTRACTS:

---

SchemaRegistry: 0xC07006a7302974E8Afb7f00A7290dc383183ca78
EAS: 0xe4205c5fb63249aB8Fa09350eaF2eC4f2f4ae562
CMRegistry: 0x9FB7f6EE9aAe78689d06Ff4a7477440A620b21B7
CMAccountFactory: 0x28299D5bd9Ba2Ff02262F6EeC511bc457C9C8068
CMPool: 0xBB840A608a8Ae1f2a2C44B54788cC3452a82fe65

CONFIGURATION:

---

Schema ID:
0xf5bd2195e0f1ba7f62373334a223109769b179cb717363089926ffbd9637630d
EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
Fee Receiver: 0x26b0D6F8F405EaCBd5632A5B0290E7Ca286456De
Attester: 0xC8d915D6410c373aF328d0E413d6BBC31Eb9d5Aa

========================================

## Security

- All contracts use OpenZeppelin's security patterns
- Role-based access control throughout
- Reentrancy protection on critical functions
- Input validation and overflow protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Ethereum Attestation Service](https://docs.attest.sh/)
- [ERC-4626 Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
