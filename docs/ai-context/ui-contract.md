# UI Contract

The UI should feel like one internal operations system: dense, calm, responsive, and consistent. Do not invent a new visual language for a single feature.

## Layout

- Dashboard pages live inside `AppShell`.
- Prefer compact operational layouts over marketing-style sections.
- Use existing brand classes and neumorphic helpers from `app/globals.css`.
- Keep page sections unframed unless the existing screen uses panels for grouped tools.
- Do not add nested cards or decorative background effects.
- Mobile must support the main task without horizontal overflow.

## Dialogs

- Use `DialogShell` for read/detail dialogs.
- Use `DialogFormShell` for create/edit forms.
- Do not hand-roll fixed overlays, modal panels, or close buttons unless updating the shared dialog component itself.
- Dialog header should include a clear title and optional short description.
- Dialog body must scroll inside the panel when content is long.
- Destructive or irreversible actions need an explicit confirm dialog and a clear cancel path.

## Forms

- Form footer pattern:
  - Secondary/cancel action on the left or visually lower priority.
  - Primary submit action on the right.
  - Disable submit while submitting.
  - Show inline validation or actionable error text.
- Inputs must use labels that match the business field, not database jargon.
- Money, dates, sessions, scores, and percentages need formatting/parsing consistent with existing screens.
- After successful submit, refresh the source data and close the dialog only when the saved state is visible.

## Lists, Tables, And Database Views

- Keep high-density admin screens scannable.
- Preserve existing search, filter, sort, pagination, hide/reorder fields, and status chips when present.
- Empty states should say what is missing and expose the next valid action when applicable.
- Error states should allow retry or explain what staff can do next.
- Row actions should be near the row and use icons where the meaning is established.

## Buttons And Icons

- Use `lucide-react` icons for tool actions when available.
- Use icon-only buttons for common compact actions with accessible labels.
- Text buttons are for commands that need clear wording.
- Do not use a new color to imply status if an existing status color/pattern exists.

## Accessibility And State

- Dialogs need `role="dialog"`, `aria-modal`, and title association through the shared shell.
- Icon-only buttons need `aria-label` or `title` where appropriate.
- Loading, submitting, empty, unauthorized, and error states are part of the UI, not optional polish.
