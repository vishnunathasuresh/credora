---
name: credora-docs
description: Maintain Credora architecture, ADRs, glossary, requirements traceability, README, and operator documentation as code and protocol decisions evolve.
---

# Credora Docs

Use this skill when a change alters architecture, protocol behavior, privacy,
roles, deployment, test workflows, user-facing terminology, or any durable
assumption future contributors must recover.

## Documentation workflow

1. Read [docs-map.md](references/docs-map.md) and the owning code/ADR first.
2. Update the smallest authoritative document rather than copying the same
   rule into several places. Cross-link summaries to the ADR that owns the
   decision.
3. Create a new numbered ADR for a new protocol, privacy, source-of-truth,
   migration, or irreversible architecture decision. Include status, context,
   decision, consequences, and migration/compatibility notes.
4. Keep `README.md` focused on onboarding and runnable commands; keep
   `docs/architecture/overview.md` focused on boundaries; keep
   `docs/glossary.md` focused on stable terminology; keep
   `docs/requirements/traceability.md` focused on requirement-to-evidence
   links.
5. Document operational failures and recovery behavior, not just the happy
   path. If a UI says a credential is valid, the docs should identify which
   public sources make that claim true.
6. Never document demo data as live credentials. Keep `Illustrative credential
   flow` and synthetic-catalog disclaimers intact until real issuance data is
   connected.

Finish by checking links, commands, version labels, and whether the code and
docs agree. Read [docs-map.md](references/docs-map.md) for the update matrix.
