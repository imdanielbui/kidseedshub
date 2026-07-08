# Handoff Summary

Goal:
Build Kid Seeds Hub Management System as a full-stack Next.js/Prisma app, following the 50-feature product plan and the rule that any data/state feature must define backend/API/data model before UI.

Current status:
Foundation is scaffolded and backend contracts exist for the V1 core. UI shell is present with Kid Seeds Hub red `#a52427`, simplified neumorphism, hover shadows on list items, and collapsible sidebar. The project does not yet have a real `DATABASE_URL`, so DB-backed flows are not verified end-to-end.

Files read:
- `AGENTS.md`
- `templates/handoff-summary.md`
- `docs/specs/kidseedshub-full-product-plan.md`
- `prisma/schema.prisma`
- `app/api/**/route.ts`
- `app/(dashboard)/**/page.tsx`
- `lib/validations/*.ts`
- `lib/permissions.ts`

Files changed:
- Added Next.js app foundation: `package.json`, `tsconfig.json`, `next.config.mjs`, Tailwind/PostCSS config, `app/`, `components/`, `lib/`, `types/`.
- Added Prisma schema and seed: `prisma/schema.prisma`, `prisma/seed.ts`.
- Added tracking plan: `docs/specs/kidseedshub-full-product-plan.md`.
- Updated agent rules in `AGENTS.md` with the full-stack data-feature requirement.
- Added backend APIs for students, pipeline status, contact logs, tasks, courses, classes, attendance, receipts, expenses, finance summary, weekly assessments, final assessments, auth, health, and rubric.

Decisions made:
- Use Next.js 16 instead of Next.js 14 because npm audit flagged current Next 14 range; dependency audit is clean after upgrade.
- Use fixed RBAC roles for V1, not a dynamic permission matrix.
- Use Prisma/Postgres as the backend data model.
- Use static versioned rubrics for FUN and Robotics in V1.
- Keep task/checklist items in the product plan as `Doing` unless DB-backed runtime verification has completed.
- Keep production auth strict, but allow a development-only auth secret fallback to avoid local crashes before `.env` is configured.

Commands/checks run:
- `npm install`
- `npm audit --omit=dev` -> 0 vulnerabilities after dependency updates.
- `DATABASE_URL='postgresql://user:password@localhost:5432/kidseedshub' npx prisma validate` -> passed.
- `DATABASE_URL='postgresql://user:password@localhost:5432/kidseedshub' npx prisma generate` -> passed.
- `npm run lint` -> passed.
- `npm run typecheck` -> passed when run after build/type generation settles.
- `npm run build` -> passed.

Risks/open questions:
- No real Postgres `DATABASE_URL` has been provided, so migrations, seed, login, RBAC runtime, and API data mutations are not verified with a real database.
- Dev server port state was unstable during smoke testing; build-time verification is clean, but runtime smoke needs a stable local server and env.
- UI pages still mostly show placeholder/sample data. Next section should map UI to the backend contracts and shared DTOs.
- Receipt/expense code generation is implemented in a transaction but should be stress-tested with a real database before go-live.
- Parent Portal, Zalo, import Excel, audit log, and advanced analytics remain out of V1 or later-phase work.

Next action:
Start the frontend mapping section: define shared DTO/formatter contracts for backend responses, replace ad-hoc sample structures where possible, and then wire dashboard/pipeline/students/finance/assessment UI to backend-shaped data step by step.

## Continuation Update

Current status:
Frontend mapping has started and several V1 flows now use typed backend DTOs instead of placeholders. The app still has no real `DATABASE_URL`, so these remain build-verified but not DB-verified.

Changes made after this handoff:
- Added `GET /api/pipeline` and wired `/pipeline` to real API data.
- Mapped `/api/dashboard/alerts` to `DashboardAlerts` DTO and wired `/dashboard`.
- Added `StudentListItem` DTO, mapped `GET/POST /api/students`, and wired `/students`.
- Added finance DTOs for receipt, expense, and summary; mapped `/api/receipts`, `/api/expenses`, `/api/finance/summary`; wired `/finance`.
- Added `GET /api/exports/students-finance` Excel export with Students, Receipts, and Expenses sheets; added Finance export link.
- Added `WeeklyAssessmentListItem` DTO and wired `/assessments` to weekly assessment history.
- Added `TodayClassItem` DTO, mapped `/api/classes/today`, added `/classes`, and added sidebar navigation.
- Updated `POST /api/attendance` to update same-day attendance instead of double-charging, with session delta adjustment.
- Updated `docs/specs/kidseedshub-full-product-plan.md` after each implemented slice; items stay unchecked until DB/manual verification.

Latest verified commands:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.

Remaining blockers:
- Need real Postgres env to run Prisma migrate/seed, log in as seeded users, and verify API/UI flows.
- Need manual browser QA after database is available, especially attendance session deduction, Excel export download, and auth/RBAC boundaries.
- Weekly assessment still needs the actual checklist input UI; current UI lists saved records and backend can create/update them.

## Fake Data Update

## 2026-05-15 Finance Mid-Course Receipt Update

Goal:
Redesign Student Detail finance workflow so staff can handle mid-course joins, free trials, paid-before-receipt sessions, course price proration, cash/% discounts, and printable receipts.

Files changed:
- `prisma/schema.prisma`
- `prisma/migrations/20260515153000_finance_receipt_mid_course/migration.sql`
- `lib/validations/finance.ts`
- `lib/validations/enrollment.ts`
- `lib/contracts/finance.ts`
- `lib/contracts/students.ts`
- `app/api/enrollments/route.ts`
- `app/api/receipts/route.ts`
- `app/api/receipts/[id]/route.ts`
- `app/api/students/route.ts`
- `app/api/students/[id]/route.ts`
- `app/(dashboard)/students/[id]/student-detail-client.tsx`
- `app/receipts/[id]/print/page.tsx`
- `app/receipts/[id]/print/receipt-print-client.tsx`
- `app/globals.css`
- `docs/specs/kidseedshub-full-product-plan.md`

Verification:
- `npm run prisma:generate` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Applied and resolved migration `20260515153000_finance_receipt_mid_course`; `npx prisma migrate status` reported DB schema up to date.
- Playwright smoke: Admin logged in, opened `Lê Hoàng Nam` -> `Tài chính`, entered free trial `2`, billable sessions `10`, paid-before-receipt `3`, cash discount `100000`, discount `10%`; UI computed gross `2,500,000`, discount `350,000`, final `2,150,000`; backend created `PT-2026-006`; print page `/receipts/cmp707t580001prq7vdhj5j99/print` rendered the receipt with course price, unit price, free-trial sessions, paid-before-receipt sessions, final amount, and signature areas.

