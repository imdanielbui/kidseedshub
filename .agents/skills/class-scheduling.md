# Skill: Class Scheduling

Use for education operations: opening classes, generating sessions, holiday handling, attendance, makeup eligibility, teacher payroll, and course reports.

## Core Rules

- Generate sessions from start date, weekdays, time slot, total sessions, teacher, room, and course.
- Vietnam holidays must be configurable, not hardcoded as permanent business logic.
- Default holiday behavior: skip holiday sessions and create/propose replacement sessions until total sessions are met.
- Manual admin edits must be preserved.
- Attendance supports present, absent with permission, absent without permission, and lesson note.
- Absence with permission may create makeup eligibility; detailed policies remain configurable.
- Teacher payroll uses taught sessions, teaching hours, and manual approval.

## Verification Cases

- Start date falls on a non-class weekday.
- Session falls on Vietnam holiday.
- Multiple holidays in one course.
- Manual session moved before/after generation.
- Student absent with permission.
- Teacher session approved and rejected.

## Output

```md
Schedule inputs:
Generated sessions:
Holiday handling:
Manual edit behavior:
Attendance impact:
Payroll impact:
Tests/checks:
```
