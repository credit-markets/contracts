import { expect } from "chai";
import { ethers } from "hardhat";
import { DefaultsForUserOp } from "./UserOp.ts";
import { Contract, Signer, ContractFactory } from "ethers";
import { EntryPoint, SimplePaymaster } from "../typechain";

describe("SimplePaymaster", function () {
  let entryPoint: EntryPoint,
    paymaster: SimplePaymaster,
    owner: Signer,
    addr1: Signer,
    addr2: Signer,
    entryPointAddress: string,
    paymasterAddress: string;
  const provider = ethers.provider;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy the EntryPoint contract from the account-abstraction package
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const deploymentEntrypoint = await EntryPointFactory.deploy();
    entryPoint = await deploymentEntrypoint.deployed(); // Ensure the contract is fully deployed
    entryPointAddress = await entryPoint.getAddress();

    // Deploy the SimplePaymaster contract linked to the EntryPoint
    const Paymaster = await ethers.getContractFactory("SimplePaymaster");
    const paymasterDeployment = await Paymaster.deploy(entryPointAddress);
    paymaster = await paymasterDeployment.deployed(); // Ensure the contract is fully deployed
    paymasterAddress = await paymaster.getAddress();
  });

  it("Should deploy EntryPoint and SimplePaymaster correctly", async function () {
    expect(entryPointAddress).to.be.properAddress;
    expect(paymasterAddress).to.be.properAddress;
    expect(await paymaster.entryPoint()).to.equal(entryPointAddress);
  });

  it("Should allow the owner to add funds to the Paymaster", async function () {
    const amount = ethers.parseEther("1.0");
    await paymaster.addFunds({ value: amount });
    expect(await ethers.provider.getBalance(paymasterAddress)).to.equal(amount);
  });

  it("Should prevent non-owners from calling protected functions", async function () {
    const amount = ethers.parseEther("1.0");
    await paymaster.addFunds({ value: amount });

    await expect(
      paymaster.connect(addr1).withdrawTo(await addr1.getAddress(), amount)
    )
      .to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount")
      .withArgs(await addr1.getAddress());
  });

  it("Should validate a user operation", async function () {
    // Dummy UserOperation and context for testing _validatePaymasterUserOp
    const abiCoder = new ethers.AbiCoder();

    const verificationGasLimit =
      BigInt(DefaultsForUserOp.verificationGasLimit) + BigInt(21000);
    const callGasLimit =
      BigInt(DefaultsForUserOp.preVerificationGas) + BigInt(21000);

    const userOp = {
      sender: await addr1.getAddress(),
      nonce: 0,
      initCode: "0x",
      callData: "0x",
      // accountGasLimits: ethers.hexConcat([
      //   ethers.utils.hexZeroPad(ethers.hexlify(verificationGasLimit), 16),
      //   ethers.hexZeroPad(ethers.hexlify(callGasLimit), 16),
      // ]),
      accountGasLimits: ethers.hexlify("21000000"),
      preVerificationGas: 21000,
      gasFees: ethers.hexlify(
        abiCoder.encode(
          ["uint192", "uint64"],
          [ethers.parseUnits("10", "gwei"), ethers.parseUnits("1", "gwei")]
        )
      ),
      paymasterAndData: "0x",
      signature: "0x",
    };

    const requestId = ethers.keccak256(
      abiCoder.encode(
        ["address", "uint256", "bytes32"],
        [userOp.sender, userOp.nonce, ethers.ZeroHash]
      )
    );

    const maxCost = ethers.parseEther("0.1");
    const context = await paymaster.validatePaymasterUserOp(
      userOp,
      requestId,
      maxCost
    );
    expect(context[0]).to.equal(""); // Assuming the context is empty
  });

  it("Should handle post-operation correctly", async function () {
    // Example test for _postOp (would require more context in a real case)
    const context = "0x";
    const mode = 0; // Mock mode
    const actualGasCost = ethers.parseEther("0.01");
    const actualUserOpFeePerGas = ethers.parseUnits("10", "gwei");

    // No specific checks, but we can ensure it doesn't revert
    await expect(
      paymaster.postOp(mode, context, actualGasCost, actualUserOpFeePerGas)
    ).to.not.be.reverted;
  });
});
