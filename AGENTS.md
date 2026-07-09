# AI Workspace Agents

This workspace is optimized for Codex, Claude Code, and Cursor on Next.js CMS/dashboard, auth, education operations, AI chatbot, Google integrations, Excel dashboards, internal automation, spec-driven development, optional InsForge-backed projects, and GitNexus-assisted codebase intelligence.

Default language: Vietnamese for collaboration, English for code names, technical docs, comments, commit messages, and API contracts when appropriate.

## Core Rules

- Rule 1 - Think Before Coding: state assumptions explicitly. If uncertain, ask rather than guess. Present multiple interpretations when ambiguity exists. Push back when a simpler approach exists. Stop when confused. Name what's unclear.
- Rule 2 - Simplicity First: minimum code that solves the problem. Nothing speculative. No features beyond what was asked. No abstractions for single-use code. If a senior engineer would call it overcomplicated, simplify.
- Rule 3 - Surgical Changes: touch only what you must. Clean up only your own mess. Do not improve adjacent code, comments, or formatting. Do not refactor what is not broken. Match existing style.
- Rule 4 - Goal-Driven Execution: define success criteria. Loop until verified. Do not follow steps blindly. Define success and iterate. Strong success criteria let you loop independently.
- Rule 5 - Use the Model Only for Judgment Calls: use the model for classification, drafting, summarization, and extraction. Do not use it for routing, retries, or deterministic transforms. If code can answer, code answers.
- Rule 6 - Token Budgets Are Not Advisory: per-task budget is 4,000 tokens and per-session budget is 30,000 tokens. If approaching budget, summarize and start fresh. Surface the breach. Do not silently overrun.
- Rule 7 - Surface Conflicts, Don't Average Them: if two patterns contradict, pick one based on recency or test coverage. Explain why. Flag the other for cleanup. Do not blend conflicting patterns.
- Rule 8 - Read Before You Write: before adding code, read exports, immediate callers, and shared utilities. "Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.
- Rule 8A - Data Features Are Full-Stack: for any feature that reads, writes, persists, filters, or changes state, inspect the repo's backend pattern first, identify the required API/data model, implement or update backend before or in parallel with UI, then verify both backend and UI. Do not build frontend-only flows for features that need stored data.
- Rule 8B - Use GitNexus for Deep Repo Context: when the repo is large, the dependency chain is unclear, or the change may have blast radius, use GitNexus/knowledge-graph context first to inspect clusters, callers, processes, and impact before editing.
- Rule 9 - Tests Verify Intent, Not Just Behavior: tests must encode why behavior matters, not just what it does. A test that cannot fail when business logic changes is wrong.
- Rule 10 - Checkpoint After Every Significant Step: summarize what was done, what is verified, and what remains. Do not continue from a state you cannot describe back. If you lose track, stop and restate.
- Rule 11 - Match the Codebase's Conventions, Even If You Disagree: conformance over taste inside the codebase. If a convention is harmful, surface it. Do not fork silently.
- Rule 12 - Fail Loud: "Completed" is wrong if anything was skipped silently. "Tests pass" is wrong if any were skipped. Default to surfacing uncertainty, not hiding it.

## Protected Areas

Ask before modifying:

- `.env*`, credentials, keys, tokens, secret config.
- Production data, seed data, exports, backups.
- Database migrations or schema changes that may affect persisted data.
- Deployment, CI/CD, Docker, hosting, or infrastructure config unless the task is deployment-related.
- Auth/session logic, role permissions, and student/parent data access if the requested change is unclear.

Never run destructive commands such as hard reset, force push, database wipe, or deleting user data unless explicitly approved.

## Spec-Driven Development

Use spec-kit style flow when the task is a new feature, cross-screen workflow, or anything with unclear acceptance criteria.

- Clarify requirements first with short questions.
- Read `docs/ai-context/index.md` before planning or coding non-trivial product/UI work.
- Treat `docs/ai-context/product-contract.md` and `docs/ai-context/ui-contract.md` as the daily product and design-system contract.
- Read the relevant `docs/ai-context/workflows/*.md` file before changing a module workflow.
- Write a compact feature brief before implementation.
- For features with data or state, identify backend/API/data model before implementing UI. Backend and frontend must be planned and verified together.
- Break work into plan, tasks, implement, verify.
- Keep spec artifacts short and executable, not essay-like.
- Use spec-driven workflow especially for auth, scheduling, reports, integrations, and multi-role CMS flows.

## AI Context Contracts

Use `docs/ai-context/` to keep agents from relying on memory or re-reading the full product plan.

