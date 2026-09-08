# Project skills

Credora keeps project-specific Codex skills in `.agents/skills/` so future
implementation and review work starts with the same protocol and repository
context. The skills are local to this checkout and are intentionally split by
decision type rather than bundled into one broad prompt.

## Skill set

- `credora-context` — source-of-truth rules, protocol invariants, privacy
  boundaries, terminology, and repository map. Use this for every task.
- `credora-architecture` — ownership, dependency direction, cross-app/package
  impact, failure-state modeling, and when an ADR is required.
- `credora-development` — implementation patterns for TypeScript, Solidity,
  adapters, configuration, verification flows, and UI state handling.
- `credora-testing` — layered unit, Foundry, API, e2e, outage, and
  protocol-integrity test selection and commands.
- `credora-docs` — ADRs, architecture overview, glossary, traceability,
  onboarding, deployment, and test documentation maintenance.

## Recommended routing

```text
Any Credora task
      |
      v
credora-context
      |
      +--> architecture --> development --> testing
      |
      +--> docs (when a durable decision, command, or contract changes)
```

The skills reference current repository files and ADRs instead of duplicating
the full project specification. If code and documentation disagree, inspect
the owning ADR and update the authoritative source deliberately.

## Maintenance

Keep descriptions discriminating and references task-specific. When the
protocol, package map, scripts, or documentation layout changes, update the
affected skill reference in the same change and run the skill validators:

```sh
for skill in .agents/skills/credora-*/; do
  python3 /home/viz/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill"
done
```
