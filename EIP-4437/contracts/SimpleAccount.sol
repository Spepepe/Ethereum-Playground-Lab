// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/core/UserOperationLib.sol";

/**
 * @title SimpleAccount
 * @dev EIP-4337準拠のシンプルなアカウント実装
 * @notice 単一のECDSA署名者による検証をサポート
 */
contract SimpleAccount is IAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using UserOperationLib for PackedUserOperation;

    address public owner;
    IEntryPoint private immutable _entryPoint;
    uint256 private _nonce;

    event SimpleAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);

    uint256 internal constant SIG_VALIDATION_SUCCESS = 0;
    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    modifier onlyOwner() {
        require(msg.sender == owner || msg.sender == address(this), "only owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(_entryPoint), "not from EntryPoint");
        _;
    }

    /**
     * @dev コンストラクタ
     * @param anEntryPoint EntryPointコントラクトのアドレス
     */
    constructor(IEntryPoint anEntryPoint) {
        _entryPoint = anEntryPoint;
    }

    /**
     * @dev アカウントを初期化
     * @param anOwner アカウントの所有者アドレス
     */
    function initialize(address anOwner) public virtual {
        require(owner == address(0), "already initialized");
        owner = anOwner;
        emit SimpleAccountInitialized(_entryPoint, owner);
    }

    /**
     * @dev EntryPointアドレスを取得
     * @return EntryPointアドレス
     */
    function entryPoint() public view returns (IEntryPoint) {
        return _entryPoint;
    }

    /**
     * @dev ノンスを取得
     * @return 現在のノンス
     */
    function getNonce() public view returns (uint256) {
        return _nonce;
    }

    /**
     * @dev トランザクションを実行
     * @param dest 送信先アドレス
     * @param value 送金額
     * @param func 実行する関数のcalldata
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
        require(
            msg.sender == address(_entryPoint) || msg.sender == owner,
            "not authorized"
        );
        _call(dest, value, func);
    }

    /**
     * @dev 複数のトランザクションをバッチ実行
     * @param dest 送信先アドレスの配列
     * @param value 送金額の配列
     * @param func 実行する関数のcalldataの配列
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external {
        require(
            msg.sender == address(_entryPoint) || msg.sender == owner,
            "not authorized"
        );
        require(
            dest.length == func.length &&
                (value.length == 0 || value.length == func.length),
            "wrong array lengths"
        );

        if (value.length == 0) {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], 0, func[i]);
            }
        } else {
            for (uint256 i = 0; i < dest.length; i++) {
                _call(dest[i], value[i], func[i]);
            }
        }
    }

    /**
     * @dev UserOperationを検証
     * @param userOp 検証するUserOperation
     * @param userOpHash UserOperationのハッシュ
     * @param missingAccountFunds EntryPointに不足している資金
     * @return validationData 検証結果
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        validationData = _validateSignature(userOp, userOpHash);
        _validateNonce(userOp.nonce);
        _payPrefund(missingAccountFunds);
    }

    /**
     * @dev 署名を検証
     * @param userOp UserOperation
     * @param userOpHash UserOperationのハッシュ
     * @return validationData 検証結果（0=成功、1=失敗）
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address recovered = hash.recover(userOp.signature);

        if (owner != recovered) {
            return SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @dev ノンスを検証してインクリメント
     * @param nonce 検証するノンス
     */
    function _validateNonce(uint256 nonce) internal {
        require(nonce == _nonce, "invalid nonce");
        _nonce++;
    }

    /**
     * @dev EntryPointに必要な資金を送金
     * @param missingAccountFunds 不足している資金
     */
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds != 0) {
            (bool success, ) = payable(msg.sender).call{
                value: missingAccountFunds
            }("");
            require(success, "prefund failed");
        }
    }

    /**
     * @dev 低レベルのcallを実行
     * @param target ターゲットアドレス
     * @param value 送金額
     * @param data calldata
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @dev アカウントにETHを入金
     */
    function addDeposit() public payable {
        _entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * @dev EntryPointからETHを引き出し
     * @param withdrawAddress 引き出し先アドレス
     * @param amount 引き出し額
     */
    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) public onlyOwner {
        _entryPoint.withdrawTo(withdrawAddress, amount);
    }

    /**
     * @dev EntryPointのデポジット残高を取得
     * @return デポジット残高
     */
    function getDeposit() public view returns (uint256) {
        return _entryPoint.balanceOf(address(this));
    }

    /**
     * @dev ETHを直接受け取る
     */
    receive() external payable {}
}
