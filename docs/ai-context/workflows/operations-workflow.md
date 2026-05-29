# Operations Workflow Contract

Use this file for classes, attendance, makeup, assessments, finance, receipts, staff leave, timesheets, payroll, reports, exports, reminders, and parent portal.

## Class And Attendance

- Class sessions are the operational anchor for attendance, notes, photos, QR, and makeup.
- Class sessions are also the anchor for teacher substitutions, teaching-hour timesheets, and affected-session warnings when staff take leave.
- Marking `PRESENT` deducts sessions exactly once for the same enrollment/session/day rule.
- Excused absence and makeup flows must preserve history and avoid accidental session loss.
- Approved/excused absence should create or update a makeup entitlement, not only a loose `makeupDate`, once the entitlement workflow exists.
- A makeup entitlement must resolve only once: scheduled/completed makeup, wallet credit, refund, expired, or rejected.
- Holiday/event changes must show what sessions moved or stayed unchanged.
- Staff leave must show impacted class sessions and let admin assign substitute, move, cancel, or leave unresolved. Do not auto-reschedule solely because leave was approved.
- If a session has a substitute teacher, teacher schedule and payroll/timesheet logic must treat the substitute as the teacher for that session.

Verification:

- API smoke for attendance create/update and no duplicate deduction.
- API smoke for impacted sessions, substitute assignment, makeup entitlement state, or timesheet generation when touched.
- UI smoke for `/classes` attendance, notes/photos, QR, makeup, or impacted staff-leave sessions when touched.

## Staff Leave, Timesheet, And Payroll

- Staff profile owns payroll config: employment type, start date, monthly salary for full-time staff, hourly rate for part-time staff, and payroll active state.
- Paid leave accrues by completed working month. Default policy is 1 paid leave day per completed month.
- Paid leave consumes paid leave balance. Unpaid leave does not consume paid balance but can create payroll deduction.
- Leave balance adjustments require admin reason and audit log.
- Staff leave request review must preserve status, reviewer, reviewed timestamp, and admin note.
- Part-time teacher timesheet defaults from completed class sessions they actually taught. If `substituteTeacherId` exists, count hours for the substitute teacher.
- Timesheet manual or adjustment entries require a note and approval before payroll.
- Payroll runs are monthly drafts first. Admin can adjust hours, bonuses, deductions, and final amount before approval.
- Approved payroll creates a locked approval trail. Paid payroll should create salary expense/payment records and reject direct edits afterward.
- Payroll and refund/credit records must stay auditable and linked to their source records instead of relying on free-text expense descriptions.

Verification:

- API smoke for leave request create/review and impacted-session listing.
- API smoke for leave balance accrual, paid leave deduction, unpaid leave deduction input, and adjustment audit.
- API smoke for completed/substituted class session -> timesheet hours.
- API smoke for payroll draft generation, approval, payment, salary expense linkage, and paid-run edit rejection.
- Role check: teacher cannot manage payroll, sale cannot view salary payroll, admin can approve/pay.

## Weekly And Final Assessment

- Weekly assessment is evidence collected by class/course/week.
- Robotics scoring uses fixed skill scoring rules unless rubric config says otherwise.
- FUN assessment uses checklist/progress evidence.
- Final assessment must be gated by required weekly evidence.
- Parent portal only shows published final reports.

Verification:

- API smoke for weekly save/reload and final gate.
- UI smoke for `/assessments` and final report/print page when touched.
- Parent visibility check for published versus unpublished reports when touched.

## Finance And Sessions

- Enrollment owns sessions bought, used, remaining, start/join/class/course state.
- Receipts can contain multiple lines and must preserve receipt history.
- Receipts must support wallet-credit application when student wallet credit exists.
- Manual overrides to billable sessions or payment totals need explicit confirmation.
- Delete/cancel enrollment rules must protect records that already have receipts, attendance, or assessments.
- Finance UI must show enough history for staff to explain a student's balance.
- Finance summary should separate revenue, normal expenses, salary expenses, refunds/credits, and net profit when payroll/refund/wallet features are touched.
- Refund payout should link to the entitlement/student/reason. Salary expense should link to payroll run/line.

Verification:

- API smoke for receipt create/update impact on enrollment session totals.
- API smoke for wallet-credit application, refund payout linkage, or payroll salary expense linkage when touched.
- UI smoke for student finance tab and receipt print when touched.
- Edge check for discount, paid-before-receipt, multi-line receipt, or manual override when touched.

## Reports, Reminders, And Exports

- Reports must reflect backend aggregates, not frontend-only calculations.
- Reminder generation must show source data and queued action.
- Exports must verify workbook/sheet/JSON shape, not just response success.

Verification:

- API/report smoke for the relevant month/filter.
- UI smoke for dashboard/report panels if user-facing.
- Export parse check when export output changes.