Notes:
- Dev server was restarted after Prisma generation and is running at `http://127.0.0.1:3000`.
- Browser console still shows the existing Next Dev Tools console noise in dev mode; the finance flow itself completed.

Current status:
Project is treated as greenfield with no real data. Fake data is acceptable for development and verification.

Changes made:
- Replaced `prisma/seed.ts` with an idempotent fake-data seed.
- Seed now covers demo users, parents, pipeline students, active enrollments, today's classes, one attendance record, receipts, expenses, due tasks, contact logs, weekly FUN/Robotics assessments, and one final assessment.
- Demo accounts are printed by the seed script after successful run.

Verification:
- `DATABASE_URL='postgresql://user:password@localhost:5432/kidseedshub' npx prisma validate` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.

Remaining:
- Seed has not been executed because no real Postgres `DATABASE_URL` is configured in this workspace.

## Feature Continuation Update

Changes made:
- Added `/students` create-lead form wired to `POST /api/students`.
- Added `/pipeline` stage selector wired to `PATCH /api/students/:id/status`.
- Added `courseSubject` to student enrollment DTOs so assessment UI can pick the correct rubric.
- Added weekly checklist form on `/assessments`; it generates FUN/Robotics rubric checklist items and posts to `POST /api/weekly-assessments`.
- Added final assessment form on `/assessments`; it is disabled until enough weekly assessments are `COMPLETE`, and backend still enforces the same gate.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.

Remaining:
- Runtime/manual verification still needs a real Postgres database plus seed execution.
- Dev server was not started because authenticated app flows depend on DB-backed login.

## Finance And Student Profile Update

Changes made:
- Added receipt and expense create forms on `/finance`; both call existing backend APIs and refresh summary/list data.
- Added stable student detail DTO for `GET /api/students/:id`.
- Added stable contact log DTO for `GET/POST /api/students/:id/contact-logs`.
- Added `/students/:id` detail page showing parent info, course balance, classes, notes, contact logs, and tasks.
- Linked `/students` list rows to the detail page.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.

Remaining:
- Task create/done UI is still pending.
- Runtime verification still needs local DB + seed.

## Task Reminder Update

Changes made:
- Added `lib/backend/task-mapper.ts` so task APIs return stable DTOs.
- Changed task creation validation so `assignedToId` is optional; backend defaults to the current user.
- Updated `GET/POST /api/tasks` and `PATCH /api/tasks/:id` to return DTOs.
- Added task creation form on `/students/:id`.
- Added task done action on `/students/:id`.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.

Remaining:
- Runtime verification still needs local DB + seed.

## Local Backend Runtime Update

Current status:
Local Postgres is now available through Docker Compose and V1 backend smoke checks are running against real seeded data.

Changes made:
- Added `docker-compose.yml` with Postgres on host port `5434`.
- Created Prisma migration `prisma/migrations/20260513001849_init/migration.sql`.
- Replaced login placeholder with a real NextAuth credentials form at `/login`.
- Split login UI into `app/(auth)/login/login-form.tsx` so `useSearchParams()` is inside a Suspense boundary.
- Updated `docs/specs/kidseedshub-full-product-plan.md` to mark only verified items: P1.2 and P6.4/feature 47.

Verification:
- `docker compose up -d postgres` -> Postgres healthy.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma migrate dev --name init` -> passed.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npm run prisma:seed` -> passed.
- DB count smoke check -> users 10, students 6, classes 2, receipts 3, expenses 2, weekly assessments 3.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- Admin credentials flow returned a valid NextAuth session.
- Parent credentials flow returned a valid Parent session and `/api/pipeline` returned 403.
- Authenticated smoke calls passed for dashboard alerts, pipeline, students, today's classes, finance summary, weekly assessments, and auth session.
- Authenticated Excel export downloaded successfully; `exceljs` verified workbook sheets and row counts: Students 7, Receipts 4, Expenses 3.

Remaining:
- Browser automation could not be used in this environment: Browser skill has no exposed node REPL tool here, Computer Use failed with macOS Apple Event permission error, and Playwright wrapper was not usable.
- Dev server restart command uses inline env because `.env*` is protected and was not modified.

## User Management And RBAC Update

Current status:
Phase 1 foundation is verified in the tracking plan. Feature 44 is implemented and verified for V1. Feature 50 remains unchecked at feature level because the Phase 2 dynamic permission matrix is not implemented yet, but V1 fixed RBAC is verified.

Changes made:
- Added `lib/contracts/users.ts` and `lib/validations/user.ts`.
- Added Admin-only `GET/POST /api/users`.
- Added Admin-only `PATCH /api/users/:id` with guards against self-deactivation and self-demotion.
- Added `/settings` user-management UI for listing, creating, editing, deactivating, and password reset.
- Updated `docs/specs/kidseedshub-full-product-plan.md`: Phase 1, feature 44, P1.3, and V1 fixed RBAC acceptance are now verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- Admin `GET /api/users` -> 200 with staff users.
- Parent `GET /api/users` -> 403.
- Admin `POST /api/users` -> created QA Teacher.
- Admin `PATCH /api/users/:id` -> renamed/deactivated QA Teacher and reset password.
- Inactive QA Teacher login -> rejected by credentials auth.
- Sale login -> `/api/pipeline` 200 and `/api/finance/summary` 403.
- Teacher login -> `/api/classes/today` 200 scoped to teacher class and `/api/pipeline` 403.

## Revenue Flow Update

Current status:
The core revenue flow is now DB-smoke verified from lead creation through paid enrollment and attendance deduction.

