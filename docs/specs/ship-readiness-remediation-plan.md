# Ship-Readiness Remediation Plan

This plan extends the current MVP into a more realistic internal operations system. Keep it separate from `kidseedshub-full-product-plan.md`; that file remains the roadmap/status reference, while this file is the execution plan for production hardening, makeup/refund, staff leave, timesheet, and payroll.

## Current Audit Snapshot

- `npm run typecheck`: passed in the prior ship-readiness audit.
- `npm run lint`: passed in the prior ship-readiness audit.
- `npm run build`: passed in the prior ship-readiness audit.
- `npx prisma validate`: failed in the prior shell because `DATABASE_URL` was not set, not because of a schema syntax error.
- `ExpenseCategory.SALARY` exists, but there is no real payroll run, payroll line, staff timesheet, or leave ledger.
- Makeup is currently stored as `Attendance.makeupDate`; there is no monthly quota, entitlement state, wallet credit, or refund resolution.
- Staff leave is not modeled. Existing schedule events represent center holidays/events, not staff absences.

## Priorities

### P0 - Security And Deployment Blockers

- Hide demo login shortcuts/accounts in production UI.
- Do not use phone-number-derived or fixed default parent passwords in production.
- Fail loud in production when both `NEXTAUTH_SECRET` and `AUTH_SECRET` are missing.
- Make the permission matrix production-safe for serverless/runtime reloads; do not rely only on global in-memory overrides.
- Add credential-login rate limiting and/or lockout.
- Restrict class photo/image URLs to trusted upload/storage sources before production.
- Add environment validation that can run in CI and local deployment preflight.

### P1 - Operations Foundation

- Replace `Attendance.makeupDate`-only makeup with `MakeupEntitlement` and a one-resolution rule.
- Add staff leave requests with impacted class-session review.
- Add staff profiles/payroll config.
- Add staff timesheets.
- Add monthly payroll draft generation, approval, payment records, and salary expense linkage.

### P2 - Reporting And Finance Polish

- Add reports for pending/expired/refunded makeup entitlements.
- Add student wallet credit and refund ledger visibility on the student finance tab.
- Split finance summary into revenue, normal expenses, salary expenses, refunds/credits, and net profit.
- Add parent notifications for schedule, makeup, credit, and refund outcomes.
- Add debt warnings for students with no remaining sessions and no next payment.

### P3 - Advanced Analytics

- Add payroll monthly cost trend.
- Add part-time teaching-hour trend by teacher/class/course.
- Add leave balance and affected-class reporting.
- Add class skill comparison and deeper operations analytics.

## Required Feature Slices

### 1. Security And Deployment Hardening

Goal: production must not silently run with demo credentials, weak secrets, or unsafe auth behavior.

Scope:

- Login UI hides demo shortcuts outside development/demo environments.
- Parent account creation/reset requires a production-safe temporary password flow.
- Server startup or auth initialization fails loudly when production secrets are missing.
- Credential login has rate-limit/lockout protection.
- Permission matrix reads persisted rules reliably in serverless/server restarts.
- Class photo URL creation validates allowed sources.

Acceptance criteria:

- In production mode, demo account buttons are not rendered.
- In production mode, missing auth secret fails the process before user login.
- A parent account cannot be created/reset to `Parent@123` or the phone number in production.
- Repeated failed credential attempts are blocked or slowed with an auditable response.
- Permission changes persist after process restart.
- `POST /api/class-photos` rejects untrusted URL sources.

Verification:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Auth smoke for allowed/denied login paths.
- API smoke for permission matrix reload behavior.
- API smoke for trusted and untrusted class-photo URLs.

### 2. Staff Leave Management

Goal: admins can review staff/teacher leave and see affected classes without automatic rescheduling.

Data/API impact:

- Add `StaffLeaveRequest`.
- Add `ClassSession.substituteTeacherId`.
- Add audit logs and internal notifications for leave lifecycle changes.
- New APIs:
  - `GET/POST /api/staff-leaves`
  - `GET/PATCH /api/staff-leaves/[id]`
  - `GET /api/staff-leaves/[id]/impacted-sessions`

Model fields:

- `StaffLeaveRequest`: staff user, date range, leave type, reason, status, reviewer, reviewedAt, adminNote.
- Leave type: paid leave, unpaid leave, sick leave, other.
- Leave status: pending, approved, rejected, canceled.
- `ClassSession.substituteTeacherId`: optional user assigned to teach a single session.

Workflow:

1. Staff submits or admin creates a leave request.
2. System lists `ClassSession` rows where the staff member is the primary teacher or substitute in the requested range.
3. Admin approves/rejects the request.
4. For each impacted session, admin chooses one action: assign substitute teacher, move session, cancel session, or leave unresolved.
5. System writes audit logs and sends notifications to the requester, substitute teacher, and admins as relevant.

Rules:

- Do not automatically move or cancel class sessions when leave is approved.
- Leave approval can happen before all impacted sessions are resolved, but unresolved sessions must be visible.
- Teacher-facing schedule must include sessions where the teacher is `substituteTeacherId`.

Acceptance criteria:

