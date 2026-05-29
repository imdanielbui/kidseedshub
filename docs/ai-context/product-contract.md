# Product Contract

Kid Seeds Hub is an operations system for a STEM/Robotics education center. Treat features as real staff workflows, not isolated UI widgets.

## Ship-Ready Rule

A feature is not ship-ready unless these are clear and verified:

- User role: admin, sale, teacher, parent, student, customer-success, or finance.
- Workflow entry and exit: where the user starts, what changes, and what they see next.
- Data owner: which model/API owns the data and which screens read it.
- Permission/privacy: who can view or mutate student, parent, finance, and assessment data.
- UI states: loading, empty, error, unauthorized, submitting, and success.
- Recovery path: how staff fixes mistakes without corrupting history.
- Verification: API/backend check plus UI/manual flow for user-facing work.

## Data Rules

- Any feature that creates, edits, deletes, filters, or persists data must inspect backend patterns first.
- Do not build frontend-only state for business data that should survive reload.
- Use existing validation and contract folders before adding new shapes:
  - `lib/contracts/`
  - `lib/validations/`
  - `lib/backend/`
  - `lib/permissions.ts`
- Preserve auditability for finance, attendance, assessment, parent portal, and permission changes.
- Ask before schema migrations, seed changes, production data changes, auth/session changes, or role/permission model changes.

## Workflow Rules

- Lead workflows must connect CRM action to next task/contact/status.
- Enrollment and receipt workflows must keep sessions bought, used, remaining, and receipt history consistent.
- Attendance workflows must prevent accidental duplicate session deduction.
- Parent-facing workflows must enforce ownership and publish/visibility gates.
- Assessment workflows must distinguish weekly evidence from final published reports.
- Deleting operational records should prefer reversible cancellation/inactivation when history exists.

## Verification Rules

- For backend logic: run the smallest API/unit/script check that proves the business rule.
- For UI: verify the actual screen flow with the browser when practical.
- For role/privacy: test at least allowed and denied access when the change touches protected data.
- For reports/exports: verify generated output shape, not just HTTP success.
- If a check is skipped, say why and identify the residual risk.