Changes made:
- Added `lib/contracts/courses.ts`, `lib/contracts/enrollments.ts`, and `lib/validations/enrollment.ts`.
- Added Admin/Sale enrollment permission `enrollments:manage`.
- Added `POST /api/enrollments` to create an enrollment, optionally assign the student to a class, and update student status.
- Mapped `GET/POST /api/courses`, `PATCH /api/courses/:id`, and `GET/POST /api/classes` to stable DTOs.
- Added enrollment and quick receipt forms to `app/(dashboard)/students/[id]/student-detail-client.tsx`.
- Updated `POST /api/attendance` so the response returns the refreshed enrollment after session deduction.
- Updated tracking plan: features 1, 4, 8, 9, 12, 14, 15, and 25 are now verified; P2.4, P3.1, P3.2, P3.3, and P6.2 are verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed after build finished. A concurrent typecheck during `next build` failed because `.next/types` was being regenerated; rerun passed.
- Created lead `Smoke Revenue Flow` with parent contact/source through `POST /api/students`.
- Moved that lead to `TRIAL` through `PATCH /api/students/:id/status`.
- Created enrollment for Robotics Cơ bản and assigned it to `Robotics Demo - Hôm nay` through `POST /api/enrollments`.
- Created receipt `PT-2026-004` through `POST /api/receipts`; sessions increased from 0 to 12.
- Marked attendance `PRESENT` through `POST /api/attendance`; sessions used became 1 and remaining became 11.
- Repeated same-day `PRESENT` updated the same attendance and did not double-charge.
- `GET /api/students/:id` returned status `ACTIVE`, class assignment, and session balance 12/1/11.
- `GET /api/classes/today` showed the smoke student in the Robotics class.
- `GET /api/dashboard/alerts` still returned seeded low-session, stale-trial, and due-task alerts.

## CRM CRUD Follow-Up Update

Current status:
Phase 2 MVP Revenue Flow is verified in the tracking plan. CRM lead/profile CRUD, pipeline status movement, contact logs, and task reminders are now DB-smoke verified.

Changes made:
- Added `studentUpdateSchema` in `lib/validations/student.ts`.
- Added `PATCH /api/students/:id` to update student fields and parent user fields in one transaction.
- Added a "Cập nhật hồ sơ" form to `app/(dashboard)/students/[id]/student-detail-client.tsx`.
- Updated tracking plan: feature 2, feature 3, feature 6, P2.1, P2.2, P2.3, and the CRM V1 acceptance item are now verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- `PATCH /api/students/:id` updated `Smoke Revenue Flow Updated`, parent name/email, lead note, health note, and lead source.
- `POST /api/students/:id/contact-logs` created `CRUD smoke contact log`; student detail returned the log.
- `POST /api/tasks` created `CRUD smoke follow-up`; `PATCH /api/tasks/:id` marked it `DONE`; student detail returned the completed task.
- Created `Pipeline Five Stage Smoke` and moved it through `TRIAL`, `EVALUATION`, `CONVERTED`, `RETENTION`, and `LEAD`.

Remaining:
- Parent portal remains open.

## Class Notes And Photo Album Update

Current status:
Lesson notes, class photo URL capture, and student photo album are implemented and DB-smoke verified.

Changes made:
- Added safe `AttendanceMarkResult` and `ClassPhotoListItem` contracts in `lib/contracts/classes.ts`.
- Added `StudentPhotoItem` and `photos` to `StudentDetail`.
- Added class photo validation schemas in `lib/validations/attendance.ts`.
- Updated `POST /api/attendance` to return a safe DTO instead of raw Prisma `markedBy` user records.
- Updated `GET /api/classes/today` to include attendance id, attendance note, and photo count.
- Added `GET/POST /api/class-photos` for V1 manual photo URL capture.
- Updated `GET /api/students/:id` to return student photo album items.
- Updated `/classes` UI with lesson note input and photo URL save action per student.
- Updated `/students/:id` UI with an album section.
- Updated `docs/specs/kidseedshub-full-product-plan.md`: feature 11, feature 16, feature 17, and P3.4 are now verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- `POST /api/attendance` updated the smoke attendance note to `Smoke lesson note and photo` and returned a safe DTO without raw user fields.
- `POST /api/class-photos` saved `https://example.com/kidseedshub-smoke-photo.jpg` against the smoke attendance.
- `GET /api/classes/today` returned the smoke student with `attendanceNote: "Smoke lesson note and photo"` and `photoCount: 1`.
- `GET /api/students/:id` returned the smoke photo in `photos`.
- `GET /api/class-photos?studentId=...` returned the saved photo.

Remaining:
- Parent portal remains open.

## Sale KPI Report Update

Current status:
Sale KPI is implemented and DB-smoke verified. The V1 acceptance item for Sale KPI, user management, and Excel export is marked verified.

Changes made:
- Added `lib/contracts/reports.ts` with Sale KPI report DTOs.
- Added `GET /api/reports/sale-kpi` with Admin all-Sale scope and Sale own-KPI scope.
- Added `/reports` dashboard page with KPI cards and per-Sale rows.
- Updated `docs/specs/kidseedshub-full-product-plan.md`: feature 39, P7.1, and the Sale KPI V1 acceptance item are now verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- Admin `GET /api/reports/sale-kpi?month=2026-05` returned Sale Kid Seeds KPI: 3 lead base, 2 converted, 66.7% conversion, 7200000 revenue, 2 receipts, 2 open tasks.
- Sale login succeeded with `0900000002 / Sale@123`.
- Sale `GET /api/reports/sale-kpi?month=2026-05` returned only the Sale Kid Seeds KPI row.
- Sale `GET /api/finance/summary?month=2026-05` still returned 403, confirming the report did not broaden finance permissions.
- Authenticated `GET /reports` returned the KPI page shell in rendered HTML.

Remaining:
- Parent portal remains open.

## Assessment Runtime Smoke And Safe DTO Update

Current status:
Weekly assessment and final assessment are DB-smoke verified for FUN and Robotics. Product phases for Weekly Assessment and Final Assessment are marked verified in the tracking plan.

Changes made:
- Added `FinalAssessmentResult` in `lib/contracts/assessment.ts`.
- Updated `POST /api/final-assessments` to return a safe DTO instead of raw Prisma records.
- Removed raw teacher user data from the final assessment response; the API now returns `teacherName` only.
- Updated `docs/specs/kidseedshub-full-product-plan.md`: product Phase 3, product Phase 4, feature 20, 24A, 24B, 24C, P4.1, P4.2, P4.3, P5.1, P5.2, and weekly/final V1 acceptance items are now verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- Created `Smoke FUN Assessment` and active FUN enrollment for `FUN Explorers`.
- `POST /api/weekly-assessments` created FUN week 1 COMPLETE with 30/30 checked outcomes.
- `POST /api/weekly-assessments` created Robotics week 1 COMPLETE with 24/24 checked outcomes.
- `POST /api/final-assessments` with `requiredWeeks: 2` returned HTTP 409 and `WEEKLY_ASSESSMENTS_INCOMPLETE`.
- `POST /api/final-assessments` with `requiredWeeks: 1` created FUN and Robotics final assessments.
- Re-tested final assessment response after DTO fix; `rg 'password|teacher":|phone|email' /private/tmp/ksh-final-response.json` returned no matches.

