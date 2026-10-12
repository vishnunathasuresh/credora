// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/access/AccessControl.sol";

/// @title OrganizationCredentialRegistry
/// @notice Versioned registry for organization-bound credentials and delegated issuer keys.
/// @dev The default administrator activates and suspends organizations. Organization admins
///      manage their own admins and issuer keys; no platform action is needed per credential.
contract OrganizationCredentialRegistry is AccessControl {
    struct Organization {
        address initialAdmin;
        string metadataUri;
        uint64 activatedAt;
        bool exists;
        bool suspended;
    }

    struct Credential {
        bytes32 organizationId;
        address issuer;
        address learner;
        string metadataUri;
        uint64 issuedAt;
        bool exists;
    }

    mapping(bytes32 => Organization) private organizations;
    mapping(bytes32 => mapping(address => bool)) private organizationAdmins;
    mapping(bytes32 => uint256) private organizationAdminCount;
    mapping(bytes32 => mapping(address => bool)) private issuerAuthorizations;
    mapping(bytes32 => Credential) private credentials;

    event OrganizationActivated(
        bytes32 indexed organizationId,
        address indexed initialAdmin,
        string metadataUri,
        uint64 activatedAt
    );
    event OrganizationAdminChanged(
        bytes32 indexed organizationId,
        address indexed account,
        bool authorized
    );
    event OrganizationIssuerAuthorizationChanged(
        bytes32 indexed organizationId,
        address indexed issuer,
        bool authorized
    );
    event OrganizationMetadataUpdated(bytes32 indexed organizationId, string metadataUri);
    event OrganizationSuspensionChanged(bytes32 indexed organizationId, bool suspended);
    event OrganizationCredentialIssued(
        bytes32 indexed credentialHash,
        bytes32 indexed organizationId,
        address indexed issuer,
        address learner,
        string metadataUri,
        uint64 issuedAt
    );

    error InvalidOrganizationId();
    error InvalidOrganizationAdmin();
    error InvalidIssuer();
    error OrganizationAlreadyExists(bytes32 organizationId);
    error OrganizationNotFound(bytes32 organizationId);
    error OrganizationSuspended(bytes32 organizationId);
    error OrganizationAdminRequired(bytes32 organizationId, address account);
    error LastOrganizationAdmin(bytes32 organizationId);
    error IssuerNotAuthorized(bytes32 organizationId, address issuer);
    error CredentialAlreadyExists(bytes32 credentialHash);
    error InvalidCredentialHash();
    error InvalidLearner();
    error EmptyMetadataUri();

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert InvalidOrganizationAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /// @notice Activate an organization after Credora's one-time review.
    /// The initial admin is also enabled to issue immediately.
    function activateOrganization(bytes32 organizationId, address initialAdmin, string calldata metadataUri)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (organizationId == bytes32(0)) revert InvalidOrganizationId();
        if (initialAdmin == address(0)) revert InvalidOrganizationAdmin();
        if (bytes(metadataUri).length == 0) revert EmptyMetadataUri();
        if (organizations[organizationId].exists) revert OrganizationAlreadyExists(organizationId);

        uint64 activatedAt = uint64(block.timestamp);
        organizations[organizationId] = Organization({
            initialAdmin: initialAdmin,
            metadataUri: metadataUri,
            activatedAt: activatedAt,
            exists: true,
            suspended: false
        });
        organizationAdmins[organizationId][initialAdmin] = true;
        organizationAdminCount[organizationId] = 1;
        issuerAuthorizations[organizationId][initialAdmin] = true;

        emit OrganizationActivated(organizationId, initialAdmin, metadataUri, activatedAt);
        emit OrganizationAdminChanged(organizationId, initialAdmin, true);
        emit OrganizationIssuerAuthorizationChanged(organizationId, initialAdmin, true);
    }

    /// @notice Organization admins manage their own administration keys.
    function setOrganizationAdmin(bytes32 organizationId, address account, bool authorized)
        external
        onlyOrganizationAdmin(organizationId)
    {
        if (account == address(0)) revert InvalidOrganizationAdmin();
        bool current = organizationAdmins[organizationId][account];
        if (current == authorized) return;
        if (!authorized && organizationAdminCount[organizationId] <= 1)
            revert LastOrganizationAdmin(organizationId);

        organizationAdmins[organizationId][account] = authorized;
        if (authorized) organizationAdminCount[organizationId] += 1;
        else organizationAdminCount[organizationId] -= 1;
        emit OrganizationAdminChanged(organizationId, account, authorized);
    }

    /// @notice Organization admins authorize or remove wallets that can issue for their org.
    function setIssuerAuthorization(bytes32 organizationId, address issuer, bool authorized)
        external
        onlyOrganizationAdmin(organizationId)
    {
        if (issuer == address(0)) revert InvalidIssuer();
        if (issuerAuthorizations[organizationId][issuer] == authorized) return;
        issuerAuthorizations[organizationId][issuer] = authorized;
        emit OrganizationIssuerAuthorizationChanged(organizationId, issuer, authorized);
    }

    /// @notice Only Credora's protocol administrator can suspend or restore an organization.
    function setOrganizationSuspended(bytes32 organizationId, bool suspended)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Organization storage organization = organizations[organizationId];
        if (!organization.exists) revert OrganizationNotFound(organizationId);
        if (organization.suspended == suspended) return;
        organization.suspended = suspended;
        emit OrganizationSuspensionChanged(organizationId, suspended);
    }

    /// @notice Organization admins can update their public metadata reference.
    function updateOrganizationMetadata(bytes32 organizationId, string calldata metadataUri)
        external
        onlyOrganizationAdmin(organizationId)
    {
        if (bytes(metadataUri).length == 0) revert EmptyMetadataUri();
        organizations[organizationId].metadataUri = metadataUri;
        emit OrganizationMetadataUpdated(organizationId, metadataUri);
    }

    function isOrganizationAdmin(bytes32 organizationId, address account) external view returns (bool) {
        return organizations[organizationId].exists && organizationAdmins[organizationId][account];
    }

    function isAuthorizedIssuer(bytes32 organizationId, address issuer) external view returns (bool) {
        return organizations[organizationId].exists && issuerAuthorizations[organizationId][issuer];
    }

    function getOrganization(bytes32 organizationId)
        external
        view
        returns (
            address initialAdmin,
            string memory metadataUri,
            uint64 activatedAt,
            bool exists,
            bool suspended
        )
    {
        Organization memory organization = organizations[organizationId];
        return (
            organization.initialAdmin,
            organization.metadataUri,
            organization.activatedAt,
            organization.exists,
            organization.suspended
        );
    }

    function issueCredential(
        bytes32 organizationId,
        bytes32 credentialHash,
        address learner,
        string calldata metadataUri
    ) external {
        Organization storage organization = organizations[organizationId];
        if (!organization.exists) revert OrganizationNotFound(organizationId);
        if (organization.suspended) revert OrganizationSuspended(organizationId);
        if (!issuerAuthorizations[organizationId][msg.sender])
            revert IssuerNotAuthorized(organizationId, msg.sender);
        if (credentialHash == bytes32(0)) revert InvalidCredentialHash();
        if (learner == address(0)) revert InvalidLearner();
        if (bytes(metadataUri).length == 0) revert EmptyMetadataUri();
        if (credentials[credentialHash].exists) revert CredentialAlreadyExists(credentialHash);

        uint64 issuedAt = uint64(block.timestamp);
        credentials[credentialHash] = Credential({
            organizationId: organizationId,
            issuer: msg.sender,
            learner: learner,
            metadataUri: metadataUri,
            issuedAt: issuedAt,
            exists: true
        });
        emit OrganizationCredentialIssued(
            credentialHash, organizationId, msg.sender, learner, metadataUri, issuedAt
        );
    }

    function getCredential(bytes32 credentialHash)
        external
        view
        returns (
            bytes32 organizationId,
            address issuer,
            address learner,
            string memory metadataUri,
            uint64 issuedAt,
            bool exists
        )
    {
        Credential memory credential = credentials[credentialHash];
        return (
            credential.organizationId,
            credential.issuer,
            credential.learner,
            credential.metadataUri,
            credential.issuedAt,
            credential.exists
        );
    }

    modifier onlyOrganizationAdmin(bytes32 organizationId) {
        if (!organizations[organizationId].exists) revert OrganizationNotFound(organizationId);
        if (!organizationAdmins[organizationId][msg.sender])
            revert OrganizationAdminRequired(organizationId, msg.sender);
        _;
    }
}
