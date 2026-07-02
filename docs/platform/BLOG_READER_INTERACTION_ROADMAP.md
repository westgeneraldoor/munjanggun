---
document_type: "Blog Reader Interaction Roadmap"
version: "1.0.0"
status: "active-draft"
created: "2026-07-01"
owner: "Codex PM"
related:
  - "docs/platform/PLATFORM_STRATEGY.md"
  - "docs/platform/PLATFORM_TASKS.md"
  - "docs/platform/PLATFORM_UI_CONSTITUTION.md"
  - "docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md"
  - "docs/brand/BRAND_SOURCE.md"
  - "docs/brand/PROJECT_BRAND_ADAPTER.md"
---

# BLOG_READER_INTERACTION_ROADMAP

## 0. Goal

Blog reader interactions should help a customer keep moving through the Munjanggun journey:

1. Read a practical article.
2. Mark that it helped.
3. Save it for later.
4. Ask a private question without exposing personal details.
5. Request free measurement when ready.
6. Find those actions again in My Page.

This is not a public community or open comment board. Questions start private and may become public content only after admin review, de-identification, and editorial approval.

## 1. Product Rules

- Public comments are not the first version.
- Blog actions must not collect phone numbers, detailed addresses, customer names, raw consultation text, or site photos inside the article UI.
- Personal information belongs in the existing authenticated consultation/intake flow.
- Public counts should support confidence, not make the page feel like a social network.
- Logged-in customer history belongs in `/portal`, not a separate My Page route unless the platform navigation changes.
- Admin-published Q&A should reuse the Content OS article/body-block model instead of exposing raw customer conversation.

## 2. PR Sequence

### PR-A: Mobile Top Reading Navigation

Status: implemented in `codex/blog-mobile-reading-nav`.

Scope:

- Add a mobile-only compact top bar on public blog article pages.
- Hide at the top and while scrolling down.
- Reveal when the reader scrolls upward.
- Provide quick actions: back to blog list, blog home, My Page.
- Keep desktop article layout unchanged.
- Do not add database, auth, counts, or forms.

Done when:

- 390px mobile has no horizontal overflow.
- Touch targets are at least 44px.
- The bar does not cover article text at rest.
- Existing public account menu does not visually collide on mobile article pages.
- Playwright covers mobile reveal behavior and desktop hidden behavior.

### PR-B: Mobile Bottom Action Bar

Scope:

- Add a mobile-only bottom action bar on public blog article pages.
- Primary actions: helpful, save, question, free measurement.
- Keep share inside a small secondary overflow action or reuse the existing article action area.
- Reuse local helpful state as a transitional implementation.
- Save may be local-only for logged-out users in the first version, but the UI copy must make logged-in persistence clear.

Design direction:

- Bottom bar should feel like a reading tool, not a sales banner.
- Free measurement can be the strongest action, but it should not swallow the whole bar.
- Helpful and save need visible pressed states.
- Keep enough bottom safe-area padding for mobile browsers.

Done when:

- It does not overlap final CTA, browser safe area, or existing article actions.
- It shares state with the existing helpful action.
- It has a clear path to PR-C/PR-D APIs.

### PR-C: Private Question Entry

Scope:

- Add "질문 남기기" as a private article-based question flow.
- Logged-out readers go through login with a useful return path.
- Logged-in readers can submit a short question tied to the article.
- Personal details are not requested in the question box.
- If the question needs address/photo/site details, route the customer to the consultation form.

Suggested backend:

- `platform.blog_article_questions`
- Store `user_id`, `post_id` or `post_slug`, title snapshot, question text, status, timestamps.
- Default status should be private or pending.

Done when:

- RLS allows customers to read only their own questions.
- Admins can review all questions.
- Public article pages do not expose raw submitted questions.
- My Page can later show the customer's own question history.

### PR-D: Real Counts, Saved Articles, My Page Collection

Scope:

- Add DB-backed helpful votes and saved articles.
- Add customer-facing blog collection sections to `/portal`.
- Show saved articles, helpful-marked articles, and article questions in a compact customer-friendly area.

Suggested backend:

- `platform.blog_article_saves`
- `platform.blog_article_helpful_votes`
- `platform.blog_article_questions`

My Page direction:

- Add a section such as "내가 챙겨둔 글".
- Group by "저장한 글", "도움됐어요", "질문한 글".
- Keep operational requests first: measurements, estimates, construction, A/S remain the main portal purpose.
- Blog interactions should help customers resume decisions, not compete with service status.

Done when:

- Counts are deduped per user where auth exists.
- Anonymous/local helpful state does not inflate server counts.
- Aggregate count reads do not expose user rows.
- `/portal` remains readable and uncluttered on mobile.

### PR-E: Approved Q&A Publishing

Scope:

- Build a moderated publishing path from private article questions to public Q&A content.
- Admins can approve, edit, anonymize, and attach a question to an article.
- Approved questions render as article Q&A or related question content.

Rules:

- Never publish raw customer text directly.
- Remove names, phone numbers, addresses, unit numbers, photos, and identifying site details.
- Prefer editorial wording that helps future customers understand the condition.
- This is an AEO content asset, not a public comment thread.

Done when:

- Admin approval is required before public exposure.
- Published Q&A uses Content OS rendering patterns.
- The public page remains focused on practical reading and free measurement, not community discussion.

## 3. Review Checklist

For every PR in this roadmap:

- Read the platform UI constitution before editing customer-facing screens.
- Check 390px mobile for horizontal overflow.
- Keep labels customer-friendly and non-technical.
- Avoid public comment/community language.
- Avoid forbidden claims such as "최저가", "No.1", "100%", or "무조건 가능".
- Do not put secrets or customer personal data in docs, fixtures, tests, or screenshots.
- Run type check, lint, build, and focused Playwright tests.
- Ask for code, design, and QA review before considering the slice complete.
