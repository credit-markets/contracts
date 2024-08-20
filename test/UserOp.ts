import { ethers } from "hardhat";
import { BigNumberish } from "ethers";

// Define the interface for UserOp
interface UserOp {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  callGasLimit: BigNumberish | number;
  verificationGasLimit: BigNumberish | number;
  preVerificationGas: BigNumberish | number;
  maxFeePerGas: BigNumberish | number;
  maxPriorityFeePerGas: BigNumberish | number;
  paymaster: string;
  paymasterData: string;
  paymasterVerificationGasLimit: BigNumberish | number;
  paymasterPostOpGasLimit: BigNumberish | number;
  signature: string;
}

// Export DefaultsForUserOp with the UserOp type
export const DefaultsForUserOp: UserOp = {
  sender: ethers.ZeroAddress, // ethers.AddressZero is now ethers.constants.AddressZero
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9, // Using BigNumber for large numbers
  paymaster: ethers.ZeroAddress,
  paymasterData: "0x",
  paymasterVerificationGasLimit: 3e5, // Using BigNumber for large numbers
  paymasterPostOpGasLimit: 0,
  signature: "0x",
};
