# AI Context Index

This folder is the short operational contract for agents working on Kid Seeds Hub. Read it before coding so product workflow, UI style, and verification do not depend on memory.

## Required Read Order

1. `AGENTS.md` for global safety rules and GitNexus requirements.
2. `docs/ai-context/product-contract.md` for ship-ready product rules.
3. `docs/ai-context/ui-contract.md` for layout, dialog, form, and state rules.
4. The relevant workflow file under `docs/ai-context/workflows/`.
5. Existing code patterns and GitNexus context before editing symbols.

## When To Use Each File

- New feature or cross-screen change: read `feature-slice-template.md` and fill the same fields in the task notes or spec.
- UI/dialog/form/table work: read `ui-contract.md`.
- CRM, pipeline, student detail, parent account, contact logs, tasks: read `workflows/crm-student-workflow.md`.
- Class, attendance, makeup, assessment, finance, receipt, parent portal: read `workflows/operations-workflow.md`.
- Large roadmap status: use `docs/specs/kidseedshub-full-product-plan.md` as a reference, not as the daily agent contract.

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
