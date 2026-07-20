---
document_type: "Content OS Operation Checklist"
version: "1.0.0"
status: "ops-ready-draft"
created: "2026-06-25"
updated: "2026-07-20"
owner: "Codex PM"
source_prd: "docs/platform/CONTENT_OS_PRD.md"
source_schema: "docs/platform/CONTENT_OS_SCHEMA.md"
source_admin_ux: "docs/platform/CONTENT_OS_ADMIN_UX.md"
source_seo_aeo_spec: "docs/platform/CONTENT_OS_SEO_AEO_SPEC.md"
related_pr: "PR-03 / codex/content-os-mvp"
related_operating_routine:
  - "docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md"
  - "docs/platform/BLOG_FIRST_10_TOPICS.md"
---

# CONTENT_OS_OPERATION_CHECKLIST - OPS-01

## 0. Purpose

This checklist is the pre-production rehearsal plan for MVP-CONTENTOS-01.

The Content OS implementation is not treated as ready for real operation until this checklist is completed against the target Supabase project and deployment URL.

The goal is to confirm the full loop:

```text
admin content queue
-> block editor
-> private media candidate
-> media approval
-> preview
-> publish server action
-> public publish promotion (static WebP or original GIF)
-> /blog and /blog/[slug]
-> sitemap / robots / metadata / JSON-LD
```

## 1. Scope

Included:

- Remote storage policy confirmation.
- One real sample article publish rehearsal.
- Public/private media exposure checks.
- sitemap, robots, metadata, and JSON-LD checks.
- Manual Search Console and structured data validation checklist.
- Rollback steps.

Excluded:

- New feature development.
- DB schema changes.
- Publish logic changes.
- Admin AI draft generation is not a product feature; the CMS starts from an approved external manuscript.
- Search Console API automation.

## 2. Initial Verification Status (historical)

This section preserves the initial 2026-06-25 Codex session result. Its temporary remote-confirmation limitation was resolved by the later evidence in 2.1 and 13.

- `npm run lint`: passed with existing non-Content-OS admin warnings.
- `npm run build`: passed.
- `git diff --check`: passed with CRLF warnings only.
- Local Playwright/Supabase publish rehearsal passed and test data was cleaned up.
- Local `supabase` CLI was not installed.
- `npx supabase --version` failed with a transient npm network `ECONNRESET`.
- Service-role REST access to the `storage` schema was blocked because only `public`, `colorbook`, `showroom`, and `platform` schemas are exposed through the Data API.

Historical conclusion at that time:

```text
storage.objects policy remote application is not confirmed from this Codex session.
Confirm it with a DB owner or linked Supabase CLI before production publishing.
```

## 2.1 HARDEN-00 Remote Storage Policy Result

Status as of 2026-06-25:

```text
Supabase project: munjanggun-apt
Project ref: cebafroyvmllbyivevjd
Applied by: Supabase MCP execute_sql
Scope: storage.objects policies for Content OS media buckets only
Result: passed
```

Applied policies:

```text
blog_media_public_select
blog_media_admin_insert_public
blog_media_admin_delete_public
blog_media_private_admin_select
blog_media_private_admin_insert
blog_media_private_admin_delete
```

Verified `pg_policies` result:

- All 6 expected policies exist on `storage.objects`.
- `blog_media_public_select` is `SELECT TO anon` with `bucket_id = 'blog-media'`.
- `blog_media_admin_insert_public` is `INSERT TO authenticated` with `bucket_id = 'blog-media'` and `platform_private.is_admin()`.
- `blog_media_admin_delete_public` is `DELETE TO authenticated` with `bucket_id = 'blog-media'` and `platform_private.is_admin()`.
- `blog_media_private_admin_select` is `SELECT TO authenticated` with `bucket_id = 'blog-media-private'` and `platform_private.is_admin()`.
- `blog_media_private_admin_insert` is `INSERT TO authenticated` with `bucket_id = 'blog-media-private'` and `platform_private.is_admin()`.
- `blog_media_private_admin_delete` is `DELETE TO authenticated` with `bucket_id = 'blog-media-private'` and `platform_private.is_admin()`.
- No Content OS `UPDATE` policy exists for `blog-media` or `blog-media-private`.

Behavior verification:

