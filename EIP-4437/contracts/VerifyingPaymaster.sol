// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";

/**
 * @title VerifyingPaymaster
 * @dev 署名検証型Paymaster - オフチェーンで署名された承認に基づいてガス代を支払う
 */
contract VerifyingPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public verifyingSigner;

    event VerifyingSignerChanged(
        address indexed oldSigner,
        address indexed newSigner,
        address indexed actor
    );

    /**
     * @dev コンストラクタ
     * @param _entryPoint EntryPointアドレス
     * @param _verifyingSigner 検証用署名者アドレス
     */
    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner
    ) BasePaymaster(_entryPoint) {
        _setVerifyingSigner(_verifyingSigner);
    }

    /**
     * @dev 検証用署名者を設定
     * @param _newVerifyingSigner 新しい署名者アドレス
     */
    function setVerifyingSigner(address _newVerifyingSigner) external onlyOwner {
        _setVerifyingSigner(_newVerifyingSigner);
    }

    /**
     * @dev 内部: 検証用署名者を設定
     * @param _newVerifyingSigner 新しい署名者アドレス
     */
    function _setVerifyingSigner(address _newVerifyingSigner) internal {
        address oldSigner = verifyingSigner;
        verifyingSigner = _newVerifyingSigner;
        emit VerifyingSignerChanged(oldSigner, _newVerifyingSigner, msg.sender);
    }

    /**
     * @dev UserOperationを検証
     * @param userOp UserOperation
     * @param userOpHash UserOperationハッシュ
     * @param maxCost 最大コスト
     * @return context 検証コンテキスト
     * @return validationData 検証結果
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    )
        internal
        view
        override
        returns (bytes memory context, uint256 validationData)
    {
        (userOpHash, maxCost); // 未使用パラメータの警告を回避

        // paymasterAndDataから署名を抽出
        // フォーマット: [paymasterAddress(20 bytes)][validUntil(6 bytes)][validAfter(6 bytes)][signature(65 bytes)]
        require(
            userOp.paymasterAndData.length >= 97,
            "VerifyingPaymaster: invalid paymasterAndData length"
        );

        uint48 validUntil = uint48(bytes6(userOp.paymasterAndData[20:26]));
        uint48 validAfter = uint48(bytes6(userOp.paymasterAndData[26:32]));
        bytes calldata signature = userOp.paymasterAndData[32:];

        // ハッシュを構築
        bytes32 hash = keccak256(
            abi.encode(
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                userOp.gasFees,
                validUntil,
                validAfter
            )
        );

        // 署名を検証
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);

        if (recovered != verifyingSigner) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        // 検証成功
        return ("", _packValidationData(false, validUntil, validAfter));
    }

    /**
     * @dev UserOperation実行後の処理（オーバーライド可能）
     * @param mode 実行モード
     * @param context 検証時のコンテキスト
     * @param actualGasCost 実際のガスコスト
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal virtual override {
        (mode, context, actualGasCost, actualUserOpFeePerGas); // 未使用の警告を回避
        // 必要に応じて実装（例: 使用量の記録など）
    }
}
