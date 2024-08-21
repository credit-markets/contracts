import { expect } from "chai";
import { ethers } from "hardhat";
import { DefaultsForUserOp } from "./UserOp";
import { Signer, zeroPadValue, toBeHex } from "ethers";
import { EntryPoint, SimplePaymaster } from "../typechain";

describe("SimplePaymaster", function () {
  let entryPoint: EntryPoint,
    paymaster: SimplePaymaster,
    owner: Signer,
    addr1: Signer,
    addr2: Signer,
    entryPointAddress: string,
    paymasterAddress: string;

  beforeEach(async function () {
    try {
      [owner, addr1, addr2] = await ethers.getSigners();

      // Deploy the EntryPoint contract
      const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
      const deploymentEntrypoint = await EntryPointFactory.deploy();
      entryPoint = (await deploymentEntrypoint.waitForDeployment()) as any;
      entryPointAddress = await deploymentEntrypoint.getAddress();

      // Deploy the SimplePaymaster contract
      const Paymaster = await ethers.getContractFactory("SimplePaymaster");
      const paymasterDeployment = await Paymaster.deploy(entryPointAddress);
      paymaster = (await paymasterDeployment.waitForDeployment()) as any;
      paymasterAddress = await paymaster.getAddress();
    } catch (error) {
      console.error("Error in beforeEach:", error);
    }
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

    const verificationGasLimit = String(
      BigInt(DefaultsForUserOp.verificationGasLimit) + BigInt(21000)
    );
    const callGasLimit = String(
      BigInt(DefaultsForUserOp.preVerificationGas) + BigInt(21000)
    );

    const userOp = {
      sender: await addr1.getAddress(),
      nonce: 0,
      initCode: "0x",
      callData: "0x",
      // accountGasLimits: ethers.hexConcat([
      //   ethers.utils.hexZeroPad(ethers.hexlify(verificationGasLimit), 16),
      //   ethers.hexZeroPad(ethers.hexlify(callGasLimit), 16),
      // ]),
      accountGasLimits: ethers.concat([
        zeroPadValue(toBeHex(verificationGasLimit), 16),
        zeroPadValue(toBeHex(callGasLimit), 16),
      ]),
      preVerificationGas: 21000,
      gasFees: ethers.concat([
        zeroPadValue(toBeHex(DefaultsForUserOp.maxPriorityFeePerGas), 16),
        zeroPadValue(toBeHex(DefaultsForUserOp.maxFeePerGas), 16),
      ]),
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
    await expect(
      paymaster.validatePaymasterUserOp(userOp, requestId, maxCost)
    ).to.be.revertedWith("Sender not EntryPoint");
  });
});
