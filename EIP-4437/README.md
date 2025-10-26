# EIP-4337 Smart Contracts

このディレクトリには、EIP-4337（Account Abstraction）準拠のスマートコントラクトが含まれています。

## 概要

EIP-4337は、Ethereumのアカウントアブストラクションを実現する提案です。これにより、スマートコントラクトウォレットを使用して、以下のような機能が可能になります:

- ガスレストランザクション
- バッチトランザクション
- カスタム署名検証
- アカウント復元
- セッションキー

## コントラクト構成

### コア契約

1. **SimpleAccount.sol**
   - EIP-4337準拠のスマートコントラクトウォレット
   - ECDSA署名による所有者検証
   - トランザクション実行機能
   - デポジット管理
   - `@account-abstraction/contracts`の公式インターフェースを使用

2. **SimpleAccountFactory.sol**
   - SimpleAccountを作成するファクトリコントラクト
   - CREATE2を使用した決定論的アドレス生成
   - プロキシパターンによる効率的なデプロイ

### 使用ライブラリ

- **@account-abstraction/contracts** (v0.7.0)
  - EIP-4337公式実装のインターフェース
  - `IAccount`, `IEntryPoint`, `PackedUserOperation`など
  - 標準準拠を保証

- **@openzeppelin/contracts** (v5.0.0)
  - ECDSA署名検証
  - プロキシパターン (ERC1967)
  - CREATE2ユーティリティ

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### コンパイル

```bash
npx hardhat compile
```

### テスト実行

```bash
npx hardhat test
```

### カバレッジ

```bash
npx hardhat coverage
```

## 環境変数

このプロジェクトは**GitHub Actions Secretsで環境変数を管理**します。ローカル開発時は、以下の環境変数を設定してください:

### 必須環境変数

- `SEPOLIA_RPC_URL` - Sepolia RPC URL (Infura, Alchemy等)
- `PRIVATE_KEY` - デプロイ用の秘密鍵
- `ENTRYPOINT_ADDRESS` - EntryPoint v0.7 アドレス (デフォルト: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`)

### オプション環境変数

- `PAYMASTER_SIGNER` - Paymaster署名者アドレス (デフォルト: デプロイヤーアドレス)
- `ETHERSCAN_API_KEY` - Etherscan API キー (コントラクト検証用)

**注意**: `.env`ファイルは使用しません。すべての環境変数はGitHub Actions Secretsまたはコマンドライン経由で設定してください。

## デプロイ

### ローカル環境

```bash
# Hardhatノードを起動（別ターミナル）
npx hardhat node

# スマートデプロイ実行
npx hardhat run scripts/deploy-changed.ts --network localhost
# または npm scriptで
npm run deploy:local
```

### Sepoliaテストネット

```bash
# 環境変数を設定してデプロイ
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY \
PRIVATE_KEY=0x... \
npx hardhat run scripts/deploy-changed.ts --network sepolia

# または npm scriptで
npm run deploy:sepolia
```

**スマートデプロイの仕組み**: 前回デプロイ以降に変更されたコントラクトのみを再デプロイするため、ガス代を大幅に節約できます。

## Docker環境

このプロジェクトはDocker Composeで実行できます:

```bash
# コンテナを起動
docker compose up -d eip4437

# コンテナに入る
docker exec -it ethr-test-hardhat sh

# Hardhatノードを起動（ホスト側38545でアクセス可能）
npx hardhat node --hostname 0.0.0.0
```

## CI/CD

GitHub Actionsを使用したスマート自動デプロイメントパイプライン:

### 特徴

- **変更検出**: `*.sol`ファイルの変更を自動検出
- **ガス最適化**: 変更されたコントラクトのみを再デプロイ
- **キャッシュ機能**: デプロイ情報を保存し、再利用
- **自動テスト**: デプロイ前に全テストを実行
- **セキュリティチェック**: Slitherによる自動脆弱性スキャン

### ワークフロー

1. **detect-changes**: `.sol`ファイルの変更を検出
2. **test**: 変更があった場合のみテスト実行
3. **deploy-testnet**: 変更されたコントラクトのみをSepoliaにデプロイ（mainブランチ）
4. **security-check**: セキュリティ分析実行

### 必要なGitHub Secrets

以下のSecretをGitHubリポジトリの Settings > Secrets and variables > Actions で設定してください:

#### 必須

- `SEPOLIA_RPC_URL` - Sepolia RPC URL (例: `https://sepolia.infura.io/v3/YOUR_KEY`)
- `DEPLOYER_PRIVATE_KEY` - デプロイ用秘密鍵 (例: `0x...`)
- `ENTRYPOINT_ADDRESS` - EntryPoint v0.7アドレス (デフォルト: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`)

#### オプション

- `PAYMASTER_SIGNER` - Paymaster署名者アドレス (未設定時はデプロイヤーアドレス使用)
- `ETHERSCAN_API_KEY` - Etherscan API キー (コントラクト検証用)

### ガス節約の仕組み

1. `deployments.json`にデプロイ済みコントラクト情報を保存
2. GitHub Actions Cacheでデプロイ履歴を永続化
3. 変更されていないコントラクトはスキップ
4. **結果**: 不要な再デプロイを回避し、ガス代を大幅削減!

## 使用例

### アカウント作成

```typescript
const factory = await ethers.getContractAt("SimpleAccountFactory", factoryAddress);
const owner = "0x...";
const salt = 0;

// アカウントを作成
await factory.createAccount(owner, salt);

// アカウントアドレスを取得
const accountAddress = await factory.getAddress(owner, salt);
```

### トランザクション実行

```typescript
const account = await ethers.getContractAt("SimpleAccount", accountAddress);

// 単一トランザクション実行
await account.execute(
  targetAddress,
  ethers.parseEther("0.1"),
  "0x" // calldata
);

// バッチトランザクション実行
await account.executeBatch(
  [target1, target2],
  [value1, value2],
  [data1, data2]
);
```

## アーキテクチャ

```
User
  |
  v
UserOperation
  |
  v
Bundler (off-chain)
  |
  v
EntryPoint (on-chain)
  |
  v
SimpleAccount
  |
  v
Target Contract
```

## セキュリティ

- OpenZeppelin Contractsを使用した安全な実装
- ECDSA署名検証
- ノンスベースのリプレイ攻撃対策
- EntryPointからのみ実行可能な検証関数

## ライセンス

GPL-3.0

## 参考リンク

- [EIP-4337仕様](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Abstraction公式サイト](https://www.erc4337.io/)
- [EntryPoint v0.6](https://github.com/eth-infinitism/account-abstraction)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