Remaining:
- Sale KPI and parent portal remain open.

## Finance Runtime Smoke Update

Current status:
Phase 5 Finance & Export is verified in the tracking plan. Receipt, expense, finance dashboard, course pricing, and Excel export are all DB-smoke verified for V1.

Changes made:
- Updated `docs/specs/kidseedshub-full-product-plan.md`: Phase 5, feature 26, feature 27, P6.3, and the finance V1 acceptance item are now verified.

Verification:
- `POST /api/expenses` created `PC-2026-003` with category `MATERIALS`, amount `123456`, description `Smoke expense finance dashboard`, and date `2026-05-13`.
- `GET /api/expenses?month=2026-05` returned `PC-2026-003` plus seeded expenses.
- `GET /api/finance/summary?month=2026-05` returned revenue `10200000`, expense `1473456`, profit `8726544`, receipt count 3, and expense count 3.
- Authenticated `GET /finance` returned the finance dashboard/form shell in rendered HTML.

Remaining:
- Sale KPI, weekly/final assessment runtime smoke, and parent portal remain open.

## Course Settings Update

Current status:
Course pricing and course configuration are now UI/API/DB-smoke verified in the tracking plan.

Changes made:
- Added `app/(dashboard)/settings/course-settings.tsx` for course create/edit/hide in the Settings page.
- Wired the course settings UI to existing `GET/POST /api/courses` and `PATCH /api/courses/:id` endpoints.
- Added form validation for total sessions and non-negative price before sending API payloads.
- Updated `docs/specs/kidseedshub-full-product-plan.md`: feature 28, feature 45, and P6.1 are now verified.

Verification:
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npm run typecheck` -> passed.
- `POST /api/courses` created `Smoke Course Config 2026`.
- `PATCH /api/courses/:id` updated total sessions to 9, price to 1900000, and set `isActive: false`.
- `GET /api/courses` returned the smoke course with updated values.
- Authenticated `GET /settings` returned the Course config section in rendered HTML.

Remaining:
- Expense runtime smoke, finance dashboard runtime assertion, Sale KPI, weekly/final assessment runtime smoke, and parent portal remain open.

## Interactive Pipeline And Calendar Schedule Update

Current status:
Pipeline status movement and class scheduling now support direct manipulation UI backed by real APIs.

Changes made:
- Updated `/pipeline` so cards can be dragged between the five CRM columns and still support explicit status selection.
- Added `PATCH /api/classes/:id` for Admin class schedule/status edits.
- Added `app/(dashboard)/classes/class-schedule-board.tsx` with a Notion-style weekly calendar board.
- Wired `/classes` so Admin can create classes, drag classes between weekdays, and switch active/inactive status.
- Updated the class DTO and validation contracts with `teacherId` and `isActive` support.
- Updated `PATCH /api/students/:id/status` to return a safe DTO instead of raw Prisma records with nested parent user fields.
- Updated `docs/specs/kidseedshub-full-product-plan.md` with the verified drag/drop pipeline and calendar schedule checks.

Verification:
- `npm run lint` -> passed.
- `npm run typecheck` -> passed.
- `npm run build` -> passed.
- `POST /api/classes` created `Smoke Calendar Drag Class`.
- `PATCH /api/classes/:id` moved the smoke class to weekday 3, changed its time, and set `isActive: false`.
- `GET /api/classes` returned the smoke class with `weekday: 3` and `isActive: false`.
- `PATCH /api/students/:id/status` moved `Pipeline Five Stage Smoke` to `EVALUATION` and returned only safe fields.
- `rg 'password|parent":|email' /private/tmp/ksh-status-response.json` returned no matches.
- Authenticated `GET /classes` and `GET /pipeline` returned the page shells in rendered HTML.

Remaining:
- Parent portal remains open.
- Browser visual QA was not available in this session, so UI verification is limited to build, API smoke, and authenticated HTML smoke.

## Recurring Class Schedule Update

Current status:
Class scheduling now models the real workflow: create one class/course schedule, define weekly recurring slots, and generate concrete class sessions automatically.

Changes made:
- Added `ClassSessionStatus` enum.
- Added `Class.startDate`, `Class.plannedSessions`, and `ClassScheduleSlot`.
- Extended `ClassSession` with `scheduleSlotId`, `startTime`, `endTime`, `room`, `status`, and `updatedAt`.
- Added `lib/backend/class-schedule.ts` to normalize schedule slots and generate sessions from weekly recurrence.
- Updated `POST /api/classes` and `PATCH /api/classes/:id` to create/update recurring slots and generated sessions.
- Added `GET /api/class-sessions` for calendar month data.
- Added `PATCH /api/class-sessions/:id` for dragging a generated session to another date and changing session status.
- Updated `/classes` calendar UI to a Notion-style month view with colored sessions, detail modal, drag/drop between dates, status select, and a multi-slot class creation form.
- Updated seed data to sync recurring slots/sessions for demo classes.
- Updated `docs/specs/kidseedshub-full-product-plan.md` tracking notes for feature 12 and P3.1.

Verification:
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma generate` -> passed.
- Manual migration SQL was applied through Docker psql because Prisma CLI could not connect from the sandbox.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npm run prisma:seed` -> passed.
- `npm run lint` -> passed.
- `npm run typecheck` -> passed.
- `npm run build` -> passed.
- `GET /api/classes` returns generated session counts and schedule slots.
- `POST /api/classes` created `Smoke Recurring Course Schedule` with T7/CN weekly slots and generated 6 sessions.
- `GET /api/class-sessions` returned generated sessions for the smoke recurring schedule.
- `PATCH /api/class-sessions/cmp443lmp0007pr8ywdl9zqtp` moved one generated session to `2026-05-18` and set status `CANCELED`.
- `GET /api/classes/today` still returns attendance-ready classes from generated sessions.

Remaining:
- Visual QA is still limited to build/API/HTML smoke in this session.
- The next scheduling slice should add bulk cycle update UX for changing all future sessions after a selected date, matching the reference modal's "Cập nhật chu kỳ" tab more closely.

## Class Student Roster Update

Current status:
Classes now have a manageable student roster. Students are attached to the class, and generated sessions use the class roster for attendance.

Changes made:
- Added `students` to `ClassListItem`.
- Added `PATCH /api/classes/:id/students` to replace the active roster for a class.
- Updated `/classes` creation form so Admin can select students when creating a recurring class.
- Updated the class session detail modal so Admin can add/remove students from the selected class.
- The session calendar updates `studentCount` after roster changes.

Verification:
- `npm run lint` -> passed.
- `npm run typecheck` -> passed.
- `npm run build` -> passed.
- `PATCH /api/classes/cmp443lme0001pr8yplbvn6ue/students` assigned `Smoke FUN Assessment` and `Trần Bảo Ngọc` to `Smoke Recurring Course Schedule`.
- Direct DB check confirmed both roster rows are active in `ClassStudent`.

Remaining:
- A later UX pass should add search/filter for large student lists and optionally prevent assigning students without an active enrollment in the matching course.

## Schedule Events And Fullscreen Calendar Update

Current status:
The class calendar now supports fullscreen viewing, holiday/event management, and automatic movement of affected scheduled sessions.

Changes made:
- Added `ScheduleEventType` and `ScheduleEvent` to Prisma, with a manual migration applied to Postgres.
- Added `GET/POST /api/schedule-events` and `PATCH/DELETE /api/schedule-events/:id`.
- Extended `lib/backend/class-schedule.ts` so recurring schedule generation skips blocked dates and schedule events can move existing scheduled sessions to the next available weekly slot.
- Updated class session and schedule event API DTOs to return local `YYYY-MM-DD` dates for calendar-safe grouping.
- Updated `/classes` calendar UI with a fullscreen toggle, holiday/event chips, and a holiday/event management form.
- Updated `docs/specs/kidseedshub-full-product-plan.md` with P3.5 verification.

Verification:
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma generate` -> passed.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `POST /api/schedule-events` created `Smoke nghỉ lễ dời lịch` for `2026-05-24` with `affectsScheduling: true` and returned `movedSessions: 1`.
- `GET /api/schedule-events?month=2026-05` returned the smoke holiday event.
- Direct DB check confirmed the affected `Smoke Recurring Course Schedule` session moved to `2026-06-06`.

