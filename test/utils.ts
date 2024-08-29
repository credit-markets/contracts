import { ethers } from "hardhat";
import {
  SimpleAccount,
  SimpleAccountFactory,
  EntryPoint,
  MultiOwnerLightAccountFactory,
} from "../typechain";

// Pack PaymasterData
function packPaymasterData(
  paymaster: string,
  paymasterVerificationGasLimit: bigint,
  postOpGasLimit: bigint,
  paymasterData: string
): string {
  return paymaster == "0x" && paymasterData == "0x"
    ? "0x"
    : ethers.concat([
        paymaster,
        ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
        ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
        paymasterData,
      ]);
}

// Pack PaymasterData
function packTokenPaymasterData(
  paymaster: string,
  paymasterVerificationGasLimit: bigint,
  postOpGasLimit: bigint,
  paymasterData: bigint
): string {
  return paymaster == "0x"
    ? "0x"
    : ethers.concat([
        paymaster,
        ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
        ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
        ethers.zeroPadValue(ethers.toBeHex(paymasterData), 32),
      ]);
}

type CreateUserOpParams = {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  paymasterAddress: string;
  paymasterData?: string;
  tokenPaymasterData?: bigint;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
  isTokenPaymaster?: boolean; // Add the 'isTokenPaymaster' property
};

// Create UserOp
export async function createUserOp({
  sender,
  nonce,
  initCode,
  callData,
  paymasterAddress,
  paymasterData = "0x",
  tokenPaymasterData = 0n,
  paymasterVerificationGasLimit = 500000n,
  paymasterPostOpGasLimit = 100000n,
  isTokenPaymaster = false,
}: CreateUserOpParams) {
  if (isTokenPaymaster) {
    const userOp = {
      sender,
      nonce,
      initCode,
      callData,
      accountGasLimits: ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(500_000), 16),
        ethers.zeroPadValue(ethers.toBeHex(200_000), 16),
      ]),
      preVerificationGas: 500_000,
      gasFees: ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("5", "gwei")), 16),
        ethers.zeroPadValue(
          ethers.toBeHex(ethers.parseUnits("10", "gwei")),
          16
        ),
      ]),
      paymasterAndData: packTokenPaymasterData(
        paymasterAddress,
        paymasterVerificationGasLimit,
        paymasterPostOpGasLimit,
        tokenPaymasterData
      ),
      signature: "0x",
    };
    return userOp;
  }
  const userOp = {
    sender,
    nonce,
    initCode,
    callData,
    accountGasLimits: ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(500_000), 16),
      ethers.zeroPadValue(ethers.toBeHex(200_000), 16),
    ]),
    preVerificationGas: 500_000,
    gasFees: ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("5", "gwei")), 16),
      ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("10", "gwei")), 16),
    ]),
    paymasterAndData: packPaymasterData(
      paymasterAddress,
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
      paymasterData
    ),
    signature: "0x",
  };

  return userOp;
}

// Calculate sender address (smart account address)
export async function getSmartAccount(
  accountFactory: SimpleAccountFactory | MultiOwnerLightAccountFactory,
  signer: string,
  factoryAddress: string,
  entryPoint: EntryPoint,
  isMultiOwner = false
) {
  let sender = "";
  let initCodeFunction = "";

  if (isMultiOwner) {
    initCodeFunction = (
      accountFactory as MultiOwnerLightAccountFactory
    ).interface.encodeFunctionData("createAccount", [[signer], 0]);
  } else {
    initCodeFunction = (
      accountFactory as SimpleAccountFactory
    ).interface.encodeFunctionData("createAccount", [signer, 0]);
  }

  let initCode = ethers.concat([factoryAddress, initCodeFunction]);

  try {
    await entryPoint.getSenderAddress(initCode);
  } catch (ex: any) {
    sender = "0x" + ex.data.slice(-40);
  }

  const code = await ethers.provider.getCode(sender);
  if (code !== "0x") {
    initCode = "0x";
  }

  const userSmartAccount = await ethers.getContractAt(
    isMultiOwner ? "MultiOwnerLightAccount" : "SimpleAccount",
    sender
  );

  const userSmartAccountAddress: string = await userSmartAccount.getAddress();

  return { userSmartAccount, userSmartAccountAddress, sender, initCode };
}
