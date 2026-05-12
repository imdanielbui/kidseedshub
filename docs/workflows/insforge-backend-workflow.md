# InsForge Backend Workflow

Use this workflow when the project runs on InsForge or should be designed for it.

## Steps

1. Confirm the backend primitives needed: auth, Postgres, storage, compute, AI gateway, or edge functions.
2. Map the data flow and permissions.
3. Keep platform concerns separate from UI changes.
4. Use migration and deployment checks explicitly.
5. Verify with logs, smoke checks, or platform docs.

## Good Fit

- New full-stack app with a stable backend standard.
- Features needing auth, data, file storage, or AI gateway.
- Projects that should minimize backend drift across agents.
