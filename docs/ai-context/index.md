# AI Context Index

This folder is the short operational contract for agents working on Kid Seeds Hub. Read it before coding so product workflow, UI style, and verification do not depend on memory.

## Required Read Order

1. `AGENTS.md` for global safety rules and GitNexus requirements.
2. `docs/ai-context/product-contract.md` for ship-ready product rules.
3. `docs/ai-context/ui-contract.md` for layout, dialog, form, and state rules.
4. `docs/ai-context/context-map.md` to identify the smallest relevant code area and files that must not be read by default.
5. The relevant workflow file under `docs/ai-context/workflows/`.
6. Existing code patterns and GitNexus context before editing symbols.

## When To Use Each File

- New feature or cross-screen change: read `feature-slice-template.md` and fill the same fields in the task notes or spec.
- UI/dialog/form/table work: read `ui-contract.md`.
- CRM, pipeline, student detail, parent account, contact logs, tasks: read `workflows/crm-student-workflow.md`.
- Class, attendance, makeup, staff leave, timesheet, payroll, assessment, finance, receipt, parent portal: read `workflows/operations-workflow.md`.
- Large roadmap status: use `docs/specs/kidseedshub-full-product-plan.md` as a reference, not as the daily agent contract.
- Repo bloat/context scope: read `context-map.md` and run `npm run repo:audit` before broad refactors or release-preflight.

## Output Requirement

Before implementing non-trivial work, report:

```md
Contract read:
Workflow:
Data/API impact:
UI impact:
Verification target:
GitNexus:
```

If GitNexus MCP is unavailable, say so and use the repo fallback: targeted file reads, `git status`, `git diff`, and focused `rg` searches.