Remaining:
- Parent absence requests and individual makeup eligibility are still tracked under feature 18 and remain Todo.
- Visual QA is still limited to build/API/HTML smoke in this session.

## Compact Classes UI Update

Current status:
The `/classes` page now reduces vertical scrolling by separating daily attendance, month calendar, and class setup into browser-like tabs.

Changes made:
- Reworked `/classes` page header into three tabs: `Lớp hôm nay`, `Lịch tháng`, and `Thiết lập`.
- Made `Lớp hôm nay` the default task-focused view.
- Replaced stacked daily class cards with a compact split layout: class switcher on the left, selected class attendance on the right.
- Added daily attendance counters for total, marked, present, and absent students.
- Collapsed note/photo controls behind a per-student `Ghi chú / ảnh` button.
- Updated `ClassScheduleBoard` so it can render only the calendar tab or only the setup forms.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Authenticated HTML smoke for `/classes` found `Lớp học`, `Lớp hôm nay`, `Lịch tháng`, `Thiết lập`, and `Ghi chú / ảnh`.
- Playwright login as Admin verified:
  - `Lớp hôm nay` tab shows compact class switcher and selected class attendance rows.
  - `Lịch tháng` tab shows the month calendar and fullscreen button.
  - `Thiết lập` tab shows class creation and holiday/event management forms.

Remaining:
- Later polish can add keyboard shortcuts for switching tabs and a search filter for large student rosters.

## Parent Portal Basics Update

Current status:
Parent Portal basics are implemented for viewing child data, remaining sessions, upcoming schedule, learning journal/photos, and downloadable final assessment text.

Changes made:
- Added `lib/contracts/parent-portal.ts`.
- Added `GET /api/parent/portal`, guarded by `portal:view_child`, scoped to `Parent.userId = session.user.id`.
- Added `GET /api/parent/final-assessments/:id/download`, guarded by parent ownership.
- Added `/parent` page with child selector, session balance cards, upcoming sessions, journal/photo links, and final report download buttons.
- Added `Phụ huynh` navigation item and Parent demo login shortcut.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for features 33, 35, 36, and P7.2.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Parent demo login `0911000001 / Parent@123` returned session role `PARENT`.
- `GET /api/parent/portal` as parent `0911000001` returned only child `Nguyễn Minh An`, course balance `12 bought / 4 used / 8 remaining`, upcoming sessions, and journal note.
- `GET /api/parent/portal` as Admin returned 403.
- Parent `0911000004 / Parent@123` could download final assessment `cmp3bby3s006tprux7w35pa67` as an attachment.

Remaining:
- Feature 34 absence request flow is still Todo.
- Feature 37 notifications are still Todo; the portal currently shows upcoming schedule but does not implement notifications.
- Feature 22 PDF final report remains separate from the text attachment download.

## Parent Portfolio UI Update

Current status:
The parent-facing `/parent` route is now visually separated from the internal dashboard and styled as a child learning portfolio.

Changes made:
- Moved Parent Portal route out of `(dashboard)` to `app/parent/page.tsx`.
- Removed `Phụ huynh` from the internal dashboard sidebar.
- Replaced the simple dashboard-style parent portal with a portfolio layout:
  - animated child hero visual,
  - child selector chips,
  - learning progress cards,
  - animated gallery/placeholder section,
  - timeline-style learning journal,
  - final report cards.
- Added parent-specific animation classes in `app/globals.css`.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Source smoke confirmed `Learning Portfolio`, `Course Progress`, `Khoảnh khắc lớp học`, and parent animation classes exist.
- Source smoke confirmed the internal sidebar no longer contains `Phụ huynh`.

Remaining:
- Replace placeholder visual cards with real uploaded class photos once storage/upload is implemented.

## Absence Request Flow Update

Current status:
Parent absence request flow is implemented and verified for feature 34. Feature 18 is partially covered because approved absence now records an excused absence, but dedicated makeup-date scheduling is still not built.

