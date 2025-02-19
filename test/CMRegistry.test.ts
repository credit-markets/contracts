// test/Registry.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { Contract, ContractFactory, Signer } from "ethers";
import { BytesLike } from "ethers";

import {
  Registry,
  EAS,
  CMAccountFactory,
  ERC20,
  EntryPoint,
  TestOracle2,
} from "../typechain";
import { Test } from "mocha";

describe("Registry Contract", function () {
  let Registry: ContractFactory;
  let registry: Registry;
  let EAS: ContractFactory;
  let eas: EAS;
  let CMAccountFactory: ContractFactory;
  let cmAccountFactory: CMAccountFactory;
  let ERC20: ContractFactory;
  let token1: ERC20;
  let token2: ERC20;
  let entryPoint: EntryPoint;
  let entryPointAddress: string;
  let PriceFeedMock: ContractFactory;
  let priceFeed1: TestOracle2;
  let priceFeed2: TestOracle2;
  let owner: Signer;
  let admin: Signer;
  let attester: Signer;
  let operator: Signer;
  let feeReceiver: Signer;
  let user1: Signer;
  let user2: Signer;
  let kycSchemaUID: BytesLike;

  before(async function () {
    [owner, admin, attester, operator, feeReceiver, user1, user2] =
      await ethers.getSigners();
    const SchemaRegistry = await ethers.getContractFactory("SchemaRegistry");
    const schemaRegistry = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();
    const schemaRegistryAddress = await schemaRegistry.getAddress();
    console.log("SchemaRegistry deployed to:", schemaRegistryAddress);
    // Create a schema
    const schema = "uint256 kycId, uint256 kycLevel, address smartWallet";
    const revocable = true;
    const resolver = ethers.ZeroAddress; // No resolver for this example

    const tx = await schemaRegistry.register(schema, resolver, revocable);
    const receipt = await tx.wait();

    const event = receipt.logs.find(
      (log: any) => log.fragment.name === "Registered"
    );
    const schemaId = event.args.uid;

    console.log("Schema created with ID:", schemaId);

    // Deploy EAS Mock
    EAS = await ethers.getContractFactory("EAS");
    eas = (await EAS.deploy(schemaRegistryAddress)) as unknown as EAS;
    await eas.waitForDeployment();
    // Mock KYC Schema UID
    kycSchemaUID = schemaId;

    // Deploy Registry Contract
    Registry = await ethers.getContractFactory("Registry");
    registry = (await Registry.deploy(
      await eas.getAddress(),
      kycSchemaUID,
      await feeReceiver.getAddress()
    )) as unknown as Registry;
    await registry.waitForDeployment();
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const deploymentEntrypoint = await EntryPointFactory.deploy();
    entryPoint = (await deploymentEntrypoint.waitForDeployment()) as any;
    entryPointAddress = await deploymentEntrypoint.getAddress();
    // Deploy CMAccountFactory Mock
    CMAccountFactory = await ethers.getContractFactory("CMAccountFactory");
    cmAccountFactory = (await CMAccountFactory.deploy(
      await owner.getAddress(),
      entryPointAddress
    )) as unknown as CMAccountFactory;
    await cmAccountFactory.waitForDeployment();

    // Deploy ERC20 Mock Tokens
    ERC20 = await ethers.getContractFactory("TestERC20");
    token1 = (await ERC20.deploy("Token1", "TK1", 18)) as unknown as ERC20;
    token2 = (await ERC20.deploy("Token2", "TK2", 18)) as unknown as ERC20;
    await token1.waitForDeployment();
    await token2.waitForDeployment();

    // Deploy Price Feed Mocks
    PriceFeedMock = await ethers.getContractFactory("TestOracle2");
    priceFeed1 = (await PriceFeedMock.deploy(120, 18)) as any;
    priceFeed2 = (await PriceFeedMock.deploy(150, 18)) as any;
    await priceFeed1.waitForDeployment();
    await priceFeed2.waitForDeployment();

    // Grant Roles
    await registry
      .connect(owner)
      .grantRole(await registry.DEFAULT_ADMIN_ROLE(), await admin.getAddress());
    await registry
      .connect(owner)
      .grantRole(await registry.ATTESTER_ROLE(), await attester.getAddress());
    await registry
      .connect(owner)
      .grantRole(await registry.OPERATOR_ROLE(), await operator.getAddress());
  });

  describe("Role Management", function () {
    it("should assign roles correctly", async function () {
      expect(
        await registry.hasRole(
          await registry.DEFAULT_ADMIN_ROLE(),
          await admin.getAddress()
        )
      ).to.equal(true);

      expect(
        await registry.hasRole(
          await registry.ATTESTER_ROLE(),
          await attester.getAddress()
        )
      ).to.equal(true);

      expect(
        await registry.hasRole(
          await registry.OPERATOR_ROLE(),
          await operator.getAddress()
        )
      ).to.equal(true);
    });

    it("should allow admin to grant and revoke roles", async function () {
      await registry.connect(admin).grantAttesterRole(await user1.getAddress());
      expect(
        await registry.hasRole(
          await registry.ATTESTER_ROLE(),
          await user1.getAddress()
        )
      ).to.equal(true);

      await registry
        .connect(admin)
        .revokeAttesterRole(await user1.getAddress());
      expect(
        await registry.hasRole(
          await registry.ATTESTER_ROLE(),
          await user1.getAddress()
        )
      ).to.equal(false);
    });

    it("should not allow non-admin to grant or revoke roles", async function () {
      const defaultAdminRole = await registry.DEFAULT_ADMIN_ROLE();
      await expect(
        registry.connect(user1).grantAttesterRole(await user2.getAddress())
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), defaultAdminRole);

      await expect(
        registry.connect(user1).revokeAttesterRole(await attester.getAddress())
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), defaultAdminRole);
    });
  });

  describe("Factory Management", function () {
    it("should allow operator to add a factory", async function () {
      await expect(
        registry
          .connect(operator)
          .addFactory(
            await (cmAccountFactory as unknown as Contract).getAddress()
          )
      )
        .to.emit(registry, "FactoryAdded")
        .withArgs(
          await (cmAccountFactory as unknown as Contract).getAddress()
        );
    });

    it("should allow operator to remove a factory", async function () {
      await expect(
        registry
          .connect(operator)
          .removeFactory(
            await (cmAccountFactory as unknown as Contract).getAddress()
          )
      )
        .to.emit(registry, "FactoryRemoved")
        .withArgs(
          await (cmAccountFactory as unknown as Contract).getAddress()
        );
    });

    it("should not allow non-operator to add or remove factories", async function () {
      const operatorRole = await registry.OPERATOR_ROLE();
      await expect(
        registry
          .connect(user1)
          .addFactory(
            await (cmAccountFactory as unknown as Contract).getAddress()
          )
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), operatorRole);

      await expect(
        registry
          .connect(user1)
          .removeFactory(
            await (cmAccountFactory as unknown as Contract).getAddress()
          )
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), operatorRole);
    });
  });

  describe("Token Management", function () {
    it("should allow operator to add tokens", async function () {
      const tokens = [await token1.getAddress(), await token2.getAddress()];
      const priceFeeds = [
        await priceFeed1.getAddress(),
        await priceFeed2.getAddress(),
      ];

      await expect(registry.connect(operator).addToken(tokens, priceFeeds))
        .to.emit(registry, "TokenAdded")
        .withArgs(tokens, priceFeeds);
    });

    it("should allow operator to remove tokens", async function () {
      const tokens = [await token1.getAddress(), await token2.getAddress()];

      await expect(registry.connect(operator).removeToken(tokens))
        .to.emit(registry, "TokenRemoved")
        .withArgs(tokens);
    });

    it("should not allow non-operator to add or remove tokens", async function () {
      const operatorRole = await registry.OPERATOR_ROLE();
      const tokens = [await token1.getAddress()];
      const priceFeeds = [await priceFeed1.getAddress()];

      await expect(registry.connect(user1).addToken(tokens, priceFeeds))
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), operatorRole);

      await expect(registry.connect(user1).removeToken(tokens))
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), operatorRole);
    });
  });

  describe("Pool Management", function () {
    it("should allow operator to add pools", async function () {
      const pools = [await token1.getAddress(), await token2.getAddress()];

      await expect(registry.connect(operator).addPool(pools))
        .to.emit(registry, "PoolAdded")
        .withArgs(pools);
    });

    it("should allow operator to remove pools", async function () {
      const pools = [await token1.getAddress(), await token2.getAddress()];

      await expect(registry.connect(operator).removePool(pools))
        .to.emit(registry, "PoolRemoved")
        .withArgs(pools);
    });

    it("should not allow non-operator to add or remove pools", async function () {
      const operatorRole = await registry.OPERATOR_ROLE();
      const pools = [await token1.getAddress()];

      await expect(registry.connect(user1).addPool(pools))
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), operatorRole);

      await expect(registry.connect(user1).removePool(pools))
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), operatorRole);
    });
  });

  describe("KYC Attestation", function () {
    it("should allow attester to attest KYC", async function () {
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await user1.getAddress();

      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet, kycId, kycLevel, anyValue);
    });

    it("should allow attester to revoke KYC", async function () {
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await user1.getAddress();

      await registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet);
      // const receipt = await tx.filters;
      const filter = registry.filters.KYCAttested;
      const events = await registry.queryFilter(filter(), -1);
      const event = events[0];
      const attestationUID = event?.args?.attestationUID;

      await expect(registry.connect(attester).revokeKYC(attestationUID))
        .to.emit(registry, "KYCRevoked")
        .withArgs(smartWallet, attestationUID);
    });

    it("should not allow non-attester to attest or revoke KYC", async function () {
      const attesterRole = await registry.ATTESTER_ROLE();
      const kycId = 12345;
      const kycLevel = 2;
      const smartWallet = await user1.getAddress();

      await expect(
        registry.connect(user1).attestKYC(kycId, kycLevel, smartWallet)
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), attesterRole);

      await registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet);
      const filter = registry.filters.KYCAttested;
      const events = await registry.queryFilter(filter(), -1);
      const event = events[0];
      const attestationUID = event?.args?.attestationUID;

      await expect(registry.connect(user1).revokeKYC(attestationUID))
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), attesterRole);
    });
  });

  describe("Administrative Functions", function () {
    it("should allow admin to set KYC schema UID", async function () {
      const newSchemaUID = ethers.encodeBytes32String("newKycSchema");
      await registry.connect(admin).setKYCSchemaUID(newSchemaUID);
      expect(await registry.kycSchemaUID()).to.equal(newSchemaUID);
    });

    it("should allow admin to set fee receiver", async function () {
      await registry.connect(admin).setFeeReceiver(await user2.getAddress());
      expect(await registry.feeReceiver()).to.equal(await user2.getAddress());
    });

    it("should not allow non-admin to set KYC schema UID or fee receiver", async function () {
      const defaultAdminRole = await registry.DEFAULT_ADMIN_ROLE();
      const newSchemaUID = ethers.encodeBytes32String("newKycSchema");
      await expect(registry.connect(user1).setKYCSchemaUID(newSchemaUID))
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), defaultAdminRole);

      await expect(
        registry.connect(user1).setFeeReceiver(await user2.getAddress())
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), defaultAdminRole);
    });
  });

  describe("Pausable Functionality", function () {
    it("should allow admin to pause and unpause the contract", async function () {
      await registry.connect(admin).pause();
      expect(await registry.paused()).to.equal(true);

      await registry.connect(admin).unpause();
      expect(await registry.paused()).to.equal(false);
    });

    it("should not allow non-admin to pause or unpause the contract", async function () {
      const defaultAdminRole = await registry.DEFAULT_ADMIN_ROLE();
      await expect(registry.connect(user1).pause())
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), defaultAdminRole);

      await expect(registry.connect(user1).unpause())
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(await user1.getAddress(), defaultAdminRole);
    });

    it("should prevent certain operations when paused", async function () {
      await registry.connect(admin).pause();

      await expect(
        registry
          .connect(operator)
          .addFactory(
            await (cmAccountFactory as unknown as Contract).getAddress()
          )
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await expect(
        registry.connect(attester).attestKYC(12345, 2, await user1.getAddress())
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.connect(admin).unpause(); // Unpause for further tests
    });
  });
});
