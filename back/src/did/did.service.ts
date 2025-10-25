import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { getResolver } from 'ethr-did-resolver';
import { Resolver } from 'did-resolver';

@Injectable()
export class DidService {
  private provider: ethers.providers.JsonRpcProvider;
  private resolver: Resolver;
  private adminWallet: ethers.Wallet;
  private registryAddress: string;

  private registryAbi = [
    'function changeOwner(address identity, address newOwner) public',
    'function changeOwnerSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, address newOwner) public',
    'function setAttribute(address identity, bytes32 name, bytes value, uint validity) public',
    'function setAttributeSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 name, bytes value, uint validity) public',
    'function revokeAttribute(address identity, bytes32 name, bytes value) public',
    'function identityOwner(address identity) public view returns (address)',
    'function nonce(address identity) public view returns (uint256)',
  ];

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SEPOLIA_RPC_URL') ?? '';
    this.registryAddress =
      this.configService.get<string>('ETHR_DID_REGISTRY') ??
      '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818';

    const adminPrivateKey =
      this.configService.get<string>('ADMIN_PRIVATE_KEY') ?? '';

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);

    // ✅ DID Resolver 設定
    this.resolver = new Resolver(
      getResolver({
        networks: [
          {
            name: 'sepolia',
            chainId: 11155111,
            rpcUrl,
            registry: this.registryAddress,
          },
        ],
      }),
    );
  }

  /** ✅ 初期化チェック: adminWalletがDID未登録なら登録 */
  private async ensureAdminRegistered(): Promise<void> {
    const registry = new ethers.Contract(
      this.registryAddress,
      this.registryAbi,
      this.adminWallet,
    );
    const currentOwner = await registry.identityOwner(this.adminWallet.address);

    if (currentOwner === ethers.constants.AddressZero) {
      const tx = await registry.changeOwner(
        this.adminWallet.address,
        this.adminWallet.address,
      );
      await tx.wait();
    }
  }

  /**
   * 新規DID登録（リレイヤー方式）
   * @returns {Promise<{did: string, address: string, publicKey: string, privateKey: string, transactionHash: string, note: string}>} DID登録結果
   */
  async registerDid(): Promise<{
    did: string;
    address: string;
    publicKey: string;
    privateKey: string;
    transactionHash: string;
    note: string;
  }> {
    await this.ensureAdminRegistered();

    const newWallet = ethers.Wallet.createRandom();
    const did = `did:ethr:sepolia:${newWallet.address}`;

    const registry = new ethers.Contract(
      this.registryAddress,
      this.registryAbi,
      this.adminWallet,
    );

    try {
      // Step 1: newWalletの署名を作成（adminWalletを所有者に設定）
      const nonce = await registry.nonce(newWallet.address);
      const messageHash = ethers.utils.solidityKeccak256(
        ['bytes1', 'bytes1', 'address', 'uint256', 'address', 'string', 'address'],
        ['0x19', '0x00', this.registryAddress, nonce, newWallet.address, 'changeOwner', this.adminWallet.address]
      );
      
      const signingKey = new ethers.utils.SigningKey(newWallet.privateKey);
      const { v, r, s } = signingKey.signDigest(messageHash);
      
      // Step 2: adminが代理でトランザクション送信（adminWalletを所有者に設定）
      const tx = await registry.changeOwnerSigned(newWallet.address, v, r, s, this.adminWallet.address);
      const receipt = await tx.wait();

      // Step 3: 公開鍵を属性として登録
      try {
        const pubKeyName = ethers.utils.formatBytes32String('did/pub/secp256k1/veriKey');
        const pubKeyValue = ethers.utils.toUtf8Bytes(newWallet.publicKey);
        const validity = 31536000;
        const pubKeyTx = await registry.setAttribute(
          newWallet.address,
          pubKeyName,
          pubKeyValue,
          validity,
          { gasLimit: 300000 }
        );
        await pubKeyTx.wait();
      } catch (attrError: any) {
        // 公開鍵登録失敗は無視してDID登録を継続
      }

      return {
        did,
        address: newWallet.address,
        publicKey: newWallet.publicKey,
        privateKey: newWallet.privateKey,
        transactionHash: receipt.transactionHash,
        note: 'DID登録完了',
      };
    } catch (error: any) {
      throw new Error(`DID登録処理に失敗しました: ${error.message}`);
    }
  }

  /**
   * DIDに属性を追加
   * @param {string} did - 対象のDID
   * @param {string} attributeName - 属性名
   * @param {string} attributeValue - 属性値
   * @returns {Promise<{success: boolean, transactionHash: string, did: string}>} 処理結果
   */
  async addAttribute(
    did: string,
    attributeName: string,
    attributeValue: string,
  ): Promise<{ success: boolean; transactionHash: string; did: string }> {
    await this.ensureAdminRegistered();

    try {
      const registry = new ethers.Contract(
        this.registryAddress,
        this.registryAbi,
        this.adminWallet,
      );

      // DIDからアドレスを正しく抽出
      let identity: string;
      if (did.startsWith('did:ethr:')) {
        const parts = did.split(':');
        identity = parts[parts.length - 1].replace(/[^a-fA-F0-9x]/g, '');
        if (!ethers.utils.isAddress(identity)) {
          throw new Error(`無効なDIDアドレス形式: ${identity}`);
        }
      } else {
        throw new Error(`サポートされていないDID形式: ${did}`);
      }

      const currentOwner = await registry.identityOwner(identity);
      if (currentOwner.toLowerCase() !== this.adminWallet.address.toLowerCase()) {
        throw new Error(`権限不足: adminWallet (${this.adminWallet.address}) は DID ${identity} の所有者ではありません。現在の所有者: ${currentOwner}`);
      }

      // 属性名を32バイト以内に制限
      if (attributeName.length > 31) {
        throw new Error(`属性名が長すぎます（31文字以内）: ${attributeName}`);
      }
      
      const name = ethers.utils.formatBytes32String(attributeName);
      const value = ethers.utils.toUtf8Bytes(attributeValue);
      const validity = 31536000;

      const tx = await registry.setAttribute(
        identity,
        name,
        value,
        validity,
        { gasLimit: 300000 }
      );
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.transactionHash, did };
    } catch (error: any) {
      throw new Error(`属性追加に失敗しました: ${error.message}`);
    }
  }

  /**
   * DIDから属性を削除
   * @param {string} did - 対象のDID
   * @param {string} attributeName - 削除する属性名
   * @returns {Promise<{success: boolean, transactionHash: string, did: string}>} 処理結果
   */
  async removeAttribute(
    did: string,
    attributeName: string,
  ): Promise<{ success: boolean; transactionHash: string; did: string }> {
    await this.ensureAdminRegistered();

    try {
      const registry = new ethers.Contract(
        this.registryAddress,
        this.registryAbi,
        this.adminWallet,
      );

      // DIDからアドレスを正しく抽出
      let identity: string;
      if (did.startsWith('did:ethr:')) {
        const parts = did.split(':');
        identity = parts[parts.length - 1].replace(/[^a-fA-F0-9x]/g, '');
        if (!ethers.utils.isAddress(identity)) {
          throw new Error(`無効なDIDアドレス形式: ${identity}`);
        }
      } else {
        throw new Error(`サポートされていないDID形式: ${did}`);
      }

      const name = ethers.utils.formatBytes32String(attributeName);
      const tx = await registry.revokeAttribute(
        identity,
        name,
        ethers.utils.toUtf8Bytes(''),
        { gasLimit: 200000 }
      );
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.transactionHash, did };
    } catch (error: any) {
      throw new Error(`属性削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * DIDを削除（ownerをゼロアドレスに変更）
   * @param {string} did - 削除対象のDID
   * @returns {Promise<{success: boolean, transactionHash: string, did: string}>} 処理結果
   */
  async deleteDid(
    did: string,
  ): Promise<{ success: boolean; transactionHash: string; did: string }> {
    await this.ensureAdminRegistered();

    try {
      const registry = new ethers.Contract(
        this.registryAddress,
        this.registryAbi,
        this.adminWallet,
      );

      // DIDからアドレスを正しく抽出
      let identity: string;
      if (did.startsWith('did:ethr:')) {
        const parts = did.split(':');
        identity = parts[parts.length - 1].replace(/[^a-fA-F0-9x]/g, '');
        if (!ethers.utils.isAddress(identity)) {
          throw new Error(`無効なDIDアドレス形式: ${identity}`);
        }
      } else {
        throw new Error(`サポートされていないDID形式: ${did}`);
      }

      const tx = await registry.changeOwner(
        identity,
        ethers.constants.AddressZero,
        { gasLimit: 200000 }
      );
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.transactionHash, did };
    } catch (error: any) {
      throw new Error(`DID削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * DIDドキュメントを解決
   * @param {string} did - 解決対象のDID
   * @returns {Promise<Record<string, any> | null>} DIDドキュメント
   */
  async resolveDid(did: string): Promise<Record<string, any> | null> {
    const result = await this.resolver.resolve(did);
    return result?.didDocument ?? null;
  }
}
