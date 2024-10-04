import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, ContractFactory, BytesLike, getBigInt } from "ethers";
import { InaPool, Registry, EAS, TestERC20 } from "../typechain";
import { inaRegistrySol } from "../typechain/contracts";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { AlchemyPaymasterAddressV3 } from "@alchemy/aa-alchemy/dist/types/gas-manager";

describe("InaPool Deployment", function () {
  let inaPool: InaPool,
    Registry: ContractFactory,
    registry: Registry,
    asset: TestERC20,
    EAS: ContractFactory,
    eas: EAS,
    signer: Signer,
    addr1: Signer,
    addr2: Signer,
    addr3: Signer,
    feeReceiver: Signer,
    facilitator: Signer,
    attester: Signer,
    signerAddress: string,
    startTime: number,
    endTime: number,
    kycSchemaUID: BytesLike;

  before(async function () {
    [signer, addr1, addr2, addr3, attester, feeReceiver, facilitator] =
      await ethers.getSigners();
    signerAddress = await signer.getAddress();

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

    const currentBlock = await ethers.provider.getBlock("latest");
    startTime = currentBlock.timestamp + 100; // Start after 100 seconds from now
    endTime = startTime + 3600; // End after 1 hour

    // Deploy the mock ERC20 asset
    const Asset = await ethers.getContractFactory("TestERC20");
    asset = (await Asset.deploy(
      "Mock Asset",
      "MCK",
      18
    )) as unknown as TestERC20;
    await asset.waitForDeployment();

    // Deploy EAS Mock
    EAS = await ethers.getContractFactory("EAS");
    eas = (await EAS.deploy(schemaRegistryAddress)) as unknown as EAS;
    await eas.waitForDeployment();

    // Mock KYC Schema UID
    kycSchemaUID = schemaId;

    const easAddress = await eas.getAddress();
    const receiverAddress = await feeReceiver.getAddress();
    const facilitatorAddress = await facilitator.getAddress();

    // Deploy Registry Contract
    Registry = await ethers.getContractFactory("Registry");
    registry = (await Registry.deploy(
      easAddress,
      kycSchemaUID,
      receiverAddress
    )) as unknown as Registry;
    await registry.waitForDeployment();

    // Deploy InaPool with mock data
    const InaPool = await ethers.getContractFactory("InaPool");
    const poolParams = {
      startTime,
      endTime,
      threshold: ethers.parseEther("50"), // Minimum of 10 tokens
      amountToRaise: ethers.parseEther("100"), // Max raise is 100 tokens
      feeBasisPoints: 200, // 2% fee
      estimatedReturnBasisPoints: 15000, // 150% return
      creditFacilitator: facilitatorAddress,
      kycLevel: 1,
      term: 86400, // 1 day term
    };
    inaPool = (await InaPool.deploy(
      registry.getAddress(),
      asset.getAddress(),
      "Ina Pool",
      "INA",
      poolParams
    )) as unknown as InaPool;
    await inaPool.waitForDeployment();

    await registry.grantAttesterRole(attester.getAddress());
  });

  it("Should deploy InaPool with correct parameters", async function () {
    const facilitatorAddress = await facilitator.getAddress();

    expect(await inaPool.name()).to.equal("Ina Pool");
    expect(await inaPool.symbol()).to.equal("INA");
    expect(await inaPool.asset()).to.equal(await asset.getAddress());
    expect(await inaPool.threshold()).to.equal(
      ethers.parseEther("50").toString()
    );
    expect(await inaPool.amountToRaise()).to.equal(
      ethers.parseEther("100").toString()
    );
    expect(await inaPool.feeBasisPoints()).to.equal(200);
    expect(await inaPool.estimatedReturnBasisPoints()).to.equal(15000);
    expect(await inaPool.creditFacilitator()).to.equal(facilitatorAddress);
  });
  it("Should revert if deposit is made before the investment period", async function () {
    // Use EAS to create a valid attestation for addr1's KYC
    const kycId = 12345;
    const kycLevel = 1;
    const smartWallet = await addr1.getAddress();

    await expect(
      registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet)
    )
      .to.emit(registry, "KYCAttested")
      .withArgs(smartWallet, kycId, kycLevel, anyValue);

    const filter = registry.filters.KYCAttested;
    const events = await registry.queryFilter(filter(), -1);
    const event = events[0];
    const attestationUID = event?.args?.attestationUID;

    await asset.sudoMint(await addr1.getAddress(), ethers.parseEther("10"));
    await asset
      .connect(addr1)
      .approve(inaPool.getAddress(), ethers.parseEther("10"));

    await expect(
      inaPool.connect(addr1).deposit(ethers.parseEther("10"), attestationUID)
    ).to.be.revertedWith("Investment period is closed");
  });
  describe("InaPool advanced tests", function () {
    beforeEach(async function () {
      // Fast forward time to the investment period
      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      // Simulate token minting for addr1
      await asset.sudoMint(await addr1.getAddress(), ethers.parseEther("20"));

      // Simulate approval for the InaPool contract to transfer the tokens
      await asset
        .connect(addr1)
        .approve(inaPool.getAddress(), ethers.parseEther("10"));
    });

    it("Should allow deposit during the investment period with valid KYC", async function () {
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await addr1.getAddress();

      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet, kycId, kycLevel, anyValue);

      const filter = registry.filters.KYCAttested;
      const events = await registry.queryFilter(filter(), -1);
      const event = events[0];
      const attestationUID = event?.args?.attestationUID;

      // Deposit 10 tokens by addr1 with valid KYC attestation
      const depositTx = await inaPool
        .connect(addr1)
        .deposit(ethers.parseEther("10"), attestationUID);
      await depositTx.wait();

      expect(await inaPool.totalAssets()).to.equal(
        ethers.parseEther("10").toString()
      );
      expect(await inaPool.balanceOf(await addr1.getAddress())).to.be.gt(0);
    });

    it("Should revert if atestation is not correct", async function () {
      // Attempt deposit outside the investment period
      const invalidAttestation = ethers.encodeBytes32String("validKYC");

      await expect(
        inaPool
          .connect(addr1)
          .deposit(ethers.parseEther("5"), invalidAttestation)
      ).to.be.revertedWith("Invalid attester");
    });

    it("Should refund investors if the threshold is not met", async function () {
      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      // Fast forward time to the investment period
      await ethers.provider.send("evm_increaseTime", [26000]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await asset.balanceOf(await addr1.getAddress());

      // Trigger refund
      await inaPool.connect(signer).refund();

      const balanceAfter = await asset.balanceOf(await addr1.getAddress());

      expect(balanceAfter).to.be.gt(balanceBefore);

      expect(await inaPool.balanceOf(await addr1.getAddress())).to.equal(0);
      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("Should take funds correctly and deduct fees", async function () {
      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      // Simulate more deposits to reach the threshold
      const amount = ethers.parseEther("30");

      const addr2Address = await addr2.getAddress();
      const addr3Address = await addr3.getAddress();

      await asset.sudoMint(addr2Address, amount);
      await asset.sudoMint(addr3Address, amount);

      await asset.connect(addr2).approve(inaPool.getAddress(), amount);
      await asset.connect(addr3).approve(inaPool.getAddress(), amount);

      // Use EAS to create a valid attestation for the investor's KYC
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await addr2.getAddress();
      const smartWallet1 = await addr3.getAddress();

      // First KYC attestation for addr2
      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet, kycId, kycLevel, anyValue);

      // Filter and get the first KYCAttested event
      const filter1 = registry.filters.KYCAttested(smartWallet, null, null);
      const events1 = await registry.queryFilter(filter1, -1);
      const event1 = events1[events1.length - 1]; // Get the latest event
      const attestationUID = event1?.args?.attestationUID;
      console.log("First Attestation UID:", attestationUID);

      // Second KYC attestation for addr3
      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet1)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet1, kycId, kycLevel, anyValue);

      // Filter and get the second KYCAttested event
      const filter2 = registry.filters.KYCAttested(smartWallet1, null, null);
      const events2 = await registry.queryFilter(filter2, -1);
      const event2 = events2[events2.length - 1]; // Get the latest event
      const attestationUID1 = event2?.args?.attestationUID;
      console.log("Second Attestation UID:", attestationUID1);

      // Deposit tokens
      const depositTx = await inaPool
        .connect(addr2)
        .deposit(amount, attestationUID);
      await depositTx.wait();

      const deposit1Tx = await inaPool
        .connect(addr3)
        .deposit(amount, attestationUID1);
      await deposit1Tx.wait();

      // Verify fee deduction and fund transfer
      const totalInvested = ethers.getBigInt(await inaPool.totalAssets());
      const feeBasisPoints = ethers.getBigInt(await inaPool.feeBasisPoints());

      const divisionNumber = ethers.getBigInt(10000);
      const feeAmount = (totalInvested * feeBasisPoints) / divisionNumber;
      const facilitatorAmount = totalInvested - feeAmount;

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      const facilitatorAddress = await facilitator.getAddress();

      // Take funds by the credit facilitator
      await expect(inaPool.connect(facilitator).takeFunds())
        .to.emit(inaPool, "FundsTaken")
        .withArgs(facilitatorAddress, anyValue);

      expect(await asset.balanceOf(registry.feeReceiver())).to.equal(feeAmount);
      expect(await asset.balanceOf(facilitatorAddress)).to.equal(
        facilitatorAmount
      );
      await ethers.provider.send("evm_revert", [snapshotId]);
    });
  });
});
