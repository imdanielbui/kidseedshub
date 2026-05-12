# Skill: InsForge Backend

Use for stable backend implementation with Postgres, auth, storage, AI gateway, compute, or edge functions.

## Workflow

1. Confirm platform assumptions and existing env setup.
2. Inspect auth, database, storage, and deployment primitives.
3. Design the smallest backend slice.
4. Implement with minimal custom plumbing.
5. Verify with logs, tests, or smoke checks.

## Output

```md
Backend goal:
Platform assumptions:
Changes:
Verification:
Risks:
```

## Rules

- Do not mix backend platform decisions into frontend-only tasks.
- Ask before changing schema/auth/data flow.
- Keep secrets and credentials out of source control.
