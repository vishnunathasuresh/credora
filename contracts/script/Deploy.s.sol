// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";

contract Deploy is Script {
    function run() external returns (CredentialRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        registry = new CredentialRegistry(admin);
        vm.stopBroadcast();
    }
}