- anon upload to `blog-media-private`: blocked by RLS.
- anon upload to `blog-media`: blocked by RLS.
- authenticated administrator upload to `blog-media-private`: passed.
- authenticated administrator signed URL for `blog-media-private`: passed.
- authenticated administrator download from `blog-media-private`: passed.
- direct public URL for `blog-media-private`: blocked with non-200 response.
- authenticated administrator upload to `blog-media`: passed.
- public URL for `blog-media`: returned HTTP 200.
- anon download from `blog-media`: passed.
- authenticated administrator upsert/overwrite attempt on existing `blog-media` object: blocked by RLS.
- authenticated administrator delete from both Content OS buckets: passed.

Publish rehearsal after HARDEN-00:

- One temporary ready post was created.
- One approved private media object was attached.
- Admin publish action succeeded.
- Approved private media was promoted to `blog-media` as WebP.
- `blog_posts.status` became `published`.
- `blog_media.usage_status` became `published`.
- A `published` event was recorded.
- Public `/blog/[slug]` rendered successfully.
- Public HTML did not include `source_prompt`, `source_evidence`, `brand_check_result`, `blog-media-private`, or the private object path.
- 390px mobile overflow check passed.
- Temporary post, media rows, events, blocks, and storage objects were cleaned up.

Operational decision:

```text
Content OS MVP storage policy: go
Content OS internal operation test: go
Real sample content publishing: go after operator sign-off
Remaining hardening: HARDEN-01 admin preview image proxy is recommended but not blocking
```

## 3. Storage Policy Remote Confirmation

### 3.1 Expected Buckets

Confirm the target Supabase project has these buckets:

```text
blog-media-private
public: false
allowed_mime_types: image/jpeg, image/png, image/webp, image/gif, image/heic, image/heif

blog-media
public: true
allowed_mime_types: image/jpeg, image/png, image/webp, image/gif
```

SQL:

```sql
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('blog-media-private', 'blog-media')
order by id;
```

Pass criteria:

- Both buckets exist.
- `blog-media-private.public = false`.
- `blog-media.public = true`.
- Private bucket accepts HEIC/HEIF.
- Public bucket accepts only web delivery formats.

### 3.2 Expected storage.objects Policies

The draft policy file is:

```text
supabase/storage-policies/content_os_storage_policies.sql
```

Expected policy names:

```text
blog_media_public_select
blog_media_admin_insert_public
blog_media_admin_delete_public
blog_media_private_admin_select
blog_media_private_admin_insert
blog_media_private_admin_delete
```

SQL:

```sql
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'blog_media_public_select',
    'blog_media_admin_insert_public',
    'blog_media_admin_delete_public',
    'blog_media_private_admin_select',
    'blog_media_private_admin_insert',
    'blog_media_private_admin_delete'
  )
order by policyname;
```

Pass criteria:

- All 6 policies exist.
- Public select is limited to `bucket_id = 'blog-media'`.
- Private bucket select/insert/delete require `platform_private.is_admin()`.
- Public bucket insert/delete require `platform_private.is_admin()`.
- No public update/upsert policy exists for `blog-media`.

If policies are missing:

1. Do not publish real articles yet.
2. Apply `supabase/storage-policies/content_os_storage_policies.sql` with a DB owner or linked Supabase CLI context.
3. Re-run the policy query above.
4. Record the date, operator, and project ref in the release notes.

## 4. Sample Article Rehearsal

Use one real but low-risk sample article. Avoid real customer personal data.

Recommended sample:

```text
category: customer_qa or field_knowhow
topic: "중문 시공 전 확인해야 할 현장 조건"
media: 1-2 approved showroom-safe photos
```

### 4.1 Draft Preparation

Checklist:

- [ ] Create or insert one non-published `showroom.blog_posts` row.
- [ ] Set status to `ready` only after required fields are complete.
- [ ] Confirm title is present.
- [ ] Confirm slug is lowercase and hyphenated.
- [ ] Confirm meta description is 50-180 characters.
- [ ] Confirm target question is present.
- [ ] Confirm summary answer is present.
- [ ] Confirm brand check has no blocker or forbidden expression.
- [ ] Add at least one paragraph block.
- [ ] Add at least one CTA block.

### 4.2 Private Media Upload

Checklist:

- [ ] Upload 1-2 images through `/admin/platform/blog/[id]`.
- [ ] Confirm images are stored in `blog-media-private`.
- [ ] Confirm no private bucket path appears in the browser DOM.
- [ ] Fill `alt_text`.
- [ ] Fill `caption` when useful.
- [ ] Check privacy review.
- [ ] Check promotion consent.
- [ ] Mark one image as cover if the article should appear with a thumbnail.
- [ ] Move media to `approved`.