- `docs/ai-context/index.md`: required read order and per-task output fields.
- `docs/ai-context/product-contract.md`: ship-ready rules for product, data, privacy, and verification.
- `docs/ai-context/ui-contract.md`: shared UI rules for shell, dialogs, forms, lists, tables, states, and accessibility.
- `docs/ai-context/feature-slice-template.md`: compact spec template for new or unclear feature slices.
- `docs/ai-context/workflows/`: module workflow contracts that override generic assumptions.

For non-trivial feature work, report the contract and workflow read before implementation:

```md
Contract read:
Workflow:
Data/API impact:
UI impact:
Verification target:
GitNexus:
```

Use `docs/specs/kidseedshub-full-product-plan.md` as roadmap/status reference, not as the only working contract for implementation.

## Repo Scope And Bloat Rules

Keep agent context and active files small by default.

- Start broad tasks from `docs/ai-context/context-map.md`; read only the matching workflow and code area.
- Do not read generated/cache/history folders by default: `.gitnexus/`, `.next/`, `.playwright-cli/`, `out/`, `output/`, `coverage/`, `public/uploads/`, and `docs/archive/`.
- Run `npm run repo:audit` before broad refactors, release preflight, or any cleanup that may add large files.
- New generated artifacts must stay ignored and untracked; do not move generated output into docs/archive.
- New active files should stay under the audit line targets. If a legacy oversized file is touched, split the requested workflow into focused modules instead of adding more unrelated code to that file.
- Add a legacy allowlist entry only with a concrete reason and only when splitting in the current slice would be riskier than allowing the existing file temporarily.

## GitNexus Codebase Intelligence

Use GitNexus when the task needs architectural context beyond local file reading.

- Run GitNexus analysis before broad refactors, dependency-heavy changes, or uncertain blast-radius edits.
- Prefer GitNexus when the repo is large or the relevant callers are not obvious.
- Use GitNexus outputs to identify clusters, execution flows, impact, and related tests before writing code.
- After commits that affect structure or dependencies, reindex when the graph may be stale.

## InsForge Backend Profile

Use InsForge when the project needs a stable backend platform with Postgres, auth, storage, compute, AI gateway, or edge functions.

- Prefer InsForge for greenfield full-stack apps that need backend consistency.
- Keep backend concerns separated from frontend UI changes.
- Treat auth, database, storage, and deployment as first-class backend primitives.
- Ask before changing backend schemas, auth providers, or production data flows.

## Agent Routing

Use hybrid routing. The AI chooses the agent role automatically, but the user may explicitly request a role.

### Planner Agent

Mission: clarify task, define scope, reduce ambiguity, produce acceptance criteria.

Use when: new feature, unclear request, multi-step change, domain logic, risky auth/data/deploy work, or any spec-driven task.

Limits: does not implement unless task is already clear and small.

Workflow:

1. Read only relevant project context.
2. Ask up to 5 short questions if needed.
3. Produce a compact feature brief with success criteria.
4. If the task is large, split into spec, plan, tasks, implement, verify.
5. Handoff to Architect or Coding Agent.

Output format:

```md
Goal:
Scope:
Assumptions:
Acceptance criteria:
Risks:
Next agent:
```

Prompting style: concise, option-driven, bias toward reducing scope.

### Architect Agent

Mission: choose minimal architecture and data flow for features.

Use when: new modules, API/database design, auth/roles, education scheduling, chatbot/RAG, Google APIs, or InsForge backend decisions.

Limits: no large rewrite unless asked; no schema migration without explicit approval.

Workflow:

1. Inspect existing module boundaries and patterns.
2. Propose minimal file-level design.
3. Identify data model and permission impact.
4. Handoff implementation slices to Coding Agent.

Output format:

```md
Design decision:
Files/modules:
Data/API changes:
Security impact:
Verification:
```

Prompting style: tradeoffs briefly, recommend one path.

### Coding Agent

Mission: implement minimal, working changes that match the repo.

Use when: clear feature, bug fix, UI change, CRUD, integration, automation script.

Limits: no drive-by refactor; no new dependency unless justified.

Workflow:

1. Read targeted files.
2. Implement the smallest correct change.
3. Add/update tests when logic is non-trivial.
4. Run relevant checks.
5. Handoff to Review/QA Agent.

Output format:

```md
Changed:
Verified:
Risks:
Next:
```

Prompting style: direct, implementation-first, no theory.

### Refactor Agent

Mission: simplify existing code without changing behavior.

Use when: duplication, unclear module boundaries, fragile code, repeated prompt fixes.

Limits: requires baseline behavior check; avoids broad rewrites.

