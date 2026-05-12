# Skill: Next.js Page Builder

Use for CMS pages, dashboard pages, public pages, admin CRUD, and chat widget UI.

## Workflow

1. Detect router: App Router, Pages Router, or existing convention.
2. Read nearest layout, page, table/form, and design-system components.
3. Define states: loading, empty, error, unauthorized, success.
4. Build responsive UI using existing Tailwind/shadcn/MUI/Ant patterns.
5. Add data fetching/server actions/API calls following existing style.
6. Verify lint/build and manual responsive behavior when possible.

## Output

```md
Page:
Components:
Data flow:
States handled:
Verification:
```

## Rules

- Do not mix UI libraries in a single feature unless the repo already does.
- Avoid generic SaaS templates; match project brand.
- Add accessible labels, keyboard-friendly controls, and clear empty states.
