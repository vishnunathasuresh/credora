// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OrganizationCredentialRegistry} from "../src/OrganizationCredentialRegistry.sol";

contract OrganizationCredentialRegistryTest is Test {
    OrganizationCredentialRegistry private registry;
    address private superadmin = makeAddr("superadmin");
    address private owner = makeAddr("owner");
    address private orgAdmin = makeAddr("org-admin");
    address private issuer = makeAddr("issuer");
    address private learner = makeAddr("learner");
    bytes32 private organizationId = keccak256("organization-1");

    function setUp() public {
        registry = new OrganizationCredentialRegistry(superadmin);
        vm.prank(superadmin);
        registry.activateOrganization(organizationId, owner, "ipfs://organization");
    }

    function testInitialOwnerCanIssueWithoutSecondPlatformAuthorization() public {
        bytes32 credentialHash = keccak256("credential-1");

        vm.prank(owner);
        registry.issueCredential(organizationId, credentialHash, learner, "ipfs://credential");

        (bytes32 storedOrganizationId, address storedIssuer, address storedLearner,,, bool exists) =
            registry.getCredential(credentialHash);
        assertEq(storedOrganizationId, organizationId);
        assertEq(storedIssuer, owner);
        assertEq(storedLearner, learner);
        assertTrue(exists);
    }

    function testOrganizationAdminCanDelegateAndRevokeIssuer() public {
        vm.prank(owner);
        registry.setOrganizationAdmin(organizationId, orgAdmin, true);
        vm.prank(orgAdmin);
        registry.setIssuerAuthorization(organizationId, issuer, true);
        assertTrue(registry.isAuthorizedIssuer(organizationId, issuer));

        vm.prank(orgAdmin);
        registry.setIssuerAuthorization(organizationId, issuer, false);
        assertFalse(registry.isAuthorizedIssuer(organizationId, issuer));
    }

    function testUnrelatedWalletCannotDelegateIssuer() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                OrganizationCredentialRegistry.OrganizationAdminRequired.selector,
                organizationId,
                address(this)
            )
        );
        registry.setIssuerAuthorization(organizationId, issuer, true);
    }

    function testSuspensionBlocksEveryIssuerAndCanOnlyBeChangedBySuperadmin() public {
        vm.prank(superadmin);
        registry.setOrganizationSuspended(organizationId, true);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                OrganizationCredentialRegistry.OrganizationSuspended.selector,
                organizationId
            )
        );
        registry.issueCredential(organizationId, keccak256("credential-2"), learner, "ipfs://credential");

        vm.prank(owner);
        vm.expectRevert();
        registry.setOrganizationSuspended(organizationId, false);
    }

    function testBatchIssuanceIsAtomicAndOrganizationBound() public {
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256("credential-3");
        hashes[1] = keccak256("credential-4");
        address[] memory learners = new address[](2);
        learners[0] = learner;
        learners[1] = makeAddr("learner-2");
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://credential-3";
        uris[1] = "ipfs://credential-4";

        vm.prank(owner);
        registry.issueCredentials(organizationId, hashes, learners, uris);

        (bytes32 firstOrganizationId,,,,, bool firstExists) = registry.getCredential(hashes[0]);
        (bytes32 secondOrganizationId,,,,, bool secondExists) = registry.getCredential(hashes[1]);
        assertEq(firstOrganizationId, organizationId);
        assertEq(secondOrganizationId, organizationId);
        assertTrue(firstExists);
        assertTrue(secondExists);
    }

    function testBatchWithDuplicateHashRevertsWithoutPartialIssuance() public {
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256("credential-5");
        hashes[1] = hashes[0];
        address[] memory learners = new address[](2);
        learners[0] = learner;
        learners[1] = makeAddr("learner-2");
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://credential-5";
        uris[1] = "ipfs://credential-5-copy";

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                OrganizationCredentialRegistry.CredentialAlreadyExists.selector,
                hashes[0]
            )
        );
        registry.issueCredentials(organizationId, hashes, learners, uris);

        (,,,,, bool exists) = registry.getCredential(hashes[0]);
        assertFalse(exists);
    }
}
