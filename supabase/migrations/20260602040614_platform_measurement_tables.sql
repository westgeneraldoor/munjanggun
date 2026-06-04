-- MVP-02: platform measurement tables + storage + RLS
-- 브랜치: platform-v1

-- ============================================================
-- ENUM 추가 (appsheet_status)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appsheet_status' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.appsheet_status AS ENUM ('pending', 'registered', 'skipped');
    END IF;
END$$;

-- ============================================================
-- platform.measurement_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS platform.measurement_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
    customer_name       TEXT NOT NULL,
    phone               TEXT NOT NULL,
    address             TEXT NOT NULL,
    address_detail      TEXT,
    interest_category   platform.product_family NOT NULL DEFAULT 'other',
    message             TEXT NOT NULL,
    preferred_schedule  TEXT,
    status              platform.measurement_status NOT NULL DEFAULT 'submitted',
    appsheet_status     platform.appsheet_status NOT NULL DEFAULT 'pending',
    privacy_agreed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_timestamp_measurement_requests
BEFORE UPDATE ON platform.measurement_requests
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

-- 인덱스
CREATE INDEX IF NOT EXISTS measurement_requests_customer_idx ON platform.measurement_requests(customer_id);
CREATE INDEX IF NOT EXISTS measurement_requests_status_idx ON platform.measurement_requests(status);
CREATE INDEX IF NOT EXISTS measurement_requests_created_idx ON platform.measurement_requests(created_at DESC);

-- ============================================================
-- platform.measurement_media
-- ============================================================
CREATE TABLE IF NOT EXISTS platform.measurement_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES platform.measurement_requests(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
    bucket      TEXT NOT NULL DEFAULT 'measurement-media',
    object_path TEXT NOT NULL,
    media_type  TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    file_name   TEXT NOT NULL,
    file_size   BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS measurement_media_request_idx ON platform.measurement_media(request_id);
CREATE INDEX IF NOT EXISTS measurement_media_customer_idx ON platform.measurement_media(customer_id);

-- ============================================================
-- platform.measurement_request_events
-- ============================================================
CREATE TABLE IF NOT EXISTS platform.measurement_request_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES platform.measurement_requests(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES platform.profiles(id),
    event_type  TEXT NOT NULL,  -- e.g. 'status_changed', 'memo', 'appsheet_registered'
    memo        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS measurement_events_request_idx ON platform.measurement_request_events(request_id);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE platform.measurement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.measurement_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.measurement_request_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: measurement_requests
-- ============================================================

-- 고객: 본인 신청만 INSERT
CREATE POLICY insert_own_measurement_request ON platform.measurement_requests
    FOR INSERT
    WITH CHECK (customer_id = auth.uid());

-- 고객: 본인 신청만 SELECT
CREATE POLICY select_own_measurement_request ON platform.measurement_requests
    FOR SELECT
    USING (
        customer_id = auth.uid()
        OR platform_private.is_admin()
        OR platform_private.is_sales_manager()
    );

-- 관리자/영업매니저: 상태 업데이트 가능
CREATE POLICY update_measurement_request ON platform.measurement_requests
    FOR UPDATE
    USING (platform_private.is_admin() OR platform_private.is_sales_manager())
    WITH CHECK (platform_private.is_admin() OR platform_private.is_sales_manager());

-- ============================================================
-- RLS Policies: measurement_media
-- ============================================================

-- 고객: 본인 미디어만 INSERT
CREATE POLICY insert_own_media ON platform.measurement_media
    FOR INSERT
    WITH CHECK (customer_id = auth.uid());

-- 고객: 본인 미디어 SELECT / 관리자: 전체 SELECT
CREATE POLICY select_own_media ON platform.measurement_media
    FOR SELECT
    USING (
        customer_id = auth.uid()
        OR platform_private.is_admin()
        OR platform_private.is_sales_manager()
    );

-- ============================================================
-- RLS Policies: measurement_request_events
-- ============================================================

-- 본인 또는 관리자
CREATE POLICY select_events ON platform.measurement_request_events
    FOR SELECT
    USING (
        actor_id = auth.uid()
        OR platform_private.is_admin()
        OR platform_private.is_sales_manager()
    );

-- 관리자/영업매니저: 이벤트 기록
CREATE POLICY insert_events ON platform.measurement_request_events
    FOR INSERT
    WITH CHECK (
        actor_id = auth.uid()
        AND (platform_private.is_admin() OR platform_private.is_sales_manager())
    );

-- ============================================================
-- GRANT: authenticated 사용자 권한
-- ============================================================
GRANT SELECT, INSERT ON platform.measurement_requests TO authenticated;
GRANT UPDATE (status, appsheet_status, updated_at) ON platform.measurement_requests TO authenticated;
GRANT SELECT, INSERT ON platform.measurement_media TO authenticated;
GRANT SELECT, INSERT ON platform.measurement_request_events TO authenticated;

-- ============================================================
-- Storage bucket: measurement-media (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'measurement-media',
    'measurement-media',
    false,
    52428800,  -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 고객은 자기 폴더({uid}/*) 에만 업로드 가능
CREATE POLICY storage_insert_own ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'measurement-media'
        AND auth.uid()::text = (string_to_array(name, '/'))[1]
    );

-- 고객: 본인 파일만 SELECT (관리자는 API route에서 service role 사용)
CREATE POLICY storage_select_own ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'measurement-media'
        AND auth.uid()::text = (string_to_array(name, '/'))[1]
    );
