# Credora documentation map

| Document | Owns | Update when |
| --- | --- | --- |
| `README.md` | setup, commands, runtime surfaces, deployment basics | onboarding, scripts, env names, or local workflow changes |
| `docs/architecture/overview.md` | system boundaries and source-of-truth model | an app/package/storage/chain/API boundary changes |
| `docs/decisions/0001-0007` | accepted protocol and architecture decisions | a decision is introduced, superseded, or migrated |
| `docs/glossary.md` | canonical terms and definitions | a new protocol term or an ambiguous existing term appears |
| `docs/requirements/traceability.md` | requirements mapped to implementation/evidence | behavior, scope, or verification evidence changes |
| `docs/roadmap/sprints.md` | planned delivery and sequencing | implementation changes the plan or a milestone closes |
| `contracts/README.md` | Foundry-specific contract workflow | contract build/deploy/test assumptions change |
| `deploy/README.md` | self-hosted deployment and operations | service configuration, health, or production workflow changes |
| `tests/e2e/README.md` | integration prerequisites and test scenarios | e2e setup or failure coverage changes |

## ADR quality bar

An ADR should state what is authoritative, what is deliberately not
authoritative, what existing versions remain compatible, and which code/tests
prove the decision. For protocol migrations, explicitly name the registry and
hash version so v1 records are not accidentally reinterpreted.

## Traceability quality bar

Link requirements to concrete source files, tests, commands, or documented
manual checks. Mark gaps honestly. A screenshot or demo fixture is not proof
of a live blockchain/IPFS integration unless it is backed by a real transaction
and recoverable metadata path.
