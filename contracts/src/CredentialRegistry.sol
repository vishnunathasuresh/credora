// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/access/AccessControl.sol";

/// @title CredentialRegistry
/// @notice Stores immutable credential proofs and issuer authorization.
contract CredentialRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Credential {
        address issuer;
        address learner;
        string metadataUri;
        uint64 issuedAt;
        bool exists;
    }

    mapping(bytes32 => Credential) private credentials;

    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed issuer,
        address indexed learner,
        string metadataUri,
        uint64 issuedAt
    );

    event IssuerAuthorizationChanged(address indexed issuer, bool authorized);

    error CredentialAlreadyExists(bytes32 credentialHash);
    error InvalidCredentialHash();
    error InvalidLearner();
    error EmptyMetadataUri();

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function setIssuerAuthorization(address issuer, bool authorized)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (authorized) {
            _grantRole(ISSUER_ROLE, issuer);
        } else {
            _revokeRole(ISSUER_ROLE, issuer);
        }
        emit IssuerAuthorizationChanged(issuer, authorized);
    }

    function isAuthorizedIssuer(address issuer) external view returns (bool) {
        return hasRole(ISSUER_ROLE, issuer);
    }

    function issueCredential(bytes32 credentialHash, address learner, string calldata metadataUri)
        external
        onlyRole(ISSUER_ROLE)
    {
        if (credentialHash == bytes32(0)) revert InvalidCredentialHash();
        if (learner == address(0)) revert InvalidLearner();
        if (bytes(metadataUri).length == 0) revert EmptyMetadataUri();
        if (credentials[credentialHash].exists) revert CredentialAlreadyExists(credentialHash);

        uint64 issuedAt = uint64(block.timestamp);
        credentials[credentialHash] = Credential({
            issuer: msg.sender,
            learner: learner,
            metadataUri: metadataUri,
            issuedAt: issuedAt,
            exists: true
        });

        emit CredentialIssued(credentialHash, msg.sender, learner, metadataUri, issuedAt);
    }

    function getCredential(bytes32 credentialHash)
        external
        view
        returns (address issuer, address learner, string memory metadataUri, uint64 issuedAt, bool exists)
    {
        Credential memory credential = credentials[credentialHash];
        return (
            credential.issuer,
            credential.learner,
            credential.metadataUri,
            credential.issuedAt,
            credential.exists
        );
    }
}
