<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Platform UI Constitution

Before editing customer portal, customer intake, or platform admin UI, read and follow `docs/platform/PLATFORM_UI_CONSTITUTION.md`.

The platform must feel like one product. Shared customer intake flows must reuse the same shell, loading, top navigation, completion, and exit patterns unless there is a documented reason not to. Admin UI must keep button state contrast readable across default, hover, active, active-hover, disabled, and focus-visible states.

## Team / Agent Operating Model

Before planning or delegating platform work, read `docs/platform/PLATFORM_STRATEGY.md`, `docs/platform/PLATFORM_TASKS.md`, `docs/platform/DEVELOPMENT_STRATEGY.md`, and `docs/platform/TEAM_AGENT_OPERATING_MODEL.md`.

Use Codex as the coordinating PM/tech lead. Use subagents for scoped research, implementation, review, and red-team checks when the work can be split safely. Keep `docs/platform/PLATFORM_STRATEGY.md` as the product north star and `docs/platform/PLATFORM_TASKS.md` as the execution order.

## Munjanggun Brand Source

Before creating or editing Munjanggun brand, content, blog, design, video, automation, or QA work, read the central brand source first:

- `C:\Users\hjh\안티그래비티\문장군_브랜드\BRAND_CONTEXT.md`
- `C:\Users\hjh\안티그래비티\문장군_브랜드\FIELD_JUDGMENT_RULES.md`
- `C:\Users\hjh\안티그래비티\문장군_브랜드\DESIGN.md`
- `C:\Users\hjh\안티그래비티\문장군_브랜드\PROJECT_ADAPTERS.md`
- `C:\Users\hjh\안티그래비티\문장군_브랜드\CHANGELOG.md`

Then read this project's brand bridge:

- `docs/brand/BRAND_SOURCE.md`
- `docs/brand/PROJECT_BRAND_ADAPTER.md`

Treat `docs/platform/BRAND_CONTEXT.md` as legacy project context, not the primary brand source. Do not place customer names, phone numbers, detailed addresses, AppSheet raw records, consultation transcripts, Naver admin raw exports, original field photos, private revenue/account data, tokens, cookies, or other secrets in central or project brand documents. Use de-identified summaries or evidence references instead.
