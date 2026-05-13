# Skill: GitNexus Codebase Intelligence

Use for repo exploration, blast radius analysis, module discovery, and safer refactors.

## Workflow

1. Index or refresh the repo in GitNexus.
2. Inspect clusters, processes, and impact before editing.
3. Use targeted graph queries for callers, dependencies, and related tests.
4. Reindex after structural commits when the graph may be stale.

## Output

```md
Repo context:
Clusters:
Processes:
Impact:
Relevant files:
Recommended next step:
```

## Rules

- Prefer graph context over guessing call chains.
- Use before broad refactors or dependency-heavy changes.
- Keep the output short and action-oriented.