Changes made:
- Added `AbsenceRequestStatus` enum and `AbsenceRequest` model in Prisma.
- Added migration `20260513162000_absence_requests` and applied it to the local Postgres container.
- Added absence request contracts, validation, and backend mapper.
- Added `GET /api/absence-requests`, `POST /api/absence-requests`, and `PATCH /api/absence-requests/:id`.
- Added parent-owned request creation from `/parent` upcoming sessions.
- Added pending request review block in `/classes` so staff can approve or reject requests.
- Approval creates or updates the matching attendance row as `ABSENT_EXCUSED`.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for feature 34 and P7.3.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Parent `POST /api/absence-requests` created request `cmp48z8bm0001prh6jl8nie83` for student `Phạm Tường Vy`.
- Staff `GET /api/absence-requests?status=PENDING` returned the request.
- Staff `PATCH /api/absence-requests/cmp48z8bm0001prh6jl8nie83` approved it.
- DB check confirmed attendance status `ABSENT_EXCUSED` for session `cmp43wxiu000xprjr281i4wck`.
- Parent portal API returned the same session with absence status `APPROVED`.

Remaining:
- Build a dedicated makeup scheduling UI/API for feature 18.
- Browser CLI context switching was unstable during final visual check, so UI verification for the parent portal absence controls was covered through API smoke and source/build checks.

## Makeup Schedule Update

Current status:
Feature 18 is now implemented and verified at V1 level. Approved excused absences can be listed and assigned a makeup date.

Changes made:
- Added `lib/contracts/makeup-schedules.ts`.
- Added `lib/backend/makeup-schedule.ts`.
- Added `GET /api/makeup-schedules` to list `ABSENT_EXCUSED` attendance records.
- Added `PATCH /api/makeup-schedules/:id` to save or clear `Attendance.makeupDate`.
- Added `Học bù` tab on `/classes` with compact cards and date input per excused absence.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for feature 18 and P7.3.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Admin-authenticated `GET /api/makeup-schedules` returned the excused absence for `Phạm Tường Vy`.
- Admin-authenticated `PATCH /api/makeup-schedules/cmp48zhn20003prh6p28u3p83` saved `makeupDate: 2026-05-27`.
- Direct DB check confirmed `Attendance.makeupDate = 2026-05-27 00:00:00`.

Remaining:
- Later enhancement can create a real replacement `ClassSession` for makeup attendance instead of storing only the assigned makeup date.

## Parent Feedback Update

Current status:
Feature 38 is implemented and verified. Parent can submit after-course feedback from the parent portal, and Admin can review feedback in Reports.

Changes made:
- Added `lib/contracts/course-feedback.ts`.
- Added `lib/validations/course-feedback.ts`.
- Added `lib/backend/course-feedback.ts`.
- Added `POST /api/parent/feedback`, guarded by parent ownership of the student.
- Added `GET /api/course-feedback`, guarded by `reports:view_all`.
- Extended `GET /api/parent/portal` to return child feedbacks.
- Added feedback form to final report cards in `/parent`.
- Added feedback summary section to `/reports`.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for feature 38, P7.4, and Phase 6.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Parent-authenticated `POST /api/parent/feedback` created feedback `cmp4qqfow0005prh6t5tr29pl`.
- Admin-authenticated `GET /api/course-feedback` returned the feedback with `averageScore: 4.8`.
- Parent portal API returned the feedback in the selected child's `feedbacks` array.

Remaining:
- If the product later needs one feedback per course/report, add an explicit `finalAssessmentId` or `enrollmentId` relation to `CourseFeedback`.

## Zalo Template And Tuition Reminder Update

Current status:
P8.1 is implemented and verified. GitNexus MCP tools were not available in this Codex session; `npx gitnexus --help` hung and was stopped, so this slice used the repo's GitNexus guidance plus git/status/search impact checks as fallback.

Changes made:
- Added approved Zalo template registry in `lib/message-templates.ts`.
- Added reminder contracts in `lib/contracts/reminders.ts`.
- Added validation in `lib/validations/reminder.ts`.
- Added `GET /api/message-templates`.
- Added `GET /api/tuition-reminders` to generate personalized low-session reminder messages from active enrollments.
- Added `POST /api/tuition-reminders` to queue a reminder as an internal task.
- Added automation section to `/finance` with template selector, generated message preview, and queue-task action.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for features 7, 32, and P8.1.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `GET /api/message-templates` returned `TUITION_LOW_SESSIONS`.
- `GET /api/tuition-reminders?threshold=2&templateId=TUITION_LOW_SESSIONS` generated reminders for low-session enrollments.
- `POST /api/tuition-reminders` queued task `cmp501u8g0007prh67aikt0d6`.

Remaining:
- This does not send through a real Zalo provider yet. It prepares approved message content and queues staff follow-up tasks.

## Advanced Analytics Update

Current status:
P8.2 is implemented and verified. GitNexus was used before the slice to inspect the indexed reports area and check impact for `ReportsPage`; local GitNexus index was up to date before editing.

Changes made:
- Added advanced report contracts in `lib/contracts/reports.ts`.
- Added Admin-only `GET /api/reports/advanced` for lead source analytics, Sale revenue, retention, operations overview, and revenue forecast.
- Extended `/reports` with compact panels for source conversion, Sale revenue, retention by course, operations, and projected renewal revenue.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for features 5, 31, 40, 41, 42, 43, Phase 7, and P8.2.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Admin-authenticated `GET /api/reports/advanced?month=2026-05` returned `leadSources`, `saleRevenue`, `retention`, `operations`, and `forecast` with `projectedRenewalRevenue: 8000000`.

Remaining:
- Analytics definitions are pragmatic V1 rules. If Kid Seeds Hub later defines official retention or revenue forecast formulas, update `GET /api/reports/advanced` and keep the UI contract stable if possible.

## Audit Log And Internal Notification Update

Current status:
P8.3 is implemented and verified. The local Postgres container was running, but Prisma migration commands needed unsandboxed localhost DB access; the migration SQL was applied with `prisma db execute` and then marked applied with `prisma migrate resolve`.

Changes made:
- Added `AuditLog` and `InternalNotification` models plus migration `20260514120000_audit_notifications`.
- Added operation contracts in `lib/contracts/operations.ts`.
- Added shared activity helpers in `lib/backend/activity.ts`.
- Added Admin-only `GET /api/audit-logs`.
- Added staff `GET /api/notifications` and `PATCH /api/notifications/:id`.
- Wrote audit logs for user create/update, receipt create, expense create, absence request create/review, and schedule event create/update/delete.
- Wrote internal notifications for finance, absence request, and schedule event mutations.
- Added `Thông báo nội bộ` to Dashboard.
- Added `Log hoạt động` to Settings.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for features 46, 49, and P8.3.

