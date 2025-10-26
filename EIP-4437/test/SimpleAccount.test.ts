import { expect } from "chai";
import { ethers } from "hardhat";
import { SimpleAccountFactory, SimpleAccount } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleAccount", function () {
  let factory: SimpleAccountFactory;
  let account: SimpleAccount;
  let owner: SignerWithAddress;
  let entryPoint: SignerWithAddress;
  let other: SignerWithAddress;

  // モックEntryPointアドレス（テスト用）
  const MOCK_ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  beforeEach(async function () {
    [owner, entryPoint, other] = await ethers.getSigners();

    // SimpleAccountFactoryをデプロイ
    const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");
    factory = await SimpleAccountFactory.deploy(MOCK_ENTRYPOINT);
    await factory.waitForDeployment();

    // テストアカウントを作成
    const salt = 0;
    await factory.createAccount(owner.address, salt);
    const accountAddress = await factory.getAddress(owner.address, salt);
    account = await ethers.getContractAt("SimpleAccount", accountAddress);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await account.owner()).to.equal(owner.address);
    });

    it("Should set the correct EntryPoint", async function () {
      expect(await account.entryPoint()).to.equal(MOCK_ENTRYPOINT);
    });

    it("Should start with nonce 0", async function () {
      expect(await account.getNonce()).to.equal(0);
    });
  });

  describe("Account Creation", function () {
    it("Should create deterministic addresses", async function () {
      const salt = 123;
      const predictedAddress = await factory.getAddress(owner.address, salt);

      await factory.createAccount(owner.address, salt);
      const actualAddress = await factory.getAddress(owner.address, salt);

      expect(actualAddress).to.equal(predictedAddress);
    });

    it("Should not recreate existing accounts", async function () {
      const salt = 456;
      await factory.createAccount(owner.address, salt);
      const firstAddress = await factory.getAddress(owner.address, salt);

      // 再度作成を試みる
      await factory.createAccount(owner.address, salt);
      const secondAddress = await factory.getAddress(owner.address, salt);

      expect(firstAddress).to.equal(secondAddress);
    });
  });

  describe("Execute", function () {
    it("Should allow owner to execute", async function () {
      const target = other.address;
      const value = ethers.parseEther("0.1");
      const data = "0x";

      // アカウントにETHを送金
      await owner.sendTransaction({
        to: account.getAddress(),
        value: value,
      });

      const initialBalance = await ethers.provider.getBalance(target);

      await account.connect(owner).execute(target, value, data);

      const finalBalance = await ethers.provider.getBalance(target);
      expect(finalBalance - initialBalance).to.equal(value);
    });

    it("Should revert if not owner or EntryPoint", async function () {
      const target = other.address;
      const value = 0;
      const data = "0x";

      await expect(
        account.connect(other).execute(target, value, data)
      ).to.be.revertedWith("not authorized");
    });
  });

  describe("Deposit", function () {
    it("Should receive ETH", async function () {
      const amount = ethers.parseEther("1");

      await owner.sendTransaction({
        to: account.getAddress(),
        value: amount,
      });

      const balance = await ethers.provider.getBalance(account.getAddress());
      expect(balance).to.equal(amount);
    });
  });
});
