# Skill: Deployment Checklist

Use before Vercel or other production deployment.

## Workflow

1. Confirm deployment target and branch.
2. Check env variables and secrets without printing values.
3. Run lint, tests, and build where available.
4. Check auth callbacks, API base URLs, CORS, cron/webhook URLs.
5. Confirm migrations/data changes are approved.
6. Deploy only when explicitly requested.
7. Verify production smoke tests.

## Output

```md
Target:
Preflight:
Build/test:
Env status:
Deployment:
Smoke tests:
Rollback notes:
```