Verification:
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma validate` -> passed.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma generate` -> passed.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Admin-authenticated `POST /api/users` created `Audit Smoke Teacher` and wrote `user.create`.
- Admin-authenticated `POST /api/schedule-events` created `Smoke thông báo nội bộ`, wrote `schedule_event.create`, and created `SCHEDULE_EVENT` notifications for Sale and Teacher users.
- Playwright confirmed `/dashboard` renders `Thông báo nội bộ`.
- Playwright confirmed `/settings` renders `Log hoạt động` with the smoke activity rows.

Remaining:
- P8.4 remains: QR attendance, Excel import, and dynamic permission matrix.

## QR Import Permission Matrix Update

Current status:
P8.4 is implemented and verified. This completes Phase 8 scope at the current plan level: QR attendance, Excel import, dynamic permission matrix, audit log, backup/export, and notifications.

Changes made:
- Added `PermissionMatrixEntry` model and migration `20260514123000_permission_matrix`.
- Extended `lib/permissions.ts` with permission labels and runtime role overrides while preserving the existing synchronous `can(role, permission)` API.
- Added `GET/PATCH /api/permission-matrix`.
- Added `POST /api/attendance/qr` for QR codes in the form `KSH:ENROLLMENT:<enrollmentId>` or raw enrollment id.
- Added `POST /api/imports/students` with `preview` and `commit` modes for `.xlsx` files.
- Added `lib/contracts/imports.ts` and `lib/contracts/permissions.ts`.
- Added QR attendance panel to `/classes`.
- Added Excel import and permission matrix panels to `/settings`.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for features 19, 48, 50, P0.2, P8.4, and Phase 8.

Verification:
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma db execute --file prisma/migrations/20260514123000_permission_matrix/migration.sql --schema prisma/schema.prisma` -> passed.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma migrate resolve --applied 20260514123000_permission_matrix` -> passed.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma generate` -> passed.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Admin-authenticated QR smoke marked `Trần Bảo Ngọc` present through `POST /api/attendance/qr` and wrote `attendance.qr_mark`.
- Admin-authenticated permission smoke updated `reports:view_own_kpi` roles to `ADMIN,SALE` through `PATCH /api/permission-matrix`.
- Admin-authenticated Excel import preview returned 1 valid row; commit created `Import Smoke Student` and wrote `students.import`.
- Playwright confirmed `/classes` renders `QR Attendance`.
- Playwright confirmed `/settings` renders `Import học viên từ Excel` and `Ma trận phân quyền`.

Remaining:
- Dynamic permission overrides are loaded and applied in the current server process after `/api/permission-matrix` reads or updates them. A future hardening pass can preload DB overrides during app startup or move all guards to an async permission service.

## Student Finance Multi-Course Receipt Update

Current status:
The student finance redesign is implemented and verified. Backend keeps `Enrollment` as the Prisma model, but user-facing UI labels it as `Khóa đã đăng ký`.

Changes made:
- Added `ReceiptLine` model and migration `20260515165000_receipt_lines` so one `Receipt` can contain multiple course lines.
- Backfilled existing receipts into one receipt line per receipt.
- Updated `POST /api/receipts` to accept `lines`, parse flexible discounts (`10%` or money), aggregate receipt totals, and update each registered course independently.
- Updated `GET /api/receipts/:id` and `/receipts/[id]/print` to return and render multi-line receipt data.
- Redesigned Student Detail `Tài chính` tab into compact sections: `Khóa cần thu`, `Tính phí`, and `Thanh toán`.
- Replaced visible `Enrollment` wording with `Khóa đã đăng ký`; backend names remain unchanged to reduce schema risk.

Verification:
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma db execute --file prisma/migrations/20260515165000_receipt_lines/migration.sql --schema prisma/schema.prisma` -> passed.
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma migrate resolve --applied 20260515165000_receipt_lines` -> passed.
- `npm run prisma:generate` -> passed.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Playwright verified single-course UI receipt `PT-2026-007` with `10%` discount, shared receipt note, and print page showing the line table and `10%`.
- Playwright verified multi-course UI receipt `PT-2026-008` for Robotics + FUN in one payment; print page shows `2 khóa đã đăng ký` and two receipt-line rows.

Remaining:
- The current seeded smoke data now has extra receipt/session rows from verification. That is acceptable for fake data, but reseed if a cleaner demo baseline is needed.

## Student Finance Guardrail Update

Current status:
Finance tab has stricter UX guardrails for manual overrides and editable registered courses.

Changes made:
- Added `PATCH /api/enrollments/:id` for editing a `Khóa đã đăng ký` without renaming the backend `Enrollment` model.
- Student detail now returns course id, class id/name, and enrollment start/end dates for registered courses.
- Removed the receipt checkbox for `Sửa số buổi`; clicking the auto-calculated `Số buổi tính phí` now opens a confirmation dialog before enabling manual edit.
- Clicking `Phụ huynh cần thanh toán` opens a confirmation dialog before manual total override.
- Receipt fields sanitize non-negative session inputs and show validation when `Đã học trước` exceeds `Số buổi tính phí`.
- Added a compact discount hint: `10%` means percentage discount; `100,000` means cash discount.
- Added `Sửa` action per registered course to edit class, start date, join session, trial sessions, paid-before-receipt sessions, sessions bought/used, and active status.
- Added safe registered-course mistake handling: `DELETE /api/enrollments/:id` deletes a clean enrollment, but cancels/deactivates an enrollment that already has receipt, attendance, weekly assessment, or final assessment data. The Student Detail edit dialog now has `Xóa/Hủy ghi danh` behind a confirmation dialog.

Verification:
- GitNexus status was up to date before changes.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Playwright verified the `Số buổi tính phí` confirmation dialog, manual-edit label, payment-total confirmation dialog, `Sửa khóa đã đăng ký` dialog save flow, and `Xóa/Hủy ghi danh` confirmation dialog.

## Learning Detail and Class Management UI Update

Current status:
Student learning details and class management are easier to inspect without leaving the current workflow.

Changes made:
- Student Detail `Học tập` tab now opens a detail dialog when clicking a registered course or class item.
- `/classes` `Thiết lập` tab now has compact sub-panels for `Quản lý lớp`, `Tạo lớp`, and `Lịch nghỉ` to reduce page scroll while keeping all fields available. The `Quản lý lớp` panel is searchable/filterable; clicking a class opens a detail dialog with course ownership, status, generated sessions, schedule slots, active roster, add-student select, remove-student actions, and active/inactive toggle.
- Dashboard sidebar is grouped into `Sale`, `Học tập`, and `Quản lý`; the class nav label is now `Lớp học`.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Playwright verified grouped sidebar, Student Detail learning course dialog, `/classes` setup class-management list, setup sub-panel switching, and class-management dialog.

Remaining:
- The edit dialog intentionally does not edit course identity; moving a student to a different course should remain a new registration to preserve receipt/assessment history.

## Vietnam Public Holiday Import Update

Current status:
The class holiday calendar can now preload Vietnam public holidays and use them as real scheduling blocks.

Changes made:
- Added `lib/backend/vietnam-public-holidays.ts` with Vietnam holiday definitions and an idempotent `ensureVietnamPublicHolidays` helper.
- Added `POST /api/schedule-events/vietnam-holidays`, guarded by `courses:manage`, to create missing holiday `ScheduleEvent` rows, skip duplicates, audit the import, notify staff, and reschedule affected future class sessions.
- Added `Nạp lễ VN YYYY` in `/classes` -> `Thiết lập` -> `Lịch nghỉ`.
- Updated `prisma/seed.ts` so seeded demo data includes Vietnam holiday blocks for 2026.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for feature 12 and P3.5.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Playwright verified `/classes` -> `Thiết lập` -> `Lịch nghỉ` -> `Nạp lễ VN 2026`; response created 22 holiday rows, skipped 0 existing rows, and the selected May view showed 3 `Nghỉ 30/4 - 1/5/2026` holiday blocks.

Notes:
- 2026 uses the announced public-sector holiday windows for Tết, Quốc khánh, Giỗ tổ Hùng Vương, and the 30/4-1/5 break. Weekend/bridge days are inserted as scheduling blocks so centers that close according to the public-sector holiday window do not need manual entries; staff can delete specific days if the center still teaches on those days.

## Vietnam Holiday And Center Event Preset Update

Current status:
The Vietnam preset now includes both official scheduling holidays and non-moving center event markers.

Changes made:
- Extended `lib/backend/vietnam-public-holidays.ts` so each preset has `type` and `affectsScheduling`.
- Official holidays remain `HOLIDAY` with `affectsScheduling: true`: Tết Dương lịch, Tết Nguyên đán 2026, Giỗ tổ Hùng Vương 2026, 30/4-1/5, and Quốc khánh 2026.
- Added center/event markers with `type: EVENT` and `affectsScheduling: false`: 8/3, 1/6, khai giảng, Trung thu 2026, 20/10, 20/11, and Giáng sinh.
- Updated the UI button/message from `Nạp lễ VN` to `Nạp lễ/sự kiện VN`.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for feature 12 and P3.5.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- `npx tsx -e "import { getVietnamPublicHolidays } from './lib/backend/vietnam-public-holidays.ts'; ..."` confirmed 2026 has 29 preset items: 22 scheduling holidays and 7 non-moving center events.

Blocked:
- Latest Playwright browser smoke could not complete because local Postgres was not running and Docker daemon was unavailable, so login/API calls could not reach `localhost:5434`.

## Student Learning Timeline And Assessment Progress Update

Current status:
Student Detail now exposes a compact learning history and assessment progress view inside the `Học tập` tab.

Changes made:
- Extended `GET /api/students/:id` to include `learningTimeline`, built from registered courses, attendance records, class photos, weekly assessments, and final assessments.
- Extended `GET /api/students/:id` to include `assessmentProgress` per registered course: subject, completed weeks, latest week, checklist tick count, and final assessment state.
- Updated `lib/contracts/students.ts` with `StudentLearningTimelineItem` and `StudentAssessmentProgressItem`.
- Redesigned the Student Detail `Học tập` tab to keep the existing course/class compact cards and add two scroll-contained panels: `Tiến độ đánh giá` and `Timeline học tập`.
- Updated `docs/specs/kidseedshub-full-product-plan.md` to mark feature 10, feature 21, and task P5.3 as verified.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Local app ran at `http://localhost:3000` with `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub'`.
- Playwright verified Admin login, opened `/students/cmp3bby2o000vpruxbibpq6fm`, clicked `Học tập`, and saw `Tiến độ đánh giá` plus `Timeline học tập` rendered from seeded DB data.

