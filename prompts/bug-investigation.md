# Prompt: Bug Investigation

```md
Act as Debug Agent.

Bug: {bug}
Error/logs: {logs}
Expected: {expected}
Actual: {actual}

Workflow:
1. Reproduce or identify why reproduction is not possible.
2. Search/read only relevant files.
3. Identify root cause before editing.
4. Fix minimally.
5. Run the most relevant verification.

Output: symptom, root cause, fix, verification, remaining risk.
```
