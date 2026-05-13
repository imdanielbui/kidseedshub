# Claude Code Instructions

Use `AGENTS.md` as the source of truth for agents, protected files, context budget, and workflow handoff.

## Default Behavior

- Communicate in Vietnamese; keep code, identifiers, and technical comments in English when clearer.
- Do not start with long theory. Inspect relevant code, then act.
- Prefer minimal changes, clean architecture where useful, feature-first organization, and design-system consistency.
- Ask at most 5 short questions only when ambiguity affects correctness, security, data, or deployment.
- If the task is clear, implement and verify without waiting for confirmation.
- If build/test fails, fix small issues automatically; ask before large architecture changes.

## Karpathy-Inspired Coding Guardrails

- Think before coding: do not silently assume critical requirements.
- Simplicity first: no abstractions, frameworks, helpers, or configurability unless needed now.
- Surgical changes: every changed line must trace back to the user request.
- Goal-driven execution: convert tasks into verifiable success criteria and loop until verified.

## Spec-Kit Flow

When the task is a broad feature, cross-screen workflow, or requirement with unclear acceptance criteria, use a spec-driven flow:

1. Clarify.
2. Write a compact feature brief.
3. Produce a technical plan.
4. Break into tasks.
5. Implement.
6. Verify.

Prefer this flow for auth, scheduling, reports, integrations, and multi-role CMS work.

## GitNexus Context Workflow

Use GitNexus when a change may affect many files, call chains, or module boundaries.

- Run GitNexus analysis before broad refactors, dependency-heavy changes, or uncertain blast-radius edits.
- Use graph context to inspect clusters, execution flows, and impact before editing.
- Reindex after structural commits or dependency changes when the graph may be stale.

## InsForge Backend Profile

When the project uses InsForge, treat backend primitives as first-class:

- Auth/session.
- Postgres schema and migrations.
- Storage buckets and file handling.
- AI gateway and model access.
- Edge functions and deployment.

Keep frontend-only changes separate from backend platform changes.

## Context Discipline

- Search first, read targeted files second, edit third.
- Read current patterns before creating new patterns.
- Avoid repeating large code blocks in chat.
- When context exceeds roughly 70%, create a handoff summary with goal, decisions, files, changes, checks, and next action.

## Verification

Run the most relevant available checks:

- `npm run lint`, `npm run test`, `npm run build` for Next.js/Node projects when present.
- Unit tests for scheduling, attendance, payroll, reports, and data cleanup logic.
- E2E/manual checklist for auth, dashboard CRUD, role permissions, and critical admin flows.

If a command is unavailable, report that clearly and use the closest manual checklist.

## Final Response Format

Keep final output compact:

```md
Changed:
Verified:
Risks/notes:
Next:
```

Omit sections that do not apply.
