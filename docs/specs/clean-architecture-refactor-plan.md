# Clean Architecture Refactor Plan

Status legend:

- `todo`: not started.
- `in_progress`: current active phase.
- `done`: implemented and verified.
- `blocked`: waiting on a product, data, or technical decision.

## Goal

Refactor Kid Seeds Hub toward pragmatic SOLID and Clean Architecture without changing current behavior, UI, API contracts, database schema, auth/session flow, or deployment assumptions.

The refactor should make code easier to read, test, and extend by separating:

- Presentation and UI state.
- Application/business rules.
- Validation and public contracts.
- Data access and infrastructure.

## Current Architecture Summary

The app currently uses Next.js App Router with API routes, React dashboard pages, Prisma/PostgreSQL, Zod validation, and shared DTO contracts.

Current practical boundaries:

- `app/(dashboard)/`: dashboard UI and client workflows.
- `app/api/`: route handlers that often combine auth, validation, Prisma queries, mapping, and business rules.
- `lib/backend/`: business helpers, mappers, scheduling, finance, uploads, and operations utilities.
- `lib/contracts/`: API/UI DTO contracts.
- `lib/validations/`: Zod schemas.
- `lib/prisma.ts`: Prisma singleton.

Known hotspots:

- Receipt creation logic in `app/api/receipts/route.ts`.
- Student detail query/mapping in `app/api/students/[id]/route.ts`.
- Large student detail and finance client workflows.

## Target Architecture

Keep the existing project layout. Do not move the whole app into `src/`.

Add focused module boundaries only when they reduce real coupling or improve tests:

```text
app/api route -> application use-case/helper -> backend/infrastructure helper -> Prisma
dashboard UI -> focused hook/API client -> existing API contract DTO
```

Preferred locations:

- Business rules: `lib/backend/` or `lib/modules/<domain>/application/`.
- Public DTOs: `lib/contracts/`.
- Input validation: `lib/validations/`.
- Data access for non-trivial workflows: `lib/modules/<domain>/infrastructure/` or focused backend helpers.

Do not create repository interfaces, factories, classes, or dependency injection unless they improve testability, reuse, replacement, or reduce real coupling.

## Refactor Phases

### Phase 0 - Baseline And Guardrails

Status: `done`

Completed:

- Repo bloat audit exists and passes.
- GitHub CI runs repo audit, typecheck, lint, tests, Prisma validate, and build.
- Agent rule `Rule 8C - SOLID/Clean Architecture By Default` is documented.
- Product contract includes Architecture Rules.
- Last completed guardrail commit before this tracker: `c93b3d6 chore: refresh gitnexus context`.

### Phase 1 - Extract Receipt Creation Use Case

Status: `done`

Goal:

- Move `POST /api/receipts` business logic out of the route handler into a finance application use-case.
- Keep the route responsible only for auth, permission, body validation, use-case invocation, and `ApiResponse` mapping.

Constraints:

- Do not change `receiptCreateSchema`.
- Do not change `ReceiptListItem` or existing API response shape.
- Do not change Prisma schema or migrations.
- Preserve receipt line, extra line, wallet credit, enrollment session, audit log, and notification behavior.

Verification target:

- Add focused tests for receipt creation rules before or during extraction.
- Run the mandatory checklist before commit.

Completed:

- Moved receipt creation business rules from `POST /api/receipts` into `lib/modules/finance/application/create-receipt.ts`.
- Moved receipt DTO mapping into `lib/modules/finance/receipt-list-item.ts`.
- Added typed receipt creation errors for route response mapping.
- Added focused receipt creation tests for course + extra lines, wallet credit validation, and multi-student rejection.
- Verified with repo audit, typecheck, lint, tests, build, and GitNexus staged change detection.
- Completed commit: `17ef9d7 refactor: extract receipt creation use case`.

### Phase 2 - Extract Student Detail Query And Mapper

Status: `done`

Goal:

- Move student detail include/query shape and mapping helpers out of `app/api/students/[id]/route.ts`.
- Keep `StudentDetail` contract unchanged.

Constraints:

