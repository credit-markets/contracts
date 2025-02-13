# Ina Contracts

This repository contains the smart contracts for the Ina project. It uses both Hardhat and Foundry for development and testing.

## Prerequisites

- Node.js and npm
- Foundry (forge, anvil, and cast)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/INA-protocol/Ina-contracts.git
cd Ina-contracts
```

2. Install dependencies:

```bash
npm install
```

## Building

To build the contracts, you'll need to run both Foundry and Hardhat builds:

```bash
# Build with Foundry
forge build

# Build with Hardhat
npx hardhat compile
```

## Running Scripts

To run a script:

```bash
npx hardhat run scripts/example-script.js
```

## Testing

```bash
# Run Hardhat tests
npx hardhat test

# Run Foundry tests
forge test
```

## License

[License Type] - See LICENSE file for details
