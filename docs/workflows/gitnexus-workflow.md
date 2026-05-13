# GitNexus Workflow

Use GitNexus when the repo is large, the dependency chain is unclear, or the change may have broad impact.

## Steps

1. Index or refresh the repository in GitNexus.
2. Read the repo context, clusters, and processes.
3. Check impact before editing.
4. Use targeted file reads only for the files the graph points to.
5. Reindex after commits that change structure or dependencies.

## Good Fit

- Refactors.
- Debugging dependency chains.
- Understanding unfamiliar repos.
- Multi-file changes with risk of blast radius.
