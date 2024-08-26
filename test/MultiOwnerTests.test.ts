import { expect } from "chai";
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
  it.only("Should create a smart account and validate owner", async function () {
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
});
