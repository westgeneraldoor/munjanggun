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

V2 should make the default experience feel like writing a post:

```text
Write the article
Add photos where needed
Check SEO/AEO when ready
Run publish QA at the end
```

## UX Principle

The editor should show the user's current job first.

```text
Default: writing canvas
Secondary: photos, SEO/AEO, publish QA
Hidden by default: events, internal gate details, system diagnostics
```

Do not expose internal implementation language such as private bucket, approved media, blog_media, object path, or usage_status in the editor UI.

## Proposed Modes

### 1. Write

Primary mode. This is the default screen.

Visible:

- Title
- Slug
- Category
- Excerpt
- Summary answer
- Body blocks
- Inline image cards
- Add block toolbar

Actions:

- Add paragraph
- Add image
- Add Q&A
- Add CTA
- Save
- Preview

Avoid:

- Full SEO form
- Full publish gate
- Event log
- Media database status

### 2. Photos

Focused photo mode for the current post.

Visible:

- Photos used in the article
- Cover photo selection
- Alt text
- Caption
- Replace photo
- Remove from article
- Add from photo library
- Upload inside picker

Important:

- The list must show only photos actually inserted into the article body.
- Each photo should show where it appears in the body, or provide a jump-to-block action.

### 3. SEO/AEO

Search and AI-answer readiness mode.

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
- Last fact checked at
- AI citation ready

Principle:

SEO/AEO helps the article after the draft is readable. It should not dominate the first writing view.

### 4. Publish QA

Final gate mode.

Visible:

- Required fields checklist
- CTA check
- Image block connection check
- Alt text check
- Fact-check timestamp
- Forbidden expression status
- Preview link
- Publish button
- Published lock state

Secondary:

- Recent events can live here as a collapsed activity section.

## Desktop Layout

Recommended desktop structure:

```text
Top bar:
Back / Status / Save / Preview / Publish

Mode tabs:
Write | Photos | SEO/AEO | Publish QA

Main area:
Mode-specific content

Optional compact side rail:
Only the most important unresolved publish issues
```

Do not recreate the current three-column dense layout inside every tab.

## Mobile Layout

Mobile must be single-column.

```text
Top bar
Mode tabs as horizontal segmented control
Current mode content
Sticky bottom primary action only when useful
```

390px horizontal overflow is a failure.

## Risks

- Publish gate data can become stale if local edits are not saved before checking. V2 needs clear save/revalidate behavior.
- Moving photos to a separate mode can hide where a photo appears. Add block position or jump-to-block affordance.
- Inline photo upload must refresh the picker without sending the user away from the draft.
- SEO/AEO cannot be so hidden that required publish data is forgotten. The Publish QA tab should point to the missing mode/field.

## PR Recommendation

```text
PR-11: Blog Editor UX V2 design document and acceptance criteria
PR-12: Blog Editor UX V2 shell and mode tabs
PR-13: Write mode simplification
PR-14: Photos mode refinement
PR-15: SEO/AEO and Publish QA split
```

The next implementation PR should start with the shell and mode tabs, not with visual polish.