- Preserve teacher ownership check.
- Preserve parent account, photos, learning timeline, assessment progress, tasks, and contact logs.
- No API response shape change.

Completed:

- Moved the Student Detail Prisma include shape, query, and response mapping into `lib/modules/students/student-detail.ts`.
- Kept `GET /api/students/[id]` limited to auth, permission, teacher ownership, query invocation, and response mapping.
- Kept `PATCH /api/students/[id]` on the same include and mapper so its existing `StudentDetail` response remains identical.
- Verified with repo audit, typecheck, lint, tests, build, and GitNexus staged change detection.

### Phase 3 - Extract Student Detail Client Workflows

Status: `in_progress`

Goal:

- Split the large student detail client into focused hooks/actions for profile, enrollments, transfers, receipts, and parent account.
- Keep existing UI and text unchanged unless required to preserve behavior.

Constraints:

- Do not move durable business rules into React hooks.
- Hooks may coordinate UI state and API calls only.

Progress checkpoint:

- Extracted profile form state, profile synchronization, and profile PATCH orchestration into `student-detail-profile-state.ts`.
- Kept student data loading focused on API reads; the client coordinates profile form synchronization from the loaded `StudentDetail` value.
- Extracted enrollment create/edit/cancel and class/course transfer mutation orchestration into `student-detail-enrollment-actions.ts`.
- Remaining Phase 3 work: receipt and parent-account client actions.

### Phase 4 - Extract Finance Workspace Hooks And Actions

Status: `todo`

Goal:

- Split finance data loading and command handlers out of `app/(dashboard)/finance/page.tsx`.
- Preserve role-aware loading: Sale must not call Admin-only APIs.

Constraints:

- Keep the tab UI and public API behavior unchanged.
- Do not duplicate receipt calculation rules in UI.

### Phase 5 - Shared API Auth And Error Helpers

Status: `todo`

Goal:

- Add small shared helpers for session/permission checks and typed application error mapping.
- Apply only to routes already touched by refactor.

Constraints:

- Do not mass-rewrite all routes.
- Unauthorized/forbidden response code, message, and status must stay compatible.

## Mandatory Checklist After Each Phase

Run and record:

```text
npm run repo:audit
npm run typecheck
npm run lint
npm run test
AUTH_SECRET=dev-secret-for-build npm run build
npx gitnexus detect_changes --scope staged
```

If a command is skipped, record the reason and residual risk in this file before committing.

## Do Not Touch

- Do not split `prisma/schema.prisma` unless Prisma officially supports the target structure in this repo.
- Do not change API response contracts silently.
- Do not create migrations in the early architecture refactor phases.
- Do not change auth/session flow without dedicated tests.
- Do not rewrite the whole project or move everything into `src/`.
- Do not add dependencies unless required and justified.

## Handoff For Next AI

Current phase: Phase 3 - Extract Student Detail Client Workflows.

Last completed refactor commit: `24cbfe4 refactor: extract student detail query and mapper`.

Files changed in last completed refactor slice:

- `app/api/students/[id]/route.ts`
- `lib/modules/students/student-detail.ts`

Current in-progress files:

- `app/(dashboard)/students/[id]/student-detail-client.tsx`
- `app/(dashboard)/students/[id]/student-detail-data.ts`
- `app/(dashboard)/students/[id]/student-detail-profile-state.ts`
- `app/(dashboard)/students/[id]/student-detail-enrollment-actions.ts`

Verification result for last completed refactor slice:

- `npm run repo:audit`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed (26 tests).
- `AUTH_SECRET=local-build-secret npm run build`: passed.
- `npx gitnexus detect_changes --scope staged`: pending before commit.

Next exact task:

1. Read `AGENTS.md`, `docs/ai-context/index.md`, `docs/ai-context/product-contract.md`, and this file.
2. Run GitNexus impact for the large student detail client and its mutation helpers.
3. Extract receipt and parent-account UI mutation orchestration into focused hooks, preserving the current API payloads and refresh behavior.
4. Complete Phase 3 only after the Student Detail client remains a UI composition container with no durable business rules or direct mutation workflows.
