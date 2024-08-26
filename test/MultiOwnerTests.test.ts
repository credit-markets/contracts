import { expect, use } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { network } from "hardhat";
import {
  EntryPoint,
  MultiOwnerLightAccountFactory,
  Paymaster,
  MultiOwnerLightAccount,
  SimpleIncrementer,
} from "../typechain";
import { createUserOp, getSmartAccount } from "./utils";

describe("SimplePaymaster", function () {
  let entryPoint: EntryPoint,
    entryPointAddress: string,
    signer: Signer,
    addr1: Signer,
    signerAddress: string,
    multiOwnerAccountFactory: MultiOwnerLightAccountFactory,
    multiOwnerLightAccount: MultiOwnerLightAccount,
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
  });

  it("Should deploy all contracts correctly", async function () {
    expect(simpleIncrementerAddress).to.be.properAddress;
    expect(multiOwnerAccountFactoryAddress).to.be.properAddress;
    expect(entryPointAddress).to.be.properAddress;
  });
  it("Should create a smart account and validate owner", async function () {
    const txPopulated = await multiOwnerAccountFactory.createAccountSingle(
      signerAddress,
      0
    );
    delete txPopulated.gasPrice;
    let txReceipt = await ethers.provider.send("eth_call", [txPopulated]);
    const smartAccountAddress = "0x" + txReceipt.slice(-40);
    multiOwnerLightAccount = (await ethers.getContractAt(
      "MultiOwnerLightAccount",
      smartAccountAddress
    )) as unknown as MultiOwnerLightAccount;
    const owner = await multiOwnerLightAccount.owners();
    expect(smartAccountAddress).to.be.properAddress;
    expect(owner[0]).to.be.equal(signerAddress);
  });
  describe("MultipleOwners", function () {
    let senderAddress: string;
    beforeEach(async function () {
      const txPopulated = await multiOwnerAccountFactory.createAccountSingle(
        signerAddress,
        0
      );
      delete txPopulated.gasPrice;
      let txReceipt = await ethers.provider.send("eth_call", [txPopulated]);
      const smartAccountAddress = "0x" + txReceipt.slice(-40);
      const previousOwner = await multiOwnerLightAccount.owners();
      multiOwnerLightAccount = (await ethers.getContractAt(
        "MultiOwnerLightAccount",
        smartAccountAddress
      )) as unknown as MultiOwnerLightAccount;
      //   const checkResult = await multiOwnerLightAccount
      //     .connect(signer)
      //     .updateOwners([await addr1.getAddress()], []);
      //   const owner = await multiOwnerLightAccount.owners();
      const addOwnerData = multiOwnerLightAccount.interface.encodeFunctionData(
        "updateOwners",
        [[await addr1.getAddress()], []]
      );
      const { userSmartAccount, sender, initCode } = await getSmartAccount(
        multiOwnerAccountFactory,
        signerAddress,
        multiOwnerAccountFactoryAddress,
        entryPoint,
        true
      );
      senderAddress = sender;
      //The MultiOwnerLightAccount and preCalculated userSmartAccount should be the same
      expect(await multiOwnerLightAccount.getAddress()).to.be.equal(
        await userSmartAccount.getAddress()
      );

      entryPoint.depositTo(await userSmartAccount.getAddress(), {
        value: ethers.parseEther("1"),
      });

      const userOp = await createUserOp({
        sender,
        nonce: await entryPoint.getNonce(
          await userSmartAccount.getAddress(),
          0
        ),
        initCode,
        callData: addOwnerData,
        paymasterAddress: "0x",
        paymasterData: "0x",
      });
      const userOpHash = await entryPoint.getUserOpHash(userOp);
      userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));
      userOp.signature = ethers.concat(["0x00", userOp.signature]); // 0x00 for EOA signature
      await entryPoint.handleOps([userOp], signerAddress);
      const owner = await multiOwnerLightAccount.owners();
      expect(owner[0]).to.be.equal(await addr1.getAddress());
      expect(owner[1]).to.be.equal(signerAddress);
    });
    it("Should call Increment contract sucessfully", async function () {
      const initialNumber = await simpleIncrementer.getNumber();

      const userOp = await createUserOp({
        sender: senderAddress,
        nonce: await entryPoint.getNonce(
          await multiOwnerLightAccount.getAddress(),
          0
        ),
        initCode: "0x",
        callData: multiOwnerLightAccount.interface.encodeFunctionData(
          "execute",
          [
            await simpleIncrementer.getAddress(),
            0,
            simpleIncrementer.interface.encodeFunctionData("increment"),
          ]
        ),
        paymasterAddress: "0x",
        paymasterData: "0x",
      });
      // Sign the user operation
      const userOpHashIncrement = await entryPoint.getUserOpHash(userOp);
      let signatureIncrement = await addr1.signMessage(
        ethers.getBytes(userOpHashIncrement)
      );
      userOp.signature = ethers.concat(["0x00", signatureIncrement]); // 0x00 for EOA signature

      // Execute the user operation
      await entryPoint.handleOps([userOp], await addr1.getAddress());

      // Check if the number was incremented
      const newNumber = await simpleIncrementer.getNumber();
      expect(newNumber).to.equal(initialNumber + 1n);
    });
  });
});
