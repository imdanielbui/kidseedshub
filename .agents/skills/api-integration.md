# Skill: API Integration

Use for Google APIs, OpenAI, email services, Firebase/Supabase, and third-party services.

## Workflow

1. Identify API purpose, auth method, rate limits, and data shape.
2. Keep credentials in env; never commit secrets.
3. Create a small client wrapper if reused.
4. Validate inputs and normalize external errors.
5. Add retry/idempotency only where useful.
6. Test with mocked or dry-run mode when possible.

## Output

```md
Integration:
Env required:
Data flow:
Error handling:
Verification:
Security notes:
```

## Google APIs Notes

- Separate Google auth/client setup from business logic.
- Prefer least-privilege scopes.
- Document required OAuth/service-account setup.
