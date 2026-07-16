---
document_type: "Blog Editor UX V2 Plan"
status: "draft"
created: "2026-06-25"
owner: "Codex PM"
related:
  - docs/platform/CONTENT_OS_ADMIN_UX.md
  - docs/platform/CONTENT_ASSET_LIBRARY_ADMIN_UX.md
---

# Blog Editor UX V2

## Why

The current blog editor is functionally complete, but it still feels like a database operation screen. Writing, photo management, SEO/AEO, publish checks, and event history are all visible at once. That makes the editor powerful, but tiring.

V2 should make the default experience feel like finishing one article:

```text
Write the article in the main canvas
Add photos directly where the paragraph needs them
Watch a quick mobile preview while writing
Open SEO/AEO only when needed
Use the publish gate as a jump-to-fix checklist
```

## UX Principle

The editor should show the user's current job first.

```text
Default: writing canvas + compact publish gate
Right assistant panel: mobile preview by default, SEO/AEO as a secondary tab
Hidden by default: events, internal diagnostics, implementation details
```

Do not expose internal implementation language such as private bucket, approved media, blog_media, object path, or usage_status in the editor UI.

## Editor Workbench

### Main Writing Canvas

The writing canvas is always the primary surface. The operator should not need to open a separate photo or publish tab to finish a post.

Visible:

- Draft status
- Title
- Slug
- Category
- Excerpt
- Summary answer
- Compact publish gate chips
- Body blocks
- Inline image cards
- Add block toolbar

Actions:

- Add paragraph
- Add image above a paragraph
- Add image from the block toolbar
- Add Q&A
- Add CTA
- Save
- Preview

Avoid:

- Full SEO form
- Full publish checklist panel
- Event log
- Media database status

### Photo Handling

Photos are not a top-level editor tab. Photos belong inside the article flow.

Required behavior:

- A paragraph can insert a photo above itself.
- Image blocks display as article image cards, not media records.
- Image cards allow replace, remove, alt text, and caption editing in place.
- The photo library picker can upload or select photos without sending the operator away from the draft.
- There is no Photos tab unless a future workflow proves a separate photo review surface is truly needed.

### Right Assistant Panel

The right panel supports the writing canvas instead of competing with it.

Default tab:

- Mobile preview
- Uses the current unsaved editor state when possible
- Helps the operator feel the article as a public mobile reader would see it

Secondary tab:

- SEO/AEO
- Search fields and AI-answer-oriented fields
- Only opened when needed or when a gate chip jumps to a missing SEO field

### SEO/AEO

SEO/AEO is a right-panel assistant tab, not a primary editor mode.

Visible:

- SEO title
- Meta description
- Canonical URL
- Primary keyword
- Target question
- Summary answer
- Related questions
- Service area
- Product type

Principle:

SEO/AEO helps the article after the draft is readable. It should not dominate the first writing view.

Do not show internal readiness checkboxes such as "AI citation ready" to operators. The system may keep the field internally, but the UI should not ask the operator to reason about it.

### Publish Gate

Publish QA is a compact gate inside the writing canvas, not a separate tab.

Visible near the top of the writing canvas:

- Title
- Body
- Image
- CTA
- SEO
- Fact check

Required behavior:

- Each item is a clickable chip.
- OK/NG must be visible with text and icon, not color alone.
- Clicking a chip jumps to the relevant field, block, or right-panel SEO field.
- If the issue is missing CTA, jump to the block toolbar or CTA block.
- If the issue is missing image data, jump to the image block.
- If the issue is SEO/AEO, switch the right panel to SEO/AEO and focus the missing field.
- The gate must remain reachable on 390px mobile.

## Desktop Layout

Recommended desktop structure:

```text
Top bar:
Back / Status / Save / Preview / Publish

Main area, about 60-70%:
Writing canvas
Compact publish gate
Basic information
Body blocks

Right assistant panel, about 30-40%:
[Mobile preview] [SEO/AEO]

Collapsed secondary:
Recent activity
```

Do not recreate a dense multi-panel database editor. The operator's eye should land on the article first.

## Mobile Layout

Mobile must be single-column.

```text
Top bar
Compact publish gate chips
Writing canvas
Right assistant content collapses below or behind simple tabs
```

390px horizontal overflow is a failure.

## Risks

- Publish gate data can become stale if local edits are not saved before checking. V2 needs clear save/revalidate behavior.
- Keeping photos inside the writing flow can make image metadata easy to miss. Image cards must expose alt/caption without looking like database records.
- Inline photo upload must refresh the picker without sending the user away from the draft.
- SEO/AEO cannot be so hidden that required publish data is forgotten. The publish gate must jump to the right-panel SEO/AEO field.
- The live mobile preview should be clearly understood as a quick preview. The full preview route remains the source of truth for final visual review.

## PR Recommendation

```text
PR-11: Blog Editor UX V2 shell
PR-12: Write mode canvas refinement
PR-13: Insert photos above paragraphs
PR-14: Workbench layout, gate chips, right preview/SEO panel
PR-15/PR-19: Body component expansion such as link button, notice box, checklist
```

Do not add link buttons, notice boxes, checklists, before/after blocks, or comparison tables in PR-14. Body component expansion should come after the editor workbench is stable.

PR-19 implementation note:

- The first expansion adds `link_button` and `guide_box`.
- `link_button` uses a customer-facing label and an internal public path only.
- `guide_box` covers calm guidance, notice, field-condition, and caution tones without adding separate caution/condition enum values.
- Rich structured blocks such as checklist, before/after, and comparison table remain separate PRs because they need additional editor and responsive rendering rules.
