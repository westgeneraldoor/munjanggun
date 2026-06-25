---
document_type: "Content OS Operation Checklist"
version: "1.0.0"
status: "ops-ready-draft"
created: "2026-06-25"
owner: "Codex PM"
source_prd: "docs/platform/CONTENT_OS_PRD.md"
source_schema: "docs/platform/CONTENT_OS_SCHEMA.md"
source_admin_ux: "docs/platform/CONTENT_OS_ADMIN_UX.md"
source_seo_aeo_spec: "docs/platform/CONTENT_OS_SEO_AEO_SPEC.md"
related_pr: "PR-03 / codex/content-os-mvp"
---

# CONTENT_OS_OPERATION_CHECKLIST - OPS-01

## 0. Purpose

This checklist is the pre-production rehearsal plan for MVP-CONTENTOS-01.

The Content OS implementation is not treated as ready for real operation until this checklist is completed against the target Supabase project and deployment URL.

The goal is to confirm the full loop:

```text
admin draft queue
-> block editor
-> private media candidate
-> media approval
-> preview
-> publish server action
-> public WebP promotion
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
- AI draft generation automation.
- Search Console API automation.

## 2. Current Verification Status

As of 2026-06-25 in the Codex local session:

- `npm run lint`: passed with existing non-Content-OS admin warnings.
- `npm run build`: passed.
- `git diff --check`: passed with CRLF warnings only.
- Local Playwright/Supabase publish rehearsal passed and test data was cleaned up.
- Local `supabase` CLI was not installed.
- `npx supabase --version` failed with a transient npm network `ECONNRESET`.
- Service-role REST access to the `storage` schema was blocked because only `public`, `colorbook`, `showroom`, and `platform` schemas are exposed through the Data API.

Conclusion:

```text
storage.objects policy remote application is not confirmed from this Codex session.
Confirm it with a DB owner or linked Supabase CLI before production publishing.
```

## 3. Storage Policy Remote Confirmation

### 3.1 Expected Buckets

Confirm the target Supabase project has these buckets:

```text
blog-media-private
public: false
allowed_mime_types: image/jpeg, image/png, image/webp, image/heic, image/heif

blog-media
public: true
allowed_mime_types: image/jpeg, image/png, image/webp
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
- [ ] Confirm last fact checked date is present.
- [ ] Confirm source evidence exists.
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
- [ ] Confirm used approved media is converted to WebP.
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
- [ ] Cover image uses public WebP URL.
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
- [ ] Draft/reviewing/ready/archived posts are absent.
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
