# CRM And Student Workflow Contract

Use this file for pipeline, leads, students, contact logs, tasks, parent account, student detail, and enrollment entry points.

## Core Flow

1. Lead is created with parent contact, source, status, and assigned owner when applicable.
2. Staff records contact logs and follow-up tasks.
3. Lead moves through pipeline status with `stageChangedAt`-style timing preserved.
4. Converted/active student gets parent account activation when the backend rule says so.
5. Enrollment/course/class/session data appears in student detail without duplicating manual state.

## Required Screens

- `/pipeline`: status movement, quick profile, next task/contact summary.
- `/students`: database/list view, filters, sorting, shared lead/student form.
- `/students/:id`: tabs for overview, CRM, learning, finance, journal, parent account.
- Parent account surfaces must respect parent ownership and visibility rules.

## Data/API Expectations

- Use existing student, CRM, task, enrollment, and parent-account contracts before adding payload fields.
- Contact logs and tasks belong to the student CRM timeline.
- Status changes must update shared backend status logic rather than only changing UI labels.
- Student code generation must stay backend-owned.
- Parent activation must not be duplicated in multiple frontend handlers.

## UI Expectations

- Quick profile/detail must use `DialogShell`.
- Create/edit forms must use `DialogFormShell` or the existing shared panel.
- Pipeline board and database view should preserve current filters and compact density.
- Student detail tabs should avoid one long unstructured page.
- Missing CRM history, tasks, enrollments, or parent account state need empty states.

## Verification

- API smoke: create/update student or lead, add contact log, add/complete task, change status.
- UI smoke: pipeline quick profile, status change, student detail tab refresh.
- Permission smoke when role access changes: sale sees own scope where applicable; admin sees all.
