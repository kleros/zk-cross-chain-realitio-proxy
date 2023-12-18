// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "../zkRealitioHomeProxy.sol";

/**
 * @dev The purpose of this contract is to override the precompiled L1Messenger.
 */
contract MockZkHomeProxy is zkRealitioHomeProxy {
    event L1MessageSent(bytes _data);

    constructor(
        RealitioInterface _realitio,
        uint256 _foreignChainId,
        address _foreignProxy,
        address _foreignProxyAlias,
        string memory _metadata
    ) zkRealitioHomeProxy(_realitio, _foreignChainId, _foreignProxy, _foreignProxyAlias, _metadata) {}

    function sendToL1(bytes memory _data) internal override {
        emit L1MessageSent(_data);
    }
}
