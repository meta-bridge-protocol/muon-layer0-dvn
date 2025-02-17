// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract MuonDVNConfig is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");

    uint256 public lastConfigIndex;

    // oapp => shield node address
    mapping(address => address) public shieldNodes;
    mapping(uint256 => string) public configKeys; // this lets user configure any possible parameter (that has been coded in the jsdapp)
    mapping(string => uint256) public configKeyIndexes;
    // oapp => (key => value)
    mapping(address => mapping(string => string)) public configs;

    event ConfigKeyAdd(string indexed key, uint256 index);
    event ConfigKeyRemove(string indexed key);
    event ConfigSet(address indexed oapp, string indexed key, string value);
    event ShieldNodeSet(address indexed oapp, address indexed shieldNode);
    event ConfigUnSet(address indexed oapp, string indexed key);
    event Verified(uint32 srcEid, uint256 jobId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CONFIG_ROLE, msg.sender);
    }

    /**
     * @dev Add several configuration keys.
     * Only callable by the ADMIN_ROLE.
     * @param keys The configuration keys.
     * @notice keys lets user configure any possible parameter (that has been coded in the jsdapp)
     */
    function addConfigKeys(string[] memory keys) external onlyRole(ADMIN_ROLE) {
        uint256 length = keys.length;
        for (uint256 i = 0; i < length; i++) {
            string memory key = keys[i];
            require(configKeyIndexes[key] == 0, "Already existed");
            configKeyIndexes[key] = ++lastConfigIndex;
            configKeys[lastConfigIndex] = key;
            emit ConfigKeyAdd(key, lastConfigIndex);
        }
    }

    /**
     * @dev Remove several configuration keys.
     * Only callable by the ADMIN_ROLE.
     * @param keys The configuration keys.
     */
    function removeConfigKey(
        string[] memory keys
    ) external onlyRole(ADMIN_ROLE) {
        uint256 length = keys.length;
        for (uint256 i = 0; i < length; i++) {
            string memory key = keys[i];
            require(configKeyIndexes[key] != 0, "Invalid key");
            uint256 index = configKeyIndexes[key];
            delete configKeyIndexes[key];
            delete configKeys[index];
            emit ConfigKeyRemove(key);
        }
    }

    /**
     * @dev Set multiple configuration values.
     * Only callable by the CONFIG_ROLE.
     * @param oapp The address of OApp.
     * @param keys The configuration keys.
     * @param values The values to be set.
     */
    function setConfig(
        address oapp,
        string[] memory keys,
        string[] memory values
    ) external onlyRole(CONFIG_ROLE) {
        require(keys.length == values.length, "Mismatched lengths");
        uint256 length = keys.length;
        for (uint256 i = 0; i < length; i++) {
            string memory key = keys[i];
            string memory val = values[i];
            require(configKeyIndexes[key] != 0, "Invalid key");
            configs[oapp][key] = val;
            emit ConfigSet(oapp, key, val);
        }
    }

    /**
     * @dev Unset multiple configuration values.
     * Only callable by the CONFIG_ROLE.
     * @param keys The configuration keys.
     */
    function unsetConfig(
        address oapp,
        string[] memory keys
    ) external onlyRole(CONFIG_ROLE) {
        uint256 length = keys.length;
        for (uint256 i = 0; i < length; i++) {
            string memory key = keys[i];
            require(configKeyIndexes[key] != 0, "Invalid key");
            delete configs[oapp][key];
            emit ConfigUnSet(oapp, key);
        }
    }

    /**
     * @dev Set oapp's shield node.
     * Only callable by the CONFIG_ROLE.
     * @param oapp The address of OApp.
     * @param shieldNode The configuration keys.
     */
    function setShieldNode(
        address oapp,
        address shieldNode
    ) external onlyRole(CONFIG_ROLE) {
        shieldNodes[oapp] = shieldNode;
        emit ShieldNodeSet(oapp, shieldNode);
    }

    /**
     * @dev Retrieves various contract information.
     * @param _configKeys An array of configuration keys to retrieve.
     * @return configValues An array of configuration values corresponding to the keys.
     * @return shieldNode The address of oapp's shield node.
     */
    function getInfo(
        address oapp,
        string[] memory _configKeys
    ) external view returns (string[] memory, address) {
        uint256 configLength = _configKeys.length;
        string[] memory configValues = new string[](configLength);
        for (uint256 i = 0; i < configLength; i++) {
            configValues[i] = configs[oapp][_configKeys[i]];
        }
        return (configValues, shieldNodes[oapp]);
    }
}
