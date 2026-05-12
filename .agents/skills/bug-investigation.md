# Skill: Bug Investigation

Use for build errors, runtime errors, auth issues, broken dashboards, incorrect reports, and scheduling bugs.

## Workflow

1. Capture symptom, expected behavior, actual behavior, and reproduction steps.
2. Search for the error text and related code paths.
3. Identify the smallest likely cause.
4. Add or update a regression test when practical.
5. Fix minimally.
6. Verify with the relevant command or manual flow.

## Output

```md
Symptom:
Root cause:
Fix:
Verification:
Regression risk:
```

## Rules

- Do not rewrite surrounding code while debugging.
- If reproduction is impossible, state the missing data and use code inspection carefully.
- For scheduling bugs, test holidays, fixed weekdays, start date, total session count, and manual edits.
