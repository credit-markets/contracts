import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther, Signer } from "ethers";
import {
  EntryPoint,
  MultiOwnerLightAccountFactory,
  VerifyingPaymaster,
  SimpleIncrementer,
  VerifyingPaymaster__factory,
} from "../typechain";
import { createUserOp, getSmartAccount } from "./utils";

describe("VerifyingPaymaster", function () {
  let entryPoint: EntryPoint,
    entryPointAddress: string,
    paymaster: VerifyingPaymaster,
    paymasterAddress: string,
    signer: Signer,
    offchainSigner: Signer,
    signerAddress: string,
    multiOwnerAccountFactory: MultiOwnerLightAccountFactory,
    multiOwnerAccountFactoryAddress: string,
    simpleIncrementer: SimpleIncrementer,
    simpleIncrementerAddress: string,
    now: number;

  beforeEach(async function () {
    [signer, offchainSigner] = await ethers.getSigners();
    signerAddress = await signer.getAddress();
    now = (await ethers.provider
      .getBlock("latest")
      .then((block) => block?.timestamp)) as number;

    // Deploy the EntryPoint contract
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = (await EntryPoint.deploy()) as unknown as EntryPoint;
    entryPointAddress = await entryPoint.getAddress();

    // Deploy the VerifyingPaymaster contract
    paymaster = await new VerifyingPaymaster__factory(signer).deploy(
      entryPointAddress,
      await offchainSigner.getAddress()
    );

    paymasterAddress = await paymaster.getAddress();

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

    await paymaster.addStake(1, { value: parseEther("2") });
    await entryPoint.depositTo(paymasterAddress, { value: parseEther("1") });
  });

  it("Should deploy all contracts correctly", async function () {
    expect(simpleIncrementerAddress).to.be.properAddress;
    expect(entryPointAddress).to.be.properAddress;
    expect(paymasterAddress).to.be.properAddress;
    expect(await paymaster.entryPoint()).to.equal(entryPointAddress);
  });

  it("Should validate a user operation using VerifyingPaymaster", async function () {
    const initialNumber = await simpleIncrementer.getNumber();

    const abiCoder = new ethers.AbiCoder();

    const { userSmartAccount, sender, initCode } = await getSmartAccount(
      multiOwnerAccountFactory,
      signerAddress,
      multiOwnerAccountFactoryAddress,
      entryPoint,
      true
    );

    // userOp timestamp (validUntil, validAfter) and signature
    const paymasterData = ethers.concat([
      abiCoder.encode(["uint48", "uint48"], [now + 60, now]),
      "0x" + "00".repeat(65), // initially a valid signature is not required
    ]);

    // create userOp Data
    let userOp = await createUserOp({
      sender,
      nonce: await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
      initCode,
      callData: userSmartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress,
      paymasterData,
    });

    // get (userOp + validUntil + validAfter) hash
    const hash = await paymaster.getHash(userOp, now + 60, now);
    // sign hash using offchain signer
    let sig = await offchainSigner.signMessage(ethers.getBytes(hash));

    // create the same userOp data but passing offhain signer signature in the paymasterData
    userOp = await createUserOp({
      sender,
      nonce: await entryPoint.getNonce(await userSmartAccount.getAddress(), 0),
      initCode,
      callData: userSmartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress,
      paymasterData: ethers.concat([
        abiCoder.encode(["uint48", "uint48"], [now + 60, now]),
        sig, // offchain signer signature
      ]),
    });

    let userOpHash = await entryPoint.getUserOpHash(userOp);

    userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));

    userOp.signature = ethers.concat(["0x00", userOp.signature]); // 0x00 for EOA signature

    // Execute the user operation
    await entryPoint.handleOps([userOp], signerAddress);

    // Check if the number was incremented
    const newNumber = await simpleIncrementer.getNumber();
    expect(newNumber).to.equal(initialNumber + 1n);
  });
});
