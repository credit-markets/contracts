import { expect } from "chai";
import { ethers } from "hardhat";

describe("SimpleIncrementer", function () {
  async function deploySimpleIncrementerFixture() {
    // Deploy the SimpleIncrementer contract
    const SimpleIncrementer = await ethers.getContractFactory("SimpleIncrementer");
    const simpleIncrementer = await SimpleIncrementer.deploy();

    // The deployer is the default signer
    const [owner] = await ethers.getSigners();

    return { simpleIncrementer, owner };
  }

  describe("Deployment", function () {
    it("Should initialize with number set to 0", async function () {
      const { simpleIncrementer } = await deploySimpleIncrementerFixture();

      expect(await simpleIncrementer.getNumber()).to.equal(0);
    });
  });

  describe("Increment", function () {
    it("Should increment the number by 1", async function () {
      const { simpleIncrementer } = await deploySimpleIncrementerFixture();

      await simpleIncrementer.increment();

      expect(await simpleIncrementer.getNumber()).to.equal(1);
    });

    it("Should increment the number multiple times", async function () {
      const { simpleIncrementer } = await deploySimpleIncrementerFixture();

      await simpleIncrementer.increment();
      await simpleIncrementer.increment();
      await simpleIncrementer.increment();

      expect(await simpleIncrementer.getNumber()).to.equal(3);
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to call increment (if access control is added later)", async function () {
      const { simpleIncrementer, owner } = await deploySimpleIncrementerFixture();

      // Only the owner can increment; if access control is needed, modify the contract accordingly
      await expect(simpleIncrementer.connect(owner).increment()).not.to.be.reverted;
    });
  });
});
