# Automation Workflow

Use this workflow for Excel dashboards, Google APIs, data cleanup, email reports, and internal scripts.

## Steps

1. Define input source, output target, and owner.
2. Validate and normalize data before transformation.
3. Add dry-run mode for data-changing workflows.
4. Log counts: input, valid, skipped, changed, exported.
5. Protect credentials and secrets.
6. Make the process idempotent when possible.
7. Produce an operations note for repeated usage.

## Quality Bar

- No credentials committed.
- Invalid rows are reported, not silently dropped.
- Exports have stable columns and clear sheet names.
- Automation can be rerun safely or explains why not.
