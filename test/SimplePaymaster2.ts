import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  EntryPoint,
  SimplePaymaster,
  SimpleAccountFactory,
  SimpleAccount,
  SimpleIncrementer
} from "../typechain";

describe("Paymaster Test Suite", function () {
  let entryPoint: EntryPoint;
  let paymaster: SimplePaymaster;
  let accountFactory: SimpleAccountFactory;
  let simpleIncrementer: SimpleIncrementer;
  let owner: Signer;
  let userSmartAccount: SimpleAccount;
  let sender;
  let initCode;

  async function deployFixture() {
    [owner] = await ethers.getSigners();

    console.log("Deploying contracts...");

    // Deploy EntryPoint
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPointFactory.deploy() as unknown as EntryPoint;
    console.log("EntryPoint deployed to:", await entryPoint.getAddress());

    // Deploy SimplePaymaster
    const PaymasterFactory = await ethers.getContractFactory("SimplePaymaster");
    paymaster = await PaymasterFactory.deploy(await entryPoint.getAddress()) as unknown as SimplePaymaster;
    console.log("SimplePaymaster deployed to:", await paymaster.getAddress());

    // Deploy SimpleAccountFactory
    const AccountFactoryFactory = await ethers.getContractFactory("SimpleAccountFactory");
    accountFactory = await AccountFactoryFactory.deploy(await entryPoint.getAddress()) as unknown as SimpleAccountFactory;
    console.log("SimpleAccountFactory deployed to:", await accountFactory.getAddress());

    // Deploy SimpleIncrementer
    const SimpleIncrementerFactory = await ethers.getContractFactory("SimpleIncrementer");
    simpleIncrementer = await SimpleIncrementerFactory.deploy() as unknown as SimpleIncrementer;
    console.log("SimpleIncrementer deployed to:", await simpleIncrementer.getAddress());

    // Calculate sender address (smart account address)
    const userAddress = await owner.getAddress();
    const factoryAddress = await accountFactory.getAddress();
    const initCodeFunction = accountFactory.interface.encodeFunctionData("createAccount", [userAddress, 0]);
    initCode = ethers.concat([
      factoryAddress,
      initCodeFunction
    ]);

    try {
      await entryPoint.getSenderAddress(initCode);
    } catch (ex: any) {
      sender = "0x" + ex.data.slice(-40);
    }

    const code = await ethers.provider.getCode(sender);
    if (code !== "0x") {
      initCode = "0x";
    }
    console.log({ sender, initCode });

    userSmartAccount = await ethers.getContractAt("SimpleAccount", sender) as unknown as SimpleAccount;
    console.log("UserSmartAccount address:", await userSmartAccount.getAddress());

    // Fund the paymaster
    console.log("Funding paymaster...");
    const depositAmount = ethers.parseEther("2.0"); // Adjust this amount based on your needs
    await entryPoint.depositTo(await paymaster.getAddress(), { value: depositAmount });

    console.log("Paymaster funded");

    // Verify paymaster balance
    const paymasterBalance = await ethers.provider.getBalance(await paymaster.getAddress());
    console.log("Paymaster balance:", ethers.formatEther(paymasterBalance));

    return { entryPoint, paymaster, accountFactory, simpleIncrementer, owner, userSmartAccount, sender, initCode };
  }

  beforeEach(async function () {
    console.log("Running beforeEach hook...");
    ({ entryPoint, paymaster, accountFactory, simpleIncrementer, owner, userSmartAccount, sender, initCode } = await loadFixture(deployFixture));
    console.log("beforeEach hook completed");
  });

  it("Should deploy all contracts correctly", async function () {
    expect(await entryPoint.getAddress()).to.be.properAddress;
    expect(await paymaster.getAddress()).to.be.properAddress;
    expect(await accountFactory.getAddress()).to.be.properAddress;
    expect(await simpleIncrementer.getAddress()).to.be.properAddress;
    expect(await userSmartAccount.getAddress()).to.be.properAddress;
  });

  function packPaymasterData(
    paymaster: string,
    paymasterVerificationGasLimit: bigint,
    postOpGasLimit: bigint,
    paymasterData: string
  ): string {
    return ethers.concat([
      paymaster,
      ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
      ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
      paymasterData
    ]);
  }

  async function createUserOp(
    sender: string,
    nonce: bigint,
    initCode: string,
    callData: string,
    paymaster: SimplePaymaster
  ) {
    const paymasterVerificationGasLimit = 500000n;
    const paymasterPostOpGasLimit = 100000n;
    const paymasterData = "0x";

    const userOp = {
      sender,
      nonce,
      initCode,
      callData,
      accountGasLimits: ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(500_000), 16),
        ethers.zeroPadValue(ethers.toBeHex(200000), 16)
      ]),
      preVerificationGas: 100_000,
      gasFees: ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("5", "gwei")), 16),
        ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("10", "gwei")), 16)
      ]),
      paymasterAndData: packPaymasterData(
        await paymaster.getAddress(),
        paymasterVerificationGasLimit,
        paymasterPostOpGasLimit,
        paymasterData
      ),
      signature: "0x"
    };

    return userOp;
  }


  // it("Should increment using smart account and paymaster", async function () {
  //   const initialNumber = await simpleIncrementer.getNumber();

  //   const userOp = await createUserOp(
  //     await userSmartAccount.getAddress(),
  //     await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
  //     initCode,
  //     userSmartAccount.interface.encodeFunctionData("execute", [
  //       await simpleIncrementer.getAddress(),
  //       0,
  //       simpleIncrementer.interface.encodeFunctionData("increment"),
  //     ]),
  //     paymaster
  //   );

  //   // Sign the user operation
  //   const userOpHash = await entryPoint.getUserOpHash(userOp);
  //   userOp.signature = await owner.signMessage(ethers.getBytes(userOpHash));

  //   // Execute the user operation
  //   await entryPoint.handleOps([userOp], await owner.getAddress());

  //   // Check if the number was incremented
  //   const newNumber = await simpleIncrementer.getNumber();
  //   expect(newNumber).to.equal(initialNumber + 1n);
  // });

  // it.only("Should fail to increment if paymaster has insufficient funds", async function () {
  //   // Get the paymaster's initial balance
  //   const paymasterBalance = await entryPoint.balanceOf(await paymaster.getAddress());

  //   // Withdraw all funds from the paymaster
  //   await paymaster.connect(owner).withdrawTo(await owner.getAddress(), paymasterBalance);

  //   // Verify the paymaster's balance is now 0
  //   const newBalance = await entryPoint.balanceOf(await paymaster.getAddress());
  //   expect(newBalance).to.equal(0n);

  //   // Create a user operation to increment the counter (which should fail due to insufficient funds)
  //   const incrementUserOp = await createUserOp(
  //     await userSmartAccount.getAddress(),
  //     await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
  //     "0x", // initCode is empty string as the account is already deployed
  //     userSmartAccount.interface.encodeFunctionData("execute", [
  //       await simpleIncrementer.getAddress(),
  //       0,
  //       simpleIncrementer.interface.encodeFunctionData("increment")
  //     ]),
  //     paymaster
  //   );

  //   // Sign the increment user operation
  //   const incrementUserOpHash = await entryPoint.getUserOpHash(incrementUserOp);
  //   incrementUserOp.signature = await owner.signMessage(ethers.getBytes(incrementUserOpHash));

  //   // Expect the operation to fail due to insufficient paymaster funds
  //   await expect(entryPoint.handleOps([incrementUserOp], await owner.getAddress()))
  //     .to.be.revertedWithCustomError(entryPoint, "FailedOp")
  //     .withArgs(0, "AA31 paymaster deposit too low");
  // });

  // it("Should allow only the owner to withdraw funds from the paymaster", async function () {
  //   const initialBalance = await ethers.provider.getBalance(await paymaster.getAddress());
  //   const withdrawAmount = ethers.parseEther("0.5");

  //   // Make sure the paymaster has enough funds
  //   if (initialBalance < withdrawAmount) {
  //     await owner.sendTransaction({
  //       to: await paymaster.getAddress(),
  //       value: withdrawAmount - initialBalance,
  //     });
  //   }

  //   // Owner should be able to withdraw
  //   await expect(paymaster.connect(owner).withdrawTo(await owner.getAddress(), withdrawAmount))
  //     .to.changeEtherBalances(
  //       [paymaster, owner],
  //       [-withdrawAmount, withdrawAmount]
  //     );

  //   // Non-owner should not be able to withdraw
  //   await expect(paymaster.connect(user).withdrawTo(await user.getAddress(), withdrawAmount))
  //     .to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount")
  //     .withArgs(await user.getAddress());
  // });
});
