# Deployment Workflow

Primary target: Vercel. Other targets are project-specific.

## Preflight

- Confirm branch and release scope.
- Confirm deployment target.
- Check env variables exist without printing values.
- Confirm migrations/data changes are approved.
- Run lint, test, and build where available.

## Deploy

- Deploy only when explicitly requested.
- Capture deployment URL and build status.
- Run smoke checks: homepage, login, dashboard, protected route, key API route.

## Rollback Notes

- Identify previous stable deployment.
- Record migration/data compatibility risk.
- Record env changes required to rollback.
