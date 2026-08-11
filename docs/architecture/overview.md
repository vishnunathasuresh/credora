# Architecture overview

```text
Next.js web ─────┐
Expo Android ────┼── shared TypeScript packages ──┬── Solidity registry
API projection ──┘                                └── MetadataStorage
```

The API is an operational boundary, not a second credential ledger. Public
verification reads the registry and treats metadata retrieval as a separate
availability concern.
