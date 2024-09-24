import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, parseEther, Signer } from "ethers";
import {
  EntryPoint,
  MultiOwnerLightAccountFactory,
  TokenPaymaster,
  TestERC20__factory,
  TestERC20,
  TestOracle2__factory,
  TestOracle2,
  TokenPaymaster__factory,
  TestUniswap__factory,
  TestUniswap,
  SimpleIncrementer,
  TestWrappedNativeToken__factory,
  TestWrappedNativeToken,
  MultiOwnerLightAccount,
} from "../typechain";

import {
  OracleHelper,
  UniswapHelper,
} from "../typechain/@account-abstraction/contracts/samples/TokenPaymaster";

import { createUserOp } from "./utils";

describe("TokenPaymaster", function () {
  let entryPoint: EntryPoint,
    entryPointAddress: string,
    tokenPaymaster: TokenPaymaster,
    tokenPaymasterAddress: string,
    signer: Signer,
    addr1: Signer,
    signerAddress: string,
    multiOwnerAccountFactory: MultiOwnerLightAccountFactory,
    multiOwnerAccountFactoryAddress: string,
    wethOracle: TestOracle2,
    tokenOracle: TestOracle2,
    simpleIncrementer: SimpleIncrementer,
    simpleIncrementerAddress: string,
    token: TestERC20,
    weth: TestWrappedNativeToken,
    uniswap: TestUniswap,
    chainId: number,
    now: number;

  const priceDenominator = 10n ** 26n; // same as BigNumber.from(10).pow(26)
  const minEntryPointBalance = (1e17).toString();
  const initialPriceToken = 100000000; // USD per Token
  const initialPriceEther = 500000000; // USD per ETH

  beforeEach(async function () {
    [signer, addr1] = await ethers.getSigners();
    signerAddress = await signer.getAddress();
    chainId = Number((await ethers.provider.getNetwork()).chainId);
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

    // deploy tokens
    token = await new TestERC20__factory(signer).deploy("TestToken", "TTKN", 6);
    weth = await new TestWrappedNativeToken__factory(signer).deploy();
    await weth.deposit({ value: parseEther("1") });

    // deploy uniswap
    uniswap = await new TestUniswap__factory(signer).deploy(
      await weth.getAddress()
    );
    await weth.transfer(await uniswap.getAddress(), parseEther("1"));

    // deploy oracles
    wethOracle = await new TestOracle2__factory(signer).deploy(
      initialPriceEther,
      8
    );

    tokenOracle = await new TestOracle2__factory(signer).deploy(
      initialPriceToken,
      8
    );

    // TokenPaymaster configs
    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
      priceMaxAge: 86400,
      refundPostopCost: 50000,
      minEntryPointBalance,
      priceMarkup: (priceDenominator * 15n) / 10n,
    };

    const oracleHelperConfig: OracleHelper.OracleHelperConfigStruct = {
      cacheTimeToLive: 0,
      maxOracleRoundAge: 0,
      nativeOracle: await wethOracle.getAddress(),
      nativeOracleReverse: false,
      priceUpdateThreshold: ((priceDenominator * 12n) / 100n).toString(), // 20%
      tokenOracle: await tokenOracle.getAddress(),
      tokenOracleReverse: false,
      tokenToNativeOracle: false,
    };

    const uniswapHelperConfig: UniswapHelper.UniswapHelperConfigStruct = {
      minSwapAmount: 1,
      slippage: 5,
      uniswapPoolFee: 3,
    };

    // Deploy the TokenPaymaster contract
    tokenPaymaster = await new TokenPaymaster__factory(signer).deploy(
      await token.getAddress(),
      entryPointAddress,
      await weth.getAddress(),
      await uniswap.getAddress(),
      tokenPaymasterConfig,
      oracleHelperConfig,
      uniswapHelperConfig,
      await signer.getAddress()
    );

    tokenPaymasterAddress = await tokenPaymaster.getAddress();

    await token.transfer(tokenPaymasterAddress, 100);
    await tokenPaymaster.updateCachedPrice(true);
    await entryPoint.depositTo(tokenPaymasterAddress, {
      value: parseEther("1000"),
    });

    await tokenPaymaster.addStake(1, { value: parseEther("2") });
  });

  it("Should deploy all contracts correctly", async function () {
    expect(simpleIncrementerAddress).to.be.properAddress;
    expect(entryPointAddress).to.be.properAddress;
    expect(tokenPaymasterAddress).to.be.properAddress;
    expect(await tokenPaymaster.token()).to.equal(await token.getAddress());
    expect(await tokenPaymaster.wrappedNative()).to.equal(
      await weth.getAddress()
    );
    expect(await tokenPaymaster.uniswap()).to.equal(await uniswap.getAddress());
    expect(await tokenPaymaster.entryPoint()).to.equal(entryPointAddress);
  });

  it("Should process a user op using TokenPaymaster", async function () {
    const config = await tokenPaymaster.tokenPaymasterConfig();
    const abiCoder = new ethers.AbiCoder();
    const timeRange = abiCoder.encode(["uint48", "uint48"], [now, now + 60]);

    let txPopulated = await multiOwnerAccountFactory.createAccount(
      [signerAddress],
      0
    );

    delete txPopulated.gasPrice;

    let txReceipt = await ethers.provider.send("eth_call", [txPopulated]);

    const smartAccountAddress = "0x" + txReceipt.slice(-40);

    const smartAccount = (await ethers.getContractAt(
      "MultiOwnerLightAccount",
      smartAccountAddress
    )) as unknown as MultiOwnerLightAccount;

    // fund account
    await signer.sendTransaction({
      to: smartAccountAddress,
      value: parseEther("10"),
    });

    const userOp = await createUserOp({
      sender: smartAccountAddress,
      nonce: await entryPoint.getNonce(smartAccountAddress, 0),
      initCode: "0x",
      callData: smartAccount.interface.encodeFunctionData("execute", [
        simpleIncrementerAddress,
        0,
        simpleIncrementer.interface.encodeFunctionData("increment"),
      ]),
      paymasterAddress: tokenPaymasterAddress,
      paymasterPostOpGasLimit: 600000n,
      isTokenPaymaster: true,
      tokenPaymasterData: 500000n,
    });

    const userOpHash = await entryPoint.getUserOpHash(userOp);

    let signature = await signer.signMessage(ethers.getBytes(userOpHash));

    userOp.signature = ethers.concat(["0x00", signature]);

    await token.transfer(
      smartAccountAddress,
      4700000000000000000000000000000000000n
    );

    await token.sudoApprove(
      smartAccountAddress,
      tokenPaymasterAddress,
      ethers.MaxUint256
    );

    await entryPoint.handleOps([userOp], signerAddress);
  });
});
