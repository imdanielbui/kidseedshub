# Skill: Prompt Engineering

Use for reusable prompts for Codex, Claude Code, Cursor, chatbot, content generation, and customer workflows.

## Workflow

1. Define the user, goal, input data, constraints, and expected output.
2. Remove vague instructions and duplicated context.
3. Add examples only if they reduce ambiguity.
4. Add stop conditions and quality checks.
5. Store reusable prompts under `prompts/`.

## Output

```md
Prompt name:
Use case:
Inputs:
Prompt:
Output format:
Quality checks:
```

## Rules

- Prefer short prompts with explicit output format.
- Avoid asking AI to “be creative” without constraints.
- Use reusable variables like `{goal}`, `{audience}`, `{source_data}`.
