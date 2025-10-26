// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "./SimpleAccount.sol";

/**
 * @title SimpleAccountFactory
 * @dev SimpleAccountを作成するファクトリコントラクト
 */
contract SimpleAccountFactory {
    SimpleAccount public immutable accountImplementation;

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    /**
     * @dev コンストラクタ
     * @param _entryPoint EntryPointアドレス
     */
    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new SimpleAccount(_entryPoint);
    }

    /**
     * @dev アカウントを作成（または既存のものを取得）
     * @param owner アカウントの所有者
     * @param salt CREATE2用のsalt
     * @return ret 作成されたアカウントのアドレス
     */
    function createAccount(address owner, uint256 salt)
        public
        returns (SimpleAccount ret)
    {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;

        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }

        ret = SimpleAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )
        );

        emit AccountCreated(address(ret), owner, salt);
    }

    /**
     * @dev アカウントアドレスを計算（まだ作成されていなくても）
     * @param owner アカウントの所有者
     * @param salt CREATE2用のsalt
     * @return アカウントアドレス
     */
    function getAddress(address owner, uint256 salt)
        public
        view
        returns (address)
    {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(SimpleAccount.initialize, (owner))
                        )
                    )
                )
            );
    }
}