- Admin sees impacted sessions before approval.
- Admin can assign a substitute to one affected session.
- Teacher sees own primary sessions and substituted sessions.
- Audit log records request review and impacted-session action.

### 3. Leave Balance For Full-Time Staff

Goal: full-time staff accrue paid leave by completed working months, and adjustments are auditable.

Data/API impact:

- Add `StaffProfile`.
- Add `StaffLeaveBalanceAdjustment`.
- `StaffProfile` fields: user, employmentType, startDate, monthlySalary, hourlyRate, payrollActive.
- Employment type: `FULL_TIME`, `PART_TIME`.

Rules:

- Each completed working month accrues 1 paid leave day.
- Paid leave balance = accrued paid leave days - approved paid leave days + adjustments.
- Unpaid leave does not consume paid leave balance.
- Unpaid leave can create payroll deductions according to payroll rules.
- Admin adjustments require reason and audit log.

Acceptance criteria:

- Staff working 3 complete months shows 3 accrued paid leave days.
- One approved paid leave day reduces balance by 1.
- One approved unpaid leave day does not reduce paid balance but is visible to payroll.
- Manual balance adjustment requires a note/reason.

### 4. Teacher/Staff Timesheet

Goal: class teaching hours and manual staff time can be reviewed before payroll.

Data/API impact:

- Add `StaffTimesheetEntry`.
- New APIs:
  - `GET/POST /api/timesheets`
  - `PATCH /api/timesheets/[id]` if route granularity is needed.

Model fields:

- staffId, date, source, startTime, endTime, hours, status, linkedClassSessionId, approvedById, note.
- Source: class session, manual, adjustment.
- Status: draft, approved, rejected.

Rules:

- For part-time teachers, completed class sessions create default timesheet entries.
- If `ClassSession.substituteTeacherId` exists, the substitute teacher receives the teaching hours, not the primary teacher.
- Hours come from `ClassSession.startTime/endTime` unless an admin override is recorded.
- Manual adjustments require a note.
- Full-time staff can have attendance/time tracking, but payroll defaults to monthly salary.

Acceptance criteria:

- Completing a class creates or refreshes a draft/approved teaching-hours entry for the correct teacher.
- A substituted session counts for the substitute teacher.
- Admin can add or adjust a timesheet entry with a required note.
- Payroll generation only uses approved hours for part-time salary.

### 5. Monthly Payroll Run

Goal: salary and part-time teacher payment drafts are generated automatically, then reviewed before expense creation.

Data/API impact:

- Add `PayrollRun`.
- Add `PayrollLine`.
- Link payroll payment to `Expense` with `ExpenseCategory.SALARY` or a dedicated payroll/refund linkage field.
- New APIs:
  - `GET/POST /api/payroll-runs`
  - `GET/PATCH /api/payroll-runs/[id]`
  - `POST /api/payroll-runs/[id]/generate`
  - `POST /api/payroll-runs/[id]/approve`
  - `POST /api/payroll-runs/[id]/pay`

Model fields:

- `PayrollRun`: month, status, generatedById, approvedById, paidAt.
- Run status: draft, approved, paid, canceled.
- `PayrollLine`: staffId, employmentType, baseSalary, hourlyRate, hoursWorked, grossAmount, deductions, adjustments, finalAmount, note.

Rules:

- Full-time payroll = monthlySalary - unpaid leave deductions + manual adjustments.
- Part-time payroll = approved hours * hourlyRate + manual adjustments.
- Admin can edit hours, bonus, deduction, final amount, and note while run is draft.
- Override of final amount or hours requires a note.
- Approved payroll creates a locked approval trail.
- Paid payroll creates salary expense/payment records.
- Paid payroll cannot be edited directly; corrections go into a later adjustment.

Acceptance criteria:

- Admin can create a monthly payroll draft.
- Full-time line is generated from monthly salary.
- Part-time line is generated from approved timesheet hours.
- Bonus/deduction changes final amount and records a note.
- Approving or paying writes audit logs.
- Paying payroll creates salary expense linkage.
- Paid payroll rejects direct edits.

### 6. Automatic Salary And Part-Time Teacher Payments

Goal: payroll is not manually recreated from scratch every month.

Workflow:

1. Admin opens Payroll under Finance or Settings.
2. Admin clicks "Create monthly payroll" for a month.
3. System generates draft lines for active staff profiles.
4. Admin reviews hours, leave deductions, bonuses, and deductions.
5. Admin approves the payroll run.
6. Admin marks it paid, which creates salary expense/payment records.

Rules:

- The system only creates internal payroll and expense records.
- The system does not initiate real bank/cash transfers.
- Admin keeps edit rights before approval.
- Finance reports must treat salary expense separately from normal operating expenses.

### 7. Makeup Quota, Credit, And Refund Workflow

Goal: every excused absence has a controlled entitlement that can resolve exactly once.

Data/API impact:

- Add `MakeupEntitlement`.
- Add `StudentWalletEntry`.
- Add optional `Refund` model or refund linkage fields on `Expense`.
- New APIs:
  - `GET/POST /api/makeup-entitlements`
  - `GET/PATCH /api/makeup-entitlements/[id]`
  - `GET/POST /api/student-wallet`