Pass criteria:

- Candidate/approved media has `private_bucket` and `private_object_path`.
- Candidate/approved media does not have `public_bucket`, `public_object_path`, or `public_url`.
- Rejected media is not selectable in preview/public rendering.

### 4.3 Preview

Open:

```text
/admin/platform/blog/[id]/preview
```

Checklist:

- [ ] Administrator can access preview.
- [ ] Customer/non-admin cannot access preview.
- [ ] Preview has noindex/nofollow metadata.
- [ ] Approved private media is shown through a signed URL only.
- [ ] No `private_bucket` or `private_object_path` appears in page source.
- [ ] Rejected media does not render.
- [ ] 390px mobile viewport has no horizontal overflow.

## 5. Publish Rehearsal

From the editor:

```text
/admin/platform/blog/[id]
```

Checklist:

- [ ] Click publish once.
- [ ] Confirm success message.
- [ ] Confirm repeated publish does not create duplicate public objects.
- [ ] Confirm `blog_posts.status = published`.
- [ ] Confirm `blog_posts.published_at` is set.
- [ ] Confirm `blog_posts.published_by` is set.
- [ ] JPG·PNG·WebP는 정적 WebP 파생본으로 승격되고, GIF는 원본 `.gif`와 `image/gif`를 보존하는지 확인한다.
- [ ] Confirm `blog_media.usage_status = published`.
- [ ] Confirm `blog_media.public_bucket = blog-media`.
- [ ] Confirm `blog_media.public_object_path` is set.
- [ ] Confirm `blog_media.public_url` is set.
- [ ] Confirm `blog_post_events` has one `published` event.

SQL:

```sql
select
  id,
  slug,
  status,
  published_at,
  published_by
from showroom.blog_posts
where slug = '<sample-slug>';

select
  id,
  usage_status,
  private_bucket,
  private_object_path,
  public_bucket,
  public_object_path,
  public_url,
  published_at
from showroom.blog_media
where post_id = '<post-id>'
order by created_at;

select
  event_type,
  from_status,
  to_status,
  actor_id,
  created_at
from showroom.blog_post_events
where post_id = '<post-id>'
order by created_at desc;
```

## 6. Public Exposure Checks

Open:

```text
/blog
/blog/[slug]
```

Checklist:

- [ ] `/blog` lists the sample article.
- [ ] `/blog/[slug]` renders the article.
- [ ] Unpublished slugs return 404.
- [ ] Public page uses only `published` post data.
- [ ] Public page uses only `published` media.
- [ ] Public HTML does not include `source_prompt`.
- [ ] Public HTML does not include `source_evidence`.
- [ ] Public HTML does not include `brand_check_result`.
- [ ] Public HTML does not include `blog-media-private`.
- [ ] Public HTML does not include private object paths.
- [ ] Cover image uses the validated public WebP derivative or approved original GIF URL.
- [ ] 390px mobile viewport has no horizontal overflow.

Recommended command:

```bash
curl -s https://<deployment-domain>/blog/<sample-slug> | grep -E "source_prompt|source_evidence|brand_check_result|blog-media-private"
```

Pass criteria:

```text
No output.
```

## 7. SEO / AEO Checks

### 7.1 Metadata

Check page source for:

- [ ] `<title>` uses `seo_title` or title fallback.
- [ ] meta description is present.
- [ ] canonical URL points to production `/blog/[slug]`.
- [ ] Open Graph type is article.
- [ ] Open Graph title and description match the article.
- [ ] Open Graph image points to public media only.

### 7.2 JSON-LD

Check page source:

- [ ] `<script type="application/ld+json">` exists.
- [ ] `BlogPosting` exists.
- [ ] `BreadcrumbList` exists.
- [ ] JSON-LD does not include private paths.
- [ ] JSON-LD does not include hidden review/internal data.
- [ ] `<` characters are escaped as `\u003c`.
- [ ] No FAQ rich-result guarantee language is present.

Manual validators:

- [ ] Google Rich Results Test.
- [ ] Schema Markup Validator.

Record:

```text
URL:
Rich Results Test result:
Schema Markup Validator result:
Notes:
```

### 7.3 Sitemap

Open:

```text
/sitemap.xml
```

Checklist:

- [ ] `/` is present.
- [ ] `/blog` is present.
- [ ] Published `/blog/[slug]` is present.
- [ ] Legacy ai_draft/reviewing/ready/archived posts are absent.
- [ ] Admin URLs are absent.
- [ ] Preview URLs are absent.
- [ ] Private URLs are absent.

### 7.4 Robots

Open:

```text
/robots.txt
```

Checklist:

- [ ] `User-agent: *` allows public crawl.
- [ ] `Disallow: /admin/`.
- [ ] `Disallow: /api/`.
- [ ] `Disallow: /preview/`.
- [ ] `Disallow: /drafts/`.
- [ ] `Disallow: /private/`.
- [ ] `OAI-SearchBot` keeps public search crawl open while blocking private/admin paths.
- [ ] `GPTBot` is explicitly blocked with `Disallow: /`.
- [ ] Sitemap URL points to the production domain.

## 8. Search Console

After deploy:

- [ ] Confirm property exists for the production domain.
- [ ] Submit or refresh `/sitemap.xml`.
- [ ] Use URL Inspection for the sample `/blog/[slug]`.
- [ ] Request indexing only after public page and metadata are verified.
- [ ] Record indexing status and crawl result.

Record:

```text
Search Console property:
Sitemap submitted at:
Inspected URL:
Indexing request status:
Notes:
```

For recurring blog publication, use the shorter weekly routine in `docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md`. This checklist remains the full pre-production and sample-publish rehearsal.

## 9. Rollback

### 9.1 Preferred Soft Rollback

Use soft rollback for published content unless there is a severe privacy leak.

SQL:

```sql
update showroom.blog_posts
set
  status = 'archived',
  updated_at = now()
where slug = '<sample-slug>'
  and status = 'published';
```

Then confirm:

- [ ] `/blog/[slug]` returns 404.
- [ ] `/blog` no longer lists the article after revalidation.
- [ ] `/sitemap.xml` no longer includes the article after revalidation.

### 9.2 Emergency Media Rollback

Use only when public media must be removed immediately.

Steps:

1. Archive the post first.
2. Remove public objects from `blog-media`.
3. Revert affected media rows to `approved`.
4. Preserve private original references for audit unless legally required to delete.

SQL template:

```sql
update showroom.blog_media
set
  usage_status = 'approved',
  public_bucket = null,
  public_object_path = null,
  public_url = null,
  published_at = null,
  updated_at = now()
where post_id = '<post-id>'
  and usage_status = 'published';
```

Storage cleanup:

```text
Remove each public object path from bucket blog-media.
Do not remove private original objects unless the privacy incident requires deletion.
```

### 9.3 Audit Event

After rollback, add an event row or operational note:

```sql
insert into showroom.blog_post_events (
  post_id,
  event_type,
  from_status,
  to_status,
  memo,
  metadata
) values (
  '<post-id>',
  'ops_rollback',
  'published',
  'archived',
  '<reason>',
  '{"operator":"<name>","checklist":"OPS-01"}'::jsonb
);
```

## 10. Go / No-Go

Go only when:

- [ ] Storage buckets match expected settings.
- [ ] storage.objects policies are confirmed on remote.
- [ ] Sample publish rehearsal succeeds.
- [ ] Public/private exposure checks pass.
- [ ] Metadata and JSON-LD checks pass.
- [ ] sitemap and robots checks pass.
- [ ] Manual validators are reviewed.
- [ ] Search Console URL inspection has no critical issue.
- [ ] Rollback procedure owner is known.

No-go when:

- [ ] storage.objects policies are missing or unknown.
- [ ] Private bucket paths appear in public HTML.
- [ ] Internal review fields appear in public HTML.
- [ ] Public media lacks alt text.
- [ ] Published media lacks consent confirmation.
- [ ] JSON-LD contains unverifiable hidden claims.
- [ ] Sitemap includes non-published content.

## 11. Sign-Off

```text
Project:
Deployment URL:
Supabase project ref:
Operator:
Date:

Storage policy confirmed: yes / no
Sample article slug:
Published at:
Rollback owner:

Go decision: go / no-go
Notes:
```

## 12. PR-08 Content Asset Library Foundation Verification

Date: 2026-06-25

Project ref: `cebafroyvmllbyivevjd`

Scope:

- Added shared photo library database foundation.
- Added private original and public derivative storage buckets.
- Added storage object policies for the new content asset buckets.
- Added server-only image transform utility.
- Added nullable `showroom.blog_media.content_asset_id` bridge.

Remote verification checklist:

- [x] `showroom.content_assets` exists.
- [x] `showroom.content_asset_files` exists.
- [x] `showroom.content_asset_tags` exists.
- [x] `showroom.content_asset_tag_links` exists.
- [x] `showroom.content_asset_usages` exists.
- [x] `showroom.content_asset_events` exists.
- [x] RLS is enabled on all six tables.
- [x] `content-assets-private` bucket exists and is private.
- [x] `content-assets-public` bucket exists and is public.
- [x] `content-assets-public` allows WebP derivatives only.
- [x] Required `storage.objects` policies exist.
- [x] No `storage.objects` UPDATE policy exists for `content-assets-public`.

Required storage policies:

```text
content_assets_public_select
content_assets_public_admin_insert
content_assets_public_admin_delete
content_assets_private_admin_select
content_assets_private_admin_insert
content_assets_private_admin_delete
```

Pass criteria:

- Public reads are limited to public derivative objects and published blog asset metadata.
- Original files remain in `content-assets-private`.
- Public overwrite/upsert is blocked by the absence of UPDATE policy.
- Existing `blog-media` and `blog-media-private` policies are unchanged.
- Existing Content OS publish flow is unchanged.

Next PR boundary:

- PR-09 may implement the operator-facing photo library and multi-upload flow.
- PR-09 must keep operator language simple: photo library, upload, select, description, category, tag.
- PR-09 must not expose bucket names, object paths, private/public states, or transform internals in the UI.

## 13. Official central asset import and GIF verification

Migration:

- `supabase/migrations/20260715090000_official_asset_gif_support.sql`

Required checks:

- [x] The migration was applied through the approved migration path; bucket settings were not edited ad hoc.
- [x] `content-assets-private`, `blog-media-private`, and `blog-media` allow `image/gif`.
- [x] `content-assets-public` remains WebP-only.
- [x] The Codex command accepts only manifest `assetId` values under the canonical central root.
- [x] The central worktree is clean and both the selected manifest and original are tracked by, and byte-identical to, HEAD.
- [x] `CODEX_AUDIT_ACTOR_ID` matches the supplied administrator actor and any post attachment targets a `reviewing` post.
- [x] MIME magic, size, dimensions, GIF frames, SHA-256, LFS pointer, privacy status, claim risk, and duplicate checksum checks pass before upload.
- [x] A central candidate's original, static WebP poster/web, and thumbnail remain in `content-assets-private`, have no public URL, and keep `promotion_consent_checked = false`.
- [x] `official_reviewed` candidate is not automatic public approval: it stays private until project promotion consent and media approval. Unresolved claim risk is rejected again by both media approval and final publish server gates.
- [x] Asset metadata edits preserve `labels.centralBrand`; the DB trigger rejects provenance changes and central ID/SHA indexes reject concurrent duplicates.
- [x] The administrator upload path and Codex import path call the same original-image validation module.
- [x] GIF poster and thumbnail rows are private static WebP while the private original remains byte-identical GIF; only the validated blog publish path creates a new `blog-media` public object.
- [x] Publication-path tests preserve `.gif`, `image/gif`, animation, alt, and caption for an approved GIF.
- [x] The real Basic JPG and GIF import records include central asset/source/proof IDs, commit, checksum, and audit events.
- [x] The current `reviewing` manuscript received a cover JPG, body JPG, and original GIF without exposing private bucket paths in the browser.
- [x] A development-only public renderer regression proves the deterministic 2-frame GIF remains animated at desktop and 390px widths.
- [ ] 실제 reviewing 원고의 production 발행. 이 원고와 실제 GIF는 검수 큐에 유지하며 merge·production 승인 전에는 공개하지 않는다.

2026-07-20 evidence commands: `npm run test:official-brand-asset-import`, `npm run test:official-brand-asset-placement`, `npm run test:official-media-evidence-docs`, `npm run test:blog-public-gif-browser`, `npm run verify:blog-admin-cms`. Remote DB/storage state and the authenticated editor/preview were also checked directly; no production publish was performed.

“Direct registration prohibited” means bypassing validation, authorization, audit, or publish promotion gates is prohibited. A validated server-only registration command is an approved ingestion path; arbitrary SQL inserts and unchecked Storage uploads are not.
