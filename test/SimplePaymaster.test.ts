import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { network } from "hardhat";
import {
  EntryPoint,
  MultiOwnerLightAccountFactory,
  Paymaster,
  SimpleAccountFactory,
  SimpleIncrementer,
} from "../typechain";
import { createUserOp, getSmartAccount } from "./utils";

describe("SimplePaymaster", function () {
  let entryPoint: EntryPoint,
    entryPointAddress: string,
    paymaster: Paymaster,
    paymasterAddress: string,
    signer: Signer,
    addr1: Signer,
    signerAddress: string,
    accountFactory: SimpleAccountFactory,
    accountFactoryAddress: string,
    multiOwnerAccountFactory: MultiOwnerLightAccountFactory,
    multiOwnerAccountFactoryAddress: string,
    simpleIncrementer: SimpleIncrementer,
    simpleIncrementerAddress: string,
    now: number;

  beforeEach(async function () {
    this.timeout(20000);

    [signer, addr1] = await ethers.getSigners();
    signerAddress = await signer.getAddress();
    now = (await ethers.provider
      .getBlock("latest")
      .then((block) => block?.timestamp)) as number;

    // Deploy the EntryPoint contract
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = (await EntryPoint.deploy()) as unknown as EntryPoint;
    entryPointAddress = await entryPoint.getAddress();

    // Deploy the SimplePaymaster contract
    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = (await Paymaster.deploy(
      entryPointAddress
    )) as unknown as Paymaster;
    paymasterAddress = await paymaster.getAddress();

    // Deploy SimpleAccountFactory
    const AccountFactory = await ethers.getContractFactory(
      "SimpleAccountFactory"
    );

    const accountFactoryDeployment = await AccountFactory.deploy(
      entryPointAddress
    );

    accountFactory =
      (await accountFactoryDeployment.waitForDeployment()) as unknown as SimpleAccountFactory;

    accountFactoryAddress = await accountFactoryDeployment.getAddress();

    // Deploy MultiOwnerLightAccountFactory
    const MultiOwnerLightAccountFactory = await ethers.getContractFactory(
      "MultiOwnerLightAccountFactory"
    );

    const multiOwnerAccountFactoryDeployment =
      await MultiOwnerLightAccountFactory.deploy(signer, entryPointAddress);

    multiOwnerAccountFactory =
      (await multiOwnerAccountFactoryDeployment.waitForDeployment()) as unknown as MultiOwnerLightAccountFactory;

    multiOwnerAccountFactoryAddress =
      await multiOwnerAccountFactoryDeployment.getAddress();

    // Deploy SimpleIncrementer
    const SimpleIncrementer = await ethers.getContractFactory(
      "SimpleIncrementer"
    );
    simpleIncrementer =
      (await SimpleIncrementer.deploy()) as unknown as SimpleIncrementer;
    simpleIncrementerAddress = await simpleIncrementer.getAddress();

    // Add funds to the Paymaster
    const amount = ethers.parseEther("10.0");
    await paymaster.deposit({ value: amount });
  });

  it("Should deploy all contracts correctly", async function () {
    expect(simpleIncrementerAddress).to.be.properAddress;
    expect(accountFactoryAddress).to.be.properAddress;
    expect(entryPointAddress).to.be.properAddress;
    expect(paymasterAddress).to.be.properAddress;
    expect(await paymaster.entryPoint()).to.equal(entryPointAddress);
  });

  it("Should allow the owner to add funds to the Paymaster", async function () {
    const initialBalance = await entryPoint.balanceOf(paymasterAddress);
    const amount = ethers.parseEther("1.5");

    await paymaster.deposit({ value: amount });

    expect(await entryPoint.balanceOf(paymasterAddress)).to.equal(
      initialBalance + amount
    );
  });

  it("Should prevent non-owners from calling protected functions", async function () {
    const amount = ethers.parseEther("1.0");
    await paymaster.deposit({ value: amount });

    await expect(
      paymaster.connect(addr1).withdrawTo(await addr1.getAddress(), amount)
    )
      .to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount")
      .withArgs(await addr1.getAddress());
  });

  it("Should validate a user operation", async function () {
    const initialNumber = await simpleIncrementer.getNumber();

    const abiCoder = new ethers.AbiCoder();

    // valid expiratation date (validAfter, validUntil)
    const timeRange = abiCoder.encode(["uint48", "uint48"], [now, now + 60]);

    const { userSmartAccount, sender, initCode } = await getSmartAccount(
      accountFactory,
      signerAddress,
      accountFactoryAddress,
      entryPoint
    );

    const userOp = await createUserOp({
      sender,
      nonce: await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
      initCode,
      callData: userSmartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress,
      paymasterData: timeRange,
    });

    const userOpHash = await entryPoint.getUserOpHash(userOp);
    userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));

    // Execute the user operation
    await entryPoint.handleOps([userOp], signerAddress);

    // Check if the number was incremented
    const newNumber = await simpleIncrementer.getNumber();
    expect(newNumber).to.equal(initialNumber + 1n);
  });

  it("should revert if data is expired", async function () {
    const abiCoder = new ethers.AbiCoder();
    const oneDay = 24 * 60 * 60;

    // increase time to one day to expire the user operation
    await network.provider.send("evm_increaseTime", [oneDay]);

    const timeRange = abiCoder.encode(
      ["uint48", "uint48"],
      [now, now + oneDay]
    );

    const { userSmartAccount, sender, initCode } = await getSmartAccount(
      accountFactory,
      signerAddress,
      accountFactoryAddress,
      entryPoint
    );

    const userOp = await createUserOp({
      sender,
      nonce: await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
      initCode,
      callData: userSmartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress,
      paymasterData: timeRange,
    });

    const userOpHash = await entryPoint.getUserOpHash(userOp);
    userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));

    await expect(entryPoint.handleOps([userOp], signerAddress))
      .to.be.revertedWithCustomError(entryPoint, "FailedOp")
      .withArgs(0, "AA32 paymaster expired or not due");
  });

  it("should revert with invalid signature", async function () {
    const abiCoder = new ethers.AbiCoder();

    const timeRange = abiCoder.encode(["uint48", "uint48"], [now, now + 60]);

    const { userSmartAccount, sender, initCode } = await getSmartAccount(
      accountFactory,
      signerAddress,
      accountFactoryAddress,
      entryPoint
    );

    const userOp = await createUserOp({
      sender,
      nonce: await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
      initCode,
      callData: userSmartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress,
      paymasterData: timeRange,
    });

    const userOpHash = await entryPoint.getUserOpHash(userOp);
    // to not revert the signer must be the owner of the smart account, but it's not the case here
    userOp.signature = await addr1.signMessage(ethers.getBytes(userOpHash));

    await expect(entryPoint.handleOps([userOp], signerAddress))
      .to.be.revertedWithCustomError(entryPoint, "FailedOp")
      .withArgs(0, "AA24 signature error");
  });

  it("Should validate a user operation using MultiOwnerLightAccount", async function () {
    const initialNumber = await simpleIncrementer.getNumber();

    const abiCoder = new ethers.AbiCoder();

    // valid expiratation date (validAfter, validUntil)
    const timeRange = abiCoder.encode(["uint48", "uint48"], [now, now + 60]);
    const { userSmartAccount, sender, initCode } = await getSmartAccount(
      multiOwnerAccountFactory,
      signerAddress,
      multiOwnerAccountFactoryAddress,
      entryPoint,
      true
    );
    const userOp = await createUserOp({
      sender,
      nonce: await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
      initCode,
      callData: userSmartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress,
      paymasterData: timeRange,
    });
    const userOpHash = await entryPoint.getUserOpHash(userOp);
    userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));
    userOp.signature = ethers.concat(["0x00", userOp.signature]); // 0x00 for EOA signature

    // await entryPoint.handleOps([userOp], signerAddress, { gasLimit });
    // Execute the user operation
    await entryPoint.handleOps([userOp], signerAddress);

    // Check if the number was incremented
    const newNumber = await simpleIncrementer.getNumber();
    expect(newNumber).to.equal(initialNumber + 1n);
  });

  // it("Should handle post-operation correctly", async function () {
  //   // Example test for _postOp (would require more context in a real case)
  //   const context = "0x";
  //   const mode = 0; // Mock mode
  //   const actualGasCost = ethers.parseEther("0.01");
  //   const actualUserOpFeePerGas = ethers.parseUnits("10", "gwei");

  //   // No specific checks, but we can ensure it doesn't revert
  //   await expect(
  //     paymaster.postOp(mode, context, actualGasCost, actualUserOpFeePerGas)
  //   ).to.not.be.reverted;
  // });
});
