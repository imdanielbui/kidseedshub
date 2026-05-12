# Coding Workflow

Use this workflow for normal implementation tasks.

## Steps

1. Clarify only if needed: ask up to 5 short questions for ambiguity around scope, roles, data, auth, or deployment.
2. Inspect targeted files: route/page, component, data access, schema/types, tests.
3. Identify existing pattern: UI library, validation, API style, error handling, test runner.
4. Implement smallest correct change.
5. Add or update tests for business logic and critical flows.
6. Run relevant checks: lint, test, build.
7. Final response: changed files, verification, risks, next steps.

## Default Success Criteria

- Feature works for intended roles.
- No unrelated files changed.
- UI handles loading, empty, error, unauthorized states when relevant.
- API validates input and protects user data.
- Relevant checks pass or limitations are reported.
