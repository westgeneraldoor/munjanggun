<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Platform UI Constitution

Before editing customer portal, customer intake, or platform admin UI, read and follow `docs/platform/PLATFORM_UI_CONSTITUTION.md`.

The platform must feel like one product. Shared customer intake flows must reuse the same shell, loading, top navigation, completion, and exit patterns unless there is a documented reason not to. Admin UI must keep button state contrast readable across default, hover, active, active-hover, disabled, and focus-visible states.
