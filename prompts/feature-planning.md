# Prompt: Feature Planning

Use this to plan a feature without wasting context.

```md
Act as Planner + Architect for this repo.

Goal: {goal}
Users: {users}
Known constraints: {constraints}

Rules:
- Read only targeted files needed to understand existing patterns.
- Ask up to 5 short questions only if ambiguity blocks safe implementation.
- Prefer minimal implementation slices.
- Flag auth, roles, student/parent data, migrations, and deploy risk.

Output:
Feature brief, acceptance criteria, file-level plan, verification plan, risks.
```
