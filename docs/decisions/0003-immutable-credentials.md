# ADR 0003: Immutable credentials in v1

Issued credentials cannot be modified or deleted. The source documents contain
one conflicting “Modify Credential” diagram; v1 follows the explicit
immutability requirement. A future correction or revocation feature must be an
append-only status/proof mechanism and receive a new ADR.
