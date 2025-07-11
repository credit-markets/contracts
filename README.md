# INA Contracts

Smart contracts for the INA Credit Markets protocol, implementing investment pools, account abstraction, and compliance infrastructure on Arbitrum.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Building](#building)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contract Addresses](#contract-addresses)
- [Development Workflow](#development-workflow)
- [Security](#security)
- [Contributing](#contributing)

## Overview

INA Contracts is a comprehensive smart contract suite that powers the Credit Markets DeFi platform. The protocol enables:

- **Credit Market Pools**: ERC20-based investment pools for credit markets
- **Account Abstraction**: ERC-4337 smart wallet infrastructure
- **KYC/Compliance**: Integration with Ethereum Attestation Service (EAS)
- **Registry System**: Management of credit facilitators and attesters
- **Gasless Transactions**: Paymaster contracts for sponsored transactions

## Architecture

### Core Contracts

- **CMPool**: ERC20 investment pool implementation with deposit/withdrawal functionality
- **CMRegistry**: Registry for managing credit facilitators and EAS attesters
- **CMAccountFactory**: Factory for deploying smart wallets with account abstraction
- **InaAccount**: Modified Light Account implementation for user wallets
- **InaPaymaster**: Paymaster contract for gasless transactions

### Key Features

- **Dual Framework Support**: Both Hardhat and Foundry for maximum flexibility
- **Account Abstraction**: Full ERC-4337 implementation with Light Account
- **Type Safety**: TypeChain-generated TypeScript bindings
- **Upgradeable Contracts**: Proxy patterns for future upgrades
- **Security**: OpenZeppelin contracts and ReentrancyGuard patterns

## Prerequisites

- **Node.js**: Latest LTS version
- **pnpm**: v10.8.0 or higher (specified package manager)
- **Foundry**: Latest version (forge, anvil, cast)
- **Git**: For cloning the repository

### Install Foundry

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ina-contracts
```

2. Install dependencies:
```bash
pnpm install
```

3. Install Foundry dependencies:
```bash
forge install
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Environment Setup

### Required Environment Variables

```bash
# Deployer private key (KEEP SECRET!)
PRIVATE_KEY="0x..."

# Etherscan API key for contract verification
ETHERSCAN_API_KEY="your_etherscan_api_key"

# Alchemy API key for RPC services
ALCHEMY_API_KEY="your_alchemy_api_key"
```

### Optional Environment Variables

```bash
# ERC-4337 EntryPoint address (default: 0x0000000071727De22E5E9d8BAf0edAc6f37da032)
ENTRYPOINT="0x..."

# Factory owner address
OWNER="0x..."

# Account factory stake requirements
REQUIRED_STAKE_AMOUNT="0.1"
UNSTAKE_DELAY_SEC="86400"
```

See `.env.example` for complete documentation of all environment variables.

## Building

### Compile with both frameworks:

```bash
# Hardhat compilation
npx hardhat compile

# Foundry compilation
forge build

# Generate TypeChain bindings
pnpm run typechain
```

### Clean build artifacts:

```bash
npx hardhat clean
forge clean
```

## Testing

### Run all tests:

```bash
# Hardhat tests
npx hardhat test

# Foundry tests
forge test

# Run specific test file
npx hardhat test test/CMPool.test.ts
forge test --match-contract CMPoolTest
```

### Test with coverage:

```bash
# Hardhat coverage
npx hardhat coverage

# Foundry coverage
forge coverage
```

### Gas reporting:

```bash
# Enable gas reporting
REPORT_GAS=true npx hardhat test
```

## Deployment

### Deploy to Arbitrum Sepolia:

```bash
# Deploy Registry
pnpm run deploy-registry

# Deploy Account Factory
pnpm run deploy-factory

# Deploy Pool (example)
pnpm run deploy-pool

# Deploy Upgradeable Registry
pnpm run deploy-registry-upgradable
```

### Verify contracts:

```bash
npx hardhat verify --network arbitrumSepolia DEPLOYED_CONTRACT_ADDRESS "Constructor Arg 1" "Constructor Arg 2"
```

### Custom deployment:

```bash
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

## Contract Addresses

### Arbitrum Sepolia (Testnet)

| Contract | Address | Description |
|----------|---------|-------------|
| CMRegistry | `[To be deployed]` | Credit facilitator registry |
| CMAccountFactory | `[To be deployed]` | Smart wallet factory |
| InaPaymaster | `[To be deployed]` | Gasless transaction sponsor |
| EntryPoint | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 EntryPoint v0.7 |

*Note: Update these addresses after deployment*

## Development Workflow

### 1. Local Development

```bash
# Start local Hardhat node
npx hardhat node

# Or start Anvil (Foundry)
anvil

# Deploy to local network
npx hardhat run scripts/deploy.ts --network localhost
```

### 2. Fork Testing

```bash
# Fork Arbitrum Sepolia for testing
npx hardhat node --fork https://sepolia-rollup.arbitrum.io/rpc

# Run tests against fork
npx hardhat test --network localhost
```

### 3. TypeScript Development

```bash
# Generate TypeChain bindings after contract changes
pnpm run typechain

# Use generated types in scripts
import { CMPool__factory } from "../typechain-types";
```

## Security

### Best Practices

1. **Auditing**: All contracts should be audited before mainnet deployment
2. **Testing**: Comprehensive test coverage (aim for >90%)
3. **Access Control**: Proper role-based permissions
4. **Upgradability**: Use proxy patterns carefully
5. **External Calls**: Validate all external contract interactions

### Security Features

- OpenZeppelin security contracts
- ReentrancyGuard for state-changing functions
- Role-based access control
- EAS integration for KYC compliance
- Signature verification for account abstraction

### Reporting Security Issues

Please report security vulnerabilities privately to the team. Do not create public issues for security concerns.

## Scripts Overview

| Script | Purpose | Command |
|--------|---------|---------|
| `deploy-registry.ts` | Deploy CMRegistry contract | `pnpm run deploy-registry` |
| `deploy-factory.ts` | Deploy account factory | `pnpm run deploy-factory` |
| `deploy-pool.ts` | Deploy investment pool | `pnpm run deploy-pool` |
| `3_createPool.ts` | Create new pool instance | `npx hardhat run scripts/3_createPool.ts` |
| `10_sendDev.ts` | Send dev tokens | `npx hardhat run scripts/10_sendDev.ts` |

## Project Structure

```
ina-contracts/
├── contracts/          # Solidity source files
│   ├── pools/         # Pool contracts
│   ├── registry/      # Registry contracts
│   ├── accounts/      # Account abstraction
│   └── interfaces/    # Contract interfaces
├── scripts/           # Deployment and operational scripts
├── test/             # Test files (TypeScript)
├── lib/              # Foundry dependencies
├── artifacts/        # Hardhat compilation artifacts
├── out/              # Foundry compilation artifacts
├── typechain-types/  # Generated TypeScript bindings
├── hardhat.config.ts # Hardhat configuration
├── foundry.toml      # Foundry configuration
└── package.json      # Node dependencies
```

## Troubleshooting

### Common Issues

1. **Compilation errors**: Ensure both Hardhat and Foundry are properly installed
2. **Missing dependencies**: Run `pnpm install` and `forge install`
3. **TypeChain errors**: Regenerate bindings with `pnpm run typechain`
4. **Network issues**: Check RPC URL and network configuration
5. **Gas estimation**: Ensure account has sufficient funds

### Debug Mode

```bash
# Run Hardhat in verbose mode
npx hardhat compile --verbose

# Run Foundry with debug output
forge build -vvvv
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow Solidity style guide
- Write comprehensive tests
- Document all functions
- Use TypeScript for scripts
- Update TypeChain bindings
- Maintain high test coverage

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Arbitrum Documentation](https://docs.arbitrum.io/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.