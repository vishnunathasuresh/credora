// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";

contract CredentialRegistryTest is Test {
    CredentialRegistry private registry;
    address private admin = makeAddr("admin");
    address private issuer = makeAddr("issuer");
    address private learner = makeAddr("learner");
    bytes32 private credentialHash = keccak256("credential-1");

    function setUp() public {
        registry = new CredentialRegistry(admin);
        vm.prank(admin);
        registry.setIssuerAuthorization(issuer, true);
    }

    function testAuthorizedIssuerCanIssueOnce() public {
        vm.prank(issuer);
        registry.issueCredential(credentialHash, learner, "ipfs://metadata");

        (address storedIssuer, address storedLearner, string memory uri,, bool exists) =
            registry.getCredential(credentialHash);
        assertEq(storedIssuer, issuer);
        assertEq(storedLearner, learner);
        assertEq(uri, "ipfs://metadata");
        assertTrue(exists);
    }

    function testUnauthorizedIssuerCannotIssue() public {
        vm.expectRevert();
        registry.issueCredential(credentialHash, learner, "ipfs://metadata");
    }

    function testCredentialCannotBeModifiedOrDuplicated() public {
        vm.prank(issuer);
        registry.issueCredential(credentialHash, learner, "ipfs://metadata");
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(CredentialRegistry.CredentialAlreadyExists.selector, credentialHash)
        );
        registry.issueCredential(credentialHash, learner, "ipfs://other");
    }

    function testAdminCanRevokeIssuerAuthorization() public {
        vm.prank(admin);
        registry.setIssuerAuthorization(issuer, false);
        assertFalse(registry.isAuthorizedIssuer(issuer));
    }
}
