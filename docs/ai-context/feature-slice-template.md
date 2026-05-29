# Feature Slice Template

Use this template for any new feature, cross-screen workflow, or unclear change. Keep it short enough to fit in a handoff.

```md
Feature:

User:

Problem:

Scope:

Out of scope:

Workflow:
1.
2.
3.

Data/API impact:

Permission/privacy impact:

UI impact:

States:
- Loading:
- Empty:
- Error:
- Unauthorized:
- Submitting/success:

Acceptance criteria:
- Given ...
- When ...
- Then ...

Verification:
- Backend/API:
- UI/manual:
- Role/privacy:

Risks:

Files likely involved:
```

Do not implement a data feature until `Workflow`, `Data/API impact`, and `Verification` are specific enough to test.
