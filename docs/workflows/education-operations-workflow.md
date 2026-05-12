# Education Operations Workflow

Use this for class scheduling, attendance, make-up learning, teacher payroll, and course reports.

## Class Opening

Required inputs:

- Course, class name/code, total sessions.
- Start date, weekdays, time slot, room, teacher.
- Holiday calendar source.
- Admin approval mode: auto-generate or review before publish.

## Schedule Generation

- Generate sessions from start date and fixed weekdays/time slot.
- Skip configured Vietnam holidays.
- Continue generating later sessions until total session count is reached.
- Preserve manual admin edits.
- Show holiday skips and replacement sessions for admin review when enabled.

## Attendance

- Track present, absent with permission, absent without permission.
- Allow lesson notes and student-specific notes.
- Absence with permission can create makeup eligibility, but rules must be configurable.

## Teacher Payroll

- Calculate from completed/taught sessions and teaching hours.
- Keep payroll draft until admin approval.
- Preserve audit trail for manual edits.

## Course Report

- Dashboard view for admin/teacher.
- PDF for parents.
- Excel for internal summary.
- AI comments must use actual attendance, progress notes, and teacher input.