- Updated APIs:
  - `/api/receipts` supports applying wallet credit.
  - `/api/expenses` supports refund linkage.

Entitlement statuses:

- pending schedule
- scheduled
- completed
- credited
- refunded
- expired
- rejected

Rules:

- Each student has 1 eligible makeup entitlement per month for approved/excused absence.
- Second approved absence in the same month is ineligible unless admin override exists.
- One entitlement can resolve only once: makeup, wallet credit, or refund.
- If a makeup class is available, schedule it and mark completed after attendance.
- If no makeup class is available, admin can create wallet credit for a future receipt or a refund payout.
- Student finance tab must show makeup, credit, and refund history.

Acceptance criteria:

- First approved absence in a month creates an eligible entitlement.
- Second approved absence in the same month is rejected or marked ineligible unless overridden.
- Completing a makeup marks the entitlement completed.
- Applying credit or refund prevents later makeup scheduling for the same entitlement.
- Parent/student ownership is enforced for any parent-visible credit/refund data.

### 8. Finance Integration

Goal: payroll, wallet credit, and refund are visible in finance without hiding business meaning inside text descriptions.

Scope:

- Keep `ExpenseCategory.SALARY`.
- Add explicit payroll linkage to salary expense rows.
- Add explicit refund linkage to refund payout rows.
- Add wallet-credit ledger entries for student credit.
- Receipt creation can apply wallet credit against future tuition.
- Finance summary separates revenue, normal expenses, salary expenses, refunds/credits, and net profit.

Acceptance criteria:

- Salary expenses can be traced back to payroll run/line.
- Refund payouts can be traced back to entitlement/student/reason.
- Wallet credits can be traced from entitlement to future receipt application.
- Finance summary does not mix salary expense, operating expense, and refund/credit into one opaque number.

### 9. Remaining Product Backlog

- Health and special notes for students.
- Debt warning for students who run out of sessions without the next payment.
- Parent schedule and notifications.
- Class skill comparison.
- Reports for staff leave, affected classes, makeup/refund states, payroll cost, part-time teaching hours, and leave balance.

## New Permissions

- `staff_leave:view`
- `staff_leave:manage`
- `timesheet:view`
- `timesheet:manage`
- `payroll:view`
- `payroll:manage`
- `payroll:approve`
- `makeup:manage`
- `refunds:manage`
- `wallet:apply_credit`

## Suggested Implementation Order

1. P0 hardening: auth secret validation, demo account hiding, parent password policy, permission matrix persistence, rate limit, image source validation.
2. Schema brief and migration design for staff profiles, staff leave, timesheet, payroll, makeup entitlement, wallet, refund/expense linkages.
3. Backend APIs and service functions for staff leave and impacted sessions.
4. Backend APIs and service functions for leave balance and timesheet generation.
5. Backend APIs and service functions for payroll generation, approval, payment, and salary expense linkage.
6. Backend APIs and service functions for makeup entitlement, wallet credit, refund, and receipt credit application.
7. UI slices for staff leave, timesheet, payroll, makeup/refund, and student finance history.
8. Report and dashboard updates.
9. Tests and smoke verification.

## Test Plan

Required baseline checks:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma validate`
- `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma migrate status`

Staff leave tests:

- Create leave request.
- Approve leave.
- List impacted class sessions.
- Assign substitute teacher.
- Confirm teacher sees own and substituted sessions only.

Leave balance tests:

- Staff working 3 full months accrues 3 paid leave days.
- Approved paid leave deducts balance.
- Unpaid leave does not consume paid balance but affects payroll deduction.
- Manual balance adjustment requires a reason.

Timesheet tests:

- Completed class creates part-time teacher hours.
- Substitute teacher receives hours instead of primary teacher.
- Manual adjustment requires note.
- Payroll ignores unapproved timesheet entries.

Payroll tests:

- Full-time monthly salary is generated automatically.
- Part-time salary equals approved hours multiplied by hourly rate.
- Bonus/deduction changes final amount.
- Approved payroll creates salary expense linkage.
- Paid payroll cannot be edited directly.

Makeup/refund tests:

- First approved absence in month creates eligible entitlement.
- Second approved absence in same month is ineligible unless admin override exists.
- Entitlement can resolve once only.
- Credit applies to future receipt.
- Cash/bank refund creates auditable finance entry.

Security tests:

- Parent cannot see another child's credit/refund/report.
- Teacher cannot manage payroll.
- Sale cannot view salary payroll.
- Admin can approve payroll and see audit trail.

## Assumptions

- Staff leave should warn admin about affected classes, not auto-reschedule.
- Part-time teacher pay is calculated from completed class sessions by default.
- Full-time staff salary is fixed monthly, with deductions/adjustments.
- Paid leave accrues 1 day per completed working month.
- Payroll and part-time teacher payments are auto-generated as monthly drafts, but admin can adjust before approval.
- Actual bank/cash transfer is not automated; the system creates records and payment/expense documents only.
- Refund for missed makeup can be handled either as wallet credit or as cash/bank refund through finance.
- Implementation should happen in slices: docs/spec first, schema second, backend third, UI fourth, tests last.
