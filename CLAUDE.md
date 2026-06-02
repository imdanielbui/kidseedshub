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

1. Read `docs/ai-context/index.md`.
2. Read `docs/ai-context/product-contract.md`, `docs/ai-context/ui-contract.md`, and the relevant workflow contract.
3. Clarify.
4. Write a compact feature brief.
5. Produce a technical plan.
6. Break into tasks.
7. Implement.
8. Verify.

Prefer this flow for auth, scheduling, reports, integrations, and multi-role CMS work.

## Product And UI Contract

Before non-trivial product/UI work, use `docs/ai-context/` as the short source of truth:

- `index.md` defines the required read order.
- `product-contract.md` defines ship-ready workflow, data, permission, and verification rules.
- `ui-contract.md` defines shared shell, dialog, form, list/table, state, and accessibility rules.
- `feature-slice-template.md` defines the minimum spec fields.
- `workflows/*.md` defines module-specific workflow contracts.

Report these fields before implementation:

```md
Contract read:
Workflow:
Data/API impact:
UI impact:
Verification target:
GitNexus:
```

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **kidseedshub** (3267 symbols, 6311 relationships, 224 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/kidseedshub/context` | Codebase overview, check index freshness |
| `gitnexus://repo/kidseedshub/clusters` | All functional areas |
| `gitnexus://repo/kidseedshub/processes` | All execution flows |
| `gitnexus://repo/kidseedshub/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