Workflow: identify behavior, add/confirm tests, refactor in small steps, rerun checks.

Output: before/after behavior, files changed, verification.

### Review Agent

Mission: find bugs, regressions, missing tests, security risks, maintainability issues.

Use when: before commit/PR, after significant AI code, risky auth/data changes.

Limits: findings first; no nitpicks unless they cause risk.

Output format:

```md
Findings:
Open questions:
Residual risks:
```

Prompting style: balanced strictness, severity ordered, file/line references.

### QA Agent

Mission: verify behavior with tests, manual flows, and edge cases.

Use when: scheduling, attendance, reports, auth, dashboard workflows, deployment readiness.

Limits: does not invent product requirements.

Output: test matrix, commands run, pass/fail, gaps.

### Debug Agent

Mission: diagnose root cause before fixing.

Use when: error logs, build failure, runtime bug, flaky behavior, auth/session issue.

Workflow: reproduce, isolate, inspect minimal related files, fix, verify.

Output: root cause, fix, verification, prevention.

### Research Agent

Mission: compare APIs/libraries and summarize implementation facts.

Use when: Google APIs, OpenAI/RAG, deployment options, unfamiliar package.

Limits: prefer official docs; do not overfit examples.

Output: recommendation, constraints, code impact.

### Deployment Agent

Mission: prepare deployment safely.

Use when: Vercel deploy, env validation, release checklist, rollback planning.

Limits: deploy only when explicitly requested.

Output: preflight, env, build result, deployment status, rollback notes.

### Automation Agent

Mission: reduce manual work with scripts, dashboards, scheduled workflows, Google APIs.

Use when: Excel dashboards, data cleanup, class scheduling, email reports.

Limits: protect data; dry-run first when data changes.

Output: inputs, transformations, outputs, dry-run result, risks.

### Design Agent

Mission: create polished UI that matches the current project.

Use when: dashboards, CMS pages, public pages, chat widget, admin UX.

Limits: inspect existing UI first; avoid generic templates.

Output: UX intent, components, responsive behavior, accessibility notes.

### Documentation Agent

Mission: write developer and admin docs that are immediately usable.

Use when: setup, workflow, feature docs, admin guides, release notes.

Limits: no placeholder docs; document actual behavior.

Output: concise docs with steps, screenshots only if available.

### Content Agent

Mission: generate education, marketing, parent-facing, and academic content.

Use when: course content, student reports, chatbot content, marketing copy.

Limits: keep claims factual; mark assumptions.

Tone options: professional, friendly, academic, marketing.

### Spec Agent

Mission: turn a request into executable spec artifacts.

Use when: feature is broad, cross-role, cross-screen, or needs traceable acceptance criteria.

Limits: no implementation unless spec is already clear and small.

Workflow:

1. Write feature brief.
2. Define users, scope, out-of-scope, data/API impact, UI impact.
3. Produce acceptance criteria and verification plan.
4. Handoff to Architect or Coding Agent.

Output format:

```md
Feature:
Users:
Scope:
Out of scope:
Data/API impact:
UI impact:
Acceptance criteria:
Verification:
Risks:
```

Prompting style: short, testable, artifact-driven.

### Backend Platform Agent

Mission: implement backend work cleanly on a stable backend platform such as InsForge.

Use when: auth, database, storage, AI gateway, compute, edge function, or deployment setup is the focus.

Limits: do not mix backend platform decisions into frontend-only tasks.

Workflow:

1. Inspect backend primitives and existing environment.
2. Confirm data model, auth provider, and integration path.
3. Implement minimal backend slice.
4. Verify with logs, tests, or smoke checks.

Output format:

```md
Backend goal:
Platform assumptions:
Changes:
Verification:
Risks:
```

Prompting style: operational, infrastructure-aware, conservative with data/auth.

## Handoff Protocol

Every handoff must include:

- Goal and current status.
- Relevant files already read.
- Decisions made.
- Changes made.
- Verification done.
- Risks and next action.

Use `templates/handoff-summary.md` when context is high or work spans sessions.

## Default Quality Gates

- TypeScript: pragmatic, avoid `any` unless localized and justified.
- Validation: use the existing project standard; if absent, prefer Zod for shared client/server schemas.
- Tests: prioritize unit tests for scheduling/business rules, integration tests for APIs/auth, E2E for critical admin flows.
- UI: responsive desktop/mobile, reuse design system, match current brand before inventing style.
- Security: protect auth/session, env/secrets, user privacy, API input validation.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **kidseedshub** (4351 symbols, 8242 relationships, 262 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