Notes:
- GitNexus CLI was attempted first but failed with `Cannot destructure property 'package' of 'node.target' as it is null.`; this slice used targeted file reads as the fallback.

## Student Receipt History Update

Current status:
Student Detail finance tab now shows all historical receipts for the selected student, not only the receipt created in the current UI session.

Changes made:
- Extended `GET /api/receipts` with `studentId` query filtering. It matches receipts through the legacy `Receipt.enrollmentId` pointer and through multi-line `ReceiptLine.enrollment.studentId`.
- Added `studentReceipts` loading to `app/(dashboard)/students/[id]/student-detail-client.tsx`.
- Added a compact `Lịch sử phiếu thu` panel above the receipt forms with total paid, receipt count, receipt lines, payment method, date, amount, notes, and print links.
- Created local demo receipt cases for student `cmp6ekscy0004pr90eps4b5z6`:
  - `PT-2026-010`: course-style receipt for `Robotics Nâng cao` full course.
  - `PT-2026-011`: monthly-style receipt for `FUN Explorers` month 05/2026.
  - `PT-2026-012`: three-course receipt for `Robotics Cơ bản`, `FUN Explorers`, and `Robotics Nâng cao`.
- Updated `docs/specs/kidseedshub-full-product-plan.md` for feature 25 and P6.2.

Verification:
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run build` -> passed.
- Local app health endpoint returned OK at `http://localhost:3000/api/health`.
- Playwright verified Admin login, opened `/students/cmp6ekscy0004pr90eps4b5z6`, clicked `Tài chính`, and saw `Lịch sử phiếu thu` with six receipts including the three new demo cases.

Notes:
- Demo receipts were inserted without mutating the current enrollment session balances, so they can demonstrate historical payment cases without changing the student's current remaining-session count.
- GitNexus CLI was attempted first but failed with `Cannot destructure property 'package' of 'node.target' as it is null.`; this slice used targeted file reads as the fallback.
