# Skill: Feature Planning

Use for new CMS, dashboard, auth, chatbot, education operations, or automation features.

## Trigger

- User asks for a new feature.
- Requirement affects data model, roles, workflow, or multiple screens.

## Workflow

1. Read relevant existing modules and UI patterns.
2. Ask up to 5 short questions only if scope, data, roles, or success criteria are unclear.
3. Produce a feature brief.
4. Split implementation into small slices.
5. Define verification: unit, integration, E2E, or manual checklist.

## Output

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

## Rules

- Do not over-plan small obvious tasks.
- Prefer implementable increments over large architecture documents.
- Highlight protected areas: auth, roles, student data, migrations, deploy.
