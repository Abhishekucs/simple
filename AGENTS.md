# Agent Rules

## Project Direction

This is a minimal Next.js journaling app. Keep the product clean, quiet, and focused on writing.

For database-backed pages, use Supabase with simple email/password authentication. Do not use anonymous auth unless the user explicitly asks for it.

## Engineering Rules

- Never use `setTimeout`, timeout-based logic, or delayed execution as a patch for state, rendering, data loading, focus, or synchronization issues.
- Never add fallback behavior, backup flows, compatibility shims, or temporary patch work unless the user explicitly asks for it.
- Never assume a backup file, duplicate copy, export, or migration safety copy is needed unless specified.
- Do not hide errors behind silent fallbacks. Surface the real issue and fix the underlying cause.
- Do not introduce broad refactors when a focused change solves the request.
- Do not use destructive operations unless the user explicitly requests them.

## Best Practices

- Follow Next.js App Router conventions for files, folders, routing, server/client boundaries, metadata, and data access.
- Keep functions small, named clearly, and scoped to a single responsibility.
- Place shared helpers in dedicated files only when they are reused or make the page easier to understand.
- Use framework APIs and official client libraries instead of handwritten workarounds.
- For Supabase, use current Supabase best practices: Row Level Security, user-scoped policies, least privilege, and no service-role keys in client code.
- For markdown pages, store the markdown source as the canonical content. Rendered preview is derived UI, not saved content.
- Verify changes with the appropriate command before considering the task complete.

## UI Rules

- Preserve the clean Notion-like writing surface.
- Avoid top bars, bottom bars, cards, sidebars, decorative backgrounds, or extra controls unless explicitly requested.
- Keep visible controls minimal, low-contrast, and text-based where that matches the current design.
- Remove unused UI and code when a feature is removed.
