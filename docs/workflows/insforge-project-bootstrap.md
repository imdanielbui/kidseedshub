# InsForge Project Bootstrap Workflow

Use this workflow when a project should use InsForge as the backend platform.

## 1. Decide the platform fit

- Use InsForge when you want a stable backend standard for auth, Postgres, storage, AI gateway, and deployment.
- Prefer it for new full-stack apps that should stay consistent across agents.
- Do not force it into a project that already has a stable backend unless there is a clear benefit.

## 2. Confirm backend primitives

- Auth/session model.
- Database schema.
- Storage requirements.
- AI gateway/model access.
- Edge functions or compute needs.
- Deployment target.

## 3. Separate concerns

- Keep frontend UI tasks separate from backend platform tasks.
- Ask before changing schema, auth provider, or production data flow.
- Treat migrations and secrets as protected.

## 4. Bootstrap the backend plan

- Write a backend goal.
- Map platform assumptions.
- Define data model, auth, storage, and verification.
- Keep the plan small and operational.

## 5. Verify early

- Confirm env vars.
- Check logs and smoke tests.
- Validate auth, data access, and upload paths.
