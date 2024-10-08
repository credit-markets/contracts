import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, ContractFactory, BytesLike, getBigInt } from "ethers";
import { InaPool, Registry, EAS, TestERC20 } from "../typechain";
import { inaRegistrySol } from "../typechain/contracts";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { AlchemyPaymasterAddressV3 } from "@alchemy/aa-alchemy/dist/types/gas-manager";
import { bigint } from "hardhat/internal/core/params/argumentTypes";

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

    it("Should repay investors correctly", async function () {
      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      const facilitatorAddress = await facilitator.getAddress();

      const totalPoolAmount = ethers.parseEther("100000000000000000"); // large amount for the pool
      const depositAmount = ethers.parseEther("20"); // amount each investor deposits

      // Facilitator mints and approves large pool amount
      await asset.sudoMint(facilitatorAddress, totalPoolAmount);
      await asset
        .connect(facilitator)
        .approve(inaPool.getAddress(), totalPoolAmount);

      // Investor initial balances before deposits
      const investor1InitialBalance = ethers.getBigInt(
        await asset.balanceOf(await addr2.getAddress())
      );

      const investor2InitialBalance = ethers.getBigInt(
        await asset.balanceOf(await addr3.getAddress())
      );

      // Mint and deposit for investors
      const addr2Address = await addr2.getAddress();
      const addr3Address = await addr3.getAddress();

      await asset.sudoMint(addr2Address, depositAmount);
      await asset.sudoMint(addr3Address, depositAmount);

      await asset.connect(addr2).approve(inaPool.getAddress(), depositAmount);
      await asset.connect(addr3).approve(inaPool.getAddress(), depositAmount);

      // Use EAS for KYC verification
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

      // Second KYC attestation for addr3
      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet1)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet1, kycId, kycLevel, anyValue);

      // Deposit tokens for addr2 and addr3
      const attestationUID = (
        await registry.queryFilter(
          registry.filters.KYCAttested(smartWallet, null, null),
          -1
        )
      )[0]?.args?.attestationUID;

      const attestationUID1 = (
        await registry.queryFilter(
          registry.filters.KYCAttested(smartWallet1, null, null),
          -1
        )
      )[0]?.args?.attestationUID;

      await inaPool.connect(addr2).deposit(depositAmount, attestationUID);
      await inaPool.connect(addr3).deposit(depositAmount, attestationUID1);

      // Fast forward time for repayment
      await ethers.provider.send("evm_increaseTime", [86000400]); // fast-forward about 1 year
      await ethers.provider.send("evm_mine", []);

      const supplyBefore = ethers.getBigInt(await inaPool.totalSupply());
      // Total repayment amount calculated by inaPool
      const totalRepayment = await inaPool.calculateRepaymentAmount();

      // Calculate expected repayment for each investor based on their share of the pool
      const investor1Shares = ethers.getBigInt(
        await inaPool.balanceOf(await addr2.getAddress())
      );

      const investor2Shares = ethers.getBigInt(
        await inaPool.balanceOf(await addr3.getAddress())
      );

      // Facilitator takes funds
      await expect(inaPool.connect(facilitator).takeFunds())
        .to.emit(inaPool, "FundsTaken")
        .withArgs(facilitatorAddress, anyValue);

      await ethers.provider.send("evm_increaseTime", [86400]); // fast-forward about 1 day
      await ethers.provider.send("evm_mine", []);

      // Facilitator repays the pool
      await expect(inaPool.connect(facilitator).repay())
        .to.emit(inaPool, "Repaid")
        .withArgs(anyValue);

      // Investor balances after repayment
      const investor1FinalBalance = ethers.getBigInt(
        await asset.balanceOf(await addr2.getAddress())
      );

      const investor2FinalBalance = ethers.getBigInt(
        await asset.balanceOf(await addr3.getAddress())
      );

      const expectedInvestor1Repayment =
        (totalRepayment * investor1Shares) / supplyBefore;
      const expectedInvestor2Repayment =
        (totalRepayment * investor2Shares) / supplyBefore;

      // Assertion that final balances are correct with closeTo to handle minor deviations
      expect(investor1FinalBalance - investor1InitialBalance).to.be.eq(
        expectedInvestor1Repayment
      );

      expect(investor2FinalBalance - investor2InitialBalance).to.be.eq(
        expectedInvestor2Repayment
      );

      // Revert snapshot after the test
      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("User 1 with valid KYC can invest, User 2 with fake KYC cannot", async function () {
      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      // Mock KYC details for User 1 (valid KYC)
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await addr1.getAddress();

      // Attest valid KYC for User 1
      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet, kycId, kycLevel, anyValue);

      // Filter and get the KYC attestation event for User 1
      const filter = registry.filters.KYCAttested(smartWallet, null, null);
      const events = await registry.queryFilter(filter, -1);
      const attestationUID = events[0]?.args?.attestationUID;

      // Mint tokens for User 1 and approve for InaPool
      await asset.sudoMint(await addr1.getAddress(), ethers.parseEther("20"));
      await asset
        .connect(addr1)
        .approve(inaPool.getAddress(), ethers.parseEther("10"));

      // Fast forward time to open the investment period
      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      // User 1 should be able to invest with valid KYC
      const depositTx = await inaPool
        .connect(addr1)
        .deposit(ethers.parseEther("10"), attestationUID);
      await depositTx.wait();

      // Mock KYC details for User 2 (fake KYC)
      const invalidAttestationUID = ethers.encodeBytes32String("fakeKYC");

      // Mint tokens for User 2 and approve for InaPool
      await asset.sudoMint(await addr2.getAddress(), ethers.parseEther("20"));
      await asset
        .connect(addr2)
        .approve(inaPool.getAddress(), ethers.parseEther("10"));

      // User 2 should be reverted when trying to invest with fake KYC
      await expect(
        inaPool
          .connect(addr2)
          .deposit(ethers.parseEther("10"), invalidAttestationUID)
      ).to.be.revertedWith("Invalid attester");

      // Verify that User 1's investment succeeded
      expect(await inaPool.balanceOf(await addr1.getAddress())).to.be.gt(0);

      // Verify that User 2 did not deposit any funds
      expect(await inaPool.balanceOf(await addr2.getAddress())).to.equal(0);

      // Revert snapshot after the test
      await ethers.provider.send("evm_revert", [snapshotId]);
    });

    it("Should fail when trying to invest after all tokens are sold out", async function () {
      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      // Set total supply or available pool size for the test
      const totalPoolSize =
        (await inaPool.amountToRaise()) - (await inaPool.totalAssets());

      // Mint enough tokens to cover the total pool size for User 1
      await asset.sudoMint(await addr1.getAddress(), totalPoolSize);
      await asset.connect(addr1).approve(inaPool.getAddress(), totalPoolSize);

      // Attest valid KYC for User 1
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await addr1.getAddress();
      await registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet);

      // Filter and get the KYC attestation event for User 1
      const filter = registry.filters.KYCAttested(smartWallet, null, null);
      const events = await registry.queryFilter(filter, -1);
      const attestationUID = events[0]?.args?.attestationUID;

      // Fast forward time to open the investment period
      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      // User 1 invests the total pool size, filling the pool
      await inaPool.connect(addr1).deposit(totalPoolSize, attestationUID);

      // Verify that the pool is fully invested
      expect(await inaPool.totalAssets()).to.equal(
        await inaPool.amountToRaise()
      );
      // Mint tokens for User 2 and approve InaPool
      await asset.sudoMint(await addr2.getAddress(), ethers.parseEther("10"));
      await asset
        .connect(addr2)
        .approve(inaPool.getAddress(), ethers.parseEther("10"));

      const smartWallet1 = await addr2.getAddress();

      await expect(
        registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet1)
      )
        .to.emit(registry, "KYCAttested")
        .withArgs(smartWallet1, kycId, kycLevel, anyValue);

      const filter1 = registry.filters.KYCAttested;
      const events1 = await registry.queryFilter(filter1(), -1);
      const event1 = events1[0];
      const attestationUID1 = event1?.args?.attestationUID;

      await expect(
        inaPool.connect(addr2).deposit(ethers.parseEther("10"), attestationUID1)
      ).to.be.revertedWith("Investment exceeds amount to raise");

      // Verify that User 2 did not deposit any funds
      expect(await inaPool.balanceOf(await addr2.getAddress())).to.equal(0);

      // Revert snapshot after the test
      await ethers.provider.send("evm_revert", [snapshotId]);
    });
    it("Should fail if trying to refund twice", async function () {
      const snapshotId = await ethers.provider.send("evm_snapshot", []);
      // Set up the investment scenario
      const investmentAmount = ethers.parseEther("10");

      // Mint tokens for User 1 and approve InaPool
      await asset.sudoMint(await addr1.getAddress(), investmentAmount);
      await asset
        .connect(addr1)
        .approve(inaPool.getAddress(), investmentAmount);

      // Attest valid KYC for User 1
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await addr1.getAddress();
      await registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet);

      // Filter and get the KYC attestation event for User 1
      const filter = registry.filters.KYCAttested(smartWallet, null, null);
      const events = await registry.queryFilter(filter, -1);
      const attestationUID = events[0]?.args?.attestationUID;

      // Fast forward time to open the investment period
      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      // User 1 invests in the pool
      await inaPool.connect(addr1).deposit(investmentAmount, attestationUID);

      // Fast forward time to finish the investment period
      await ethers.provider.send("evm_increaseTime", [100001]);
      await ethers.provider.send("evm_mine", []);
      // Now simulate a refund scenario
      await inaPool.connect(addr1).refund();

      // Verify that User 1's balance is zero after the refund
      expect(await inaPool.balanceOf(await addr1.getAddress())).to.equal(0);

      // User 1 tries to request a refund again (should fail)
      await expect(inaPool.connect(addr1).refund()).to.be.revertedWith(
        "Already refunded"
      );
      // Revert snapshot after the test
      await ethers.provider.send("evm_revert", [snapshotId]);
    });
    it("Should fail when trying to invest without KYC, succeed after KYC is completed", async function () {
      const investmentAmount = ethers.parseEther("10");
      const amountBefore = await inaPool.balanceOf(await addr1.getAddress());

      // Mint tokens for User 1 and approve InaPool
      await asset.sudoMint(await addr1.getAddress(), investmentAmount);
      await asset
        .connect(addr1)
        .approve(inaPool.getAddress(), investmentAmount);

      // Fast forward time to open the investment period
      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      // Attempt to invest without KYC, should revert
      await expect(
        inaPool.connect(addr1).deposit(investmentAmount, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid attester");

      // Perform KYC for User 1
      const kycId = 12345;
      const kycLevel = 1;
      const smartWallet = await addr1.getAddress();
      await registry.connect(attester).attestKYC(kycId, kycLevel, smartWallet);

      // Filter and get the KYC attestation event for User 1
      const filter = registry.filters.KYCAttested(smartWallet, null, null);
      const events = await registry.queryFilter(filter, -1);
      const attestationUID = events[0]?.args?.attestationUID;

      // User 1 tries again to invest, this time with valid KYC
      await inaPool.connect(addr1).deposit(investmentAmount, attestationUID);

      // Verify that the investment was successful
      expect(await inaPool.balanceOf(await addr1.getAddress())).to.equal(
        investmentAmount + amountBefore
      );
    });
  });
});
