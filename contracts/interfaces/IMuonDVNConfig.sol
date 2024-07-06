// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMuonDVNConfig {
    function getInfo(
        address oapp,
        string[] memory _configKeys
    ) external view returns (string[] memory);
}
