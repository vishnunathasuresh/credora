// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {OrganizationCredentialRegistry} from "../src/OrganizationCredentialRegistry.sol";

contract DeployOrganizationCredentialRegistry is Script {
    function run() external returns (OrganizationCredentialRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        registry = new OrganizationCredentialRegistry(admin);
        vm.stopBroadcast();
    }
}
