// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMuonDVNConfig {
    function shieldNodes(address oapp) external view returns (address);

    function getInfo(
        address oapp,
        string[] memory _configKeys
    ) external view returns (string[] memory);
}
