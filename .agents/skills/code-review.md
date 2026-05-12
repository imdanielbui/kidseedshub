# Skill: Code Review

Use before commit/PR or after non-trivial AI-generated code.

## Review Focus

- Correctness and edge cases.
- Auth/session and role permission regressions.
- Student/parent data privacy.
- API validation and error handling.
- Missing tests for scheduling, attendance, payroll, reports, and critical CRUD.
- UI states: loading, empty, error, unauthorized, mobile.

## Output

```md
Findings:
- Severity: file:line - issue - impact - suggested fix

Open questions:
Residual risks:
```

## Rules

- Findings first, ordered by severity.
- Avoid nitpicks unless they create real risk.
- If no findings, say so and mention testing gaps.
