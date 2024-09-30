import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, ContractFactory, BytesLike } from "ethers";
import { InaPool, Registry, EAS, ERC20 } from "../typechain";

describe("InaPool", function () {
  let inaPool: InaPool,
    Registry: ContractFactory,
    registry: Registry,
    asset: ERC20,
    EAS: ContractFactory,
    eas: EAS,
    signer: Signer,
    addr1: Signer,
    addr2: Signer,
    signerAddress: string,
    startTime: number,
    endTime: number,
    kycSchemaUID: BytesLike;

  before(async function () {
    [signer, addr1, addr2] = await ethers.getSigners();
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
    asset = (await Asset.deploy("Mock Asset", "MCK", 18)) as unknown as ERC20;
    await asset.waitForDeployment();

    // Deploy EAS Mock
    EAS = await ethers.getContractFactory("EAS");
    eas = (await EAS.deploy(schemaRegistryAddress)) as unknown as EAS;
    await eas.waitForDeployment();

    // Mock KYC Schema UID
    kycSchemaUID = schemaId;

    const easAddress = await eas.getAddress();
    const feeReceiver = signerAddress; // Address for the fee receiver

    // Deploy Registry Contract
    Registry = await ethers.getContractFactory("Registry");
    registry = (await Registry.deploy(
      await eas.getAddress(),
      kycSchemaUID,
      await feeReceiver
    )) as unknown as Registry;
    await registry.waitForDeployment();

    // Deploy InaPool with mock data
    const InaPool = await ethers.getContractFactory("InaPool");
    const poolParams = {
      startTime,
      endTime,
      threshold: ethers.parseEther("10"), // Minimum of 10 tokens
      amountToRaise: ethers.parseEther("100"), // Max raise is 100 tokens
      feeBasisPoints: 200, // 2% fee
      estimatedReturnBasisPoints: 15000, // 150% return
      creditFacilitator: signerAddress,
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
  });

  it("Should deploy InaPool with correct parameters", async function () {
    expect(await inaPool.name()).to.equal("Ina Pool");
    expect(await inaPool.symbol()).to.equal("INA");
    expect(await inaPool.asset()).to.equal(await asset.getAddress());
    expect(await inaPool.threshold()).to.equal(
      ethers.parseEther("10").toString()
    );
    expect(await inaPool.amountToRaise()).to.equal(
      ethers.parseEther("100").toString()
    );
    expect(await inaPool.feeBasisPoints()).to.equal(200);
    expect(await inaPool.estimatedReturnBasisPoints()).to.equal(15000);
    expect(await inaPool.creditFacilitator()).to.equal(signerAddress);
  });

  it("Should allow deposit during the investment period with valid KYC", async function () {
    // Simulate token minting for addr1
    await asset.sudoMint(await addr1.getAddress(), ethers.parseEther("20"));

    // Simulate approval for the InaPool contract to transfer the tokens
    await asset
      .connect(addr1)
      .approve(inaPool.getAddress(), ethers.parseEther("10"));

    // Use EAS to create a valid attestation for addr1's KYC
    const addr1Address = await addr1.getAddress();
    const abiCoder = new ethers.AbiCoder();

    // Convert KYC ID and KYC Level to BigNumber
    const kycId = 1;
    const kycLevel = 1;

    const attestationRequestData = {
      recipient: addr1Address,
      expirationTime: 0,
      revocable: true,
      refUID: ethers.ZeroBytes32,
      data: abiCoder.encode(
        ["uint256", "uint256", "address"],
        [kycId, kycLevel, addr1Address]
      ),
      value: 0,
    };

    const attestationRequest = {
      schema: kycSchemaUID,
      data: attestationRequestData,
    };

    // Now submit the attestation using the EAS contract
    const tx = await eas.attest(attestationRequest);
    await tx.wait();

    console.log("Attestation completed for address:", addr1Address);

    const attestationEvent = attestationReceipt.logs.find(
      (log: any) => log.fragment.name === "Attested"
    );
    const validAttestation = attestationEvent.args.uid;

    // Fast forward time to the investment period
    await ethers.provider.send("evm_increaseTime", [101]);
    await ethers.provider.send("evm_mine", []);

    // Deposit 10 tokens by addr1 with valid KYC attestation
    const depositTx = await inaPool
      .connect(addr1)
      .deposit(ethers.parseEther("10"), validAttestation);
    await depositTx.wait();

    expect(await inaPool.totalAssets()).to.equal(
      ethers.parseEther("10").toString()
    );
    expect(await inaPool.balanceOf(await addr1.getAddress())).to.be.gt(0);
  });

  it("Should revert if atestation is not correct", async function () {
    // Fast forward time to after the investment period
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    // Attempt deposit outside the investment period
    const invalidAttestation = ethers.encodeBytes32String("validKYC");

    await expect(
      inaPool.connect(addr1).deposit(ethers.parseEther("5"), invalidAttestation)
    ).to.be.revertedWith("Invalid attester");
  });

  it("Should refund investors if the threshold is not met", async function () {
    // Fast forward time to after the investment period
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    // Trigger refund
    const refundTx = await inaPool.connect(signer).refund();
    await refundTx.wait();

    expect(await asset.balanceOf(await addr1.getAddress())).to.equal(
      ethers.parseEther("10").toString()
    );
    expect(await inaPool.balanceOf(await addr1.getAddress())).to.equal(0);
  });
});
