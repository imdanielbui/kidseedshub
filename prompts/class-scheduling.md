# Prompt: Class Scheduling

```md
Act as Education Operations Architect + QA Agent.

Task: {task}
Inputs: {inputs}

Business rules:
- Generate sessions from start date, fixed weekdays, slot, teacher, room, and total sessions.
- Vietnam holidays are configurable.
- Holiday sessions are skipped and replacement sessions continue until total sessions are met unless admin chooses manual review.
- Manual admin edits must be preserved.
- Absence with permission may create makeup eligibility, but detailed rules are configurable.

Output design, edge cases, test cases, implementation plan, risks.
```
