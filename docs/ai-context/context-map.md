# Context Map

This file keeps agent context small. Start here when a task is broad, then read only the matching workflow and code area.

## Default Rule

Do not read generated artifacts or historical material by default. Use targeted file reads, GitNexus context, and the workflow contracts in this folder before opening large page files.

## Do Not Read By Default

- `.gitnexus/`: generated GitNexus index and local graph data.
- `output/`: screenshots, Playwright traces, reports, and temporary verification artifacts.
- `.next/`, `out/`, `dist/`, `coverage/`, `.playwright-cli/`: generated build/test output.
- `public/uploads/`: local uploaded media.
- `docs/archive/`: historical docs that are not active contracts.

## Active Product Context

- Global safety and agent rules: `AGENTS.md`.
- Product/data/privacy contract: `docs/ai-context/product-contract.md`.
- UI/dialog/table/form rules: `docs/ai-context/ui-contract.md`.
- CRM, pipeline, student profile, contact logs, tasks: `docs/ai-context/workflows/crm-student-workflow.md`.
- Classes, attendance, assessments, finance, receipts, parent portal: `docs/ai-context/workflows/operations-workflow.md`.
- Large roadmap reference only: `docs/specs/kidseedshub-full-product-plan.md`.

## Feature Areas

| Area | Primary files | Read before editing |
| --- | --- | --- |
| Pipeline CRM | `app/(dashboard)/pipeline/`, `app/api/pipeline/` | CRM workflow, UI contract, pipeline API routes |
| Students | `app/(dashboard)/students/`, `app/api/students/` | CRM workflow, operations workflow if finance/classes are touched |
| Student finance | `app/(dashboard)/students/[id]/`, `app/api/receipts/`, `app/api/student-wallet/`, `lib/finance*` | Operations workflow, receipt API contracts, Prisma receipt/wallet models |
| Finance workspace | `app/(dashboard)/finance/`, `app/api/finance/`, `app/api/expenses/`, `app/api/payroll-runs/` | Operations workflow, finance APIs |
| Classes and attendance | `app/(dashboard)/classes/`, `app/api/classes/`, `app/api/class-sessions/`, `app/api/attendance/` | Operations workflow, scheduling/session helpers |
| Assessments | `app/(dashboard)/assessments/`, `app/api/*assessments*/`, `app/api/weekly-assessments/` | Operations workflow, assessment API routes |
| Parent portal | `app/parent/`, `app/api/parent/` | Product contract, operations workflow, auth/session patterns |
| Auth and roles | `app/(auth)/`, `app/api/auth/`, `lib/auth*`, permission helpers | Product contract, existing auth code, GitNexus impact |
| Imports and seeds | `scripts/import-*`, `prisma/seed.ts` | Product contract, production data rules |

## Current Large Legacy Files

These files are known context hotspots. Prefer extracting around the requested workflow instead of loading the whole file when possible.

- `app/(dashboard)/students/[id]/student-detail-client.tsx`
- `app/(dashboard)/classes/class-schedule-board.tsx`
- `app/(dashboard)/finance/page.tsx`
- `app/(dashboard)/assessments/page.tsx`
- `app/(dashboard)/pipeline/page.tsx`
- `app/(dashboard)/classes/page.tsx`
- `prisma/seed.ts`

## Archive Policy

Use quarantine before deletion.

1. Move stale specs, old plans, and obsolete handoffs to `docs/archive/YYYY-MM/`.
2. Add a short `README.md` inside the archive folder explaining why files were moved.
3. Do not archive active workflow contracts, release checklists, migrations, or data import scripts without confirming the replacement path.
4. Generated artifacts should be ignored or deleted locally, not archived in docs.

## Bloat Guardrail

Run `npm run repo:audit` before broad refactors, before release-preflight, and before asking agents to inspect the whole repo. The audit blocks tracked generated artifacts and new oversized active files unless they are intentionally added to the legacy allowlist with a reason.
