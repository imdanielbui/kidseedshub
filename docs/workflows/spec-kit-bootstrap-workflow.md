# Spec Kit Bootstrap Workflow

Use this workflow when starting a new feature or a new repo with spec-driven development.

## 1. Install or enable

- Install `spec-kit` using the project-supported integration for your agent.
- Verify the agent can load spec commands or skills.
- Confirm the workspace has `AGENTS.md`, `CLAUDE.md`, and project rules loaded.

## 2. Create governing principles

- Write the project constitution first.
- Keep principles short and actionable.
- Include code quality, testing, UX consistency, and performance.

## 3. Create the spec

- Define what the product does and why.
- Focus on users, scope, out-of-scope, and success criteria.
- Do not choose implementation details yet.

## 4. Plan the implementation

- Map the tech stack and architecture choices.
- Keep the plan file short enough to be executable.
- Highlight data, auth, UI, integrations, and verification.

## 5. Break into tasks

- Convert the plan into small tasks.
- Each task should be implementable in one slice.
- Add verification to each task where possible.

## 6. Implement and verify

- Implement one slice at a time.
- Run lint, tests, and build when available.
- Compare implementation against acceptance criteria.
