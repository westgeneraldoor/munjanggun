-- MVP-07: customer AS requests + media metadata

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'as_request_status' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.as_request_status AS ENUM ('submitted', 'reviewing', 'scheduled', 'resolved', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'as_urgency' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.as_urgency AS ENUM ('normal', 'urgent');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_method' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.contact_method AS ENUM ('phone', 'sms', 'kakao');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS platform.as_requests (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id              UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
    customer_name            TEXT NOT NULL,
    phone                    TEXT NOT NULL,
    contact_name             TEXT,
    contact_phone            TEXT,
    contact_relationship     TEXT,
    address                  TEXT,
    address_detail           TEXT,
    issue_type               TEXT NOT NULL DEFAULT 'other',
    urgency                  platform.as_urgency NOT NULL DEFAULT 'normal',
    preferred_contact_method platform.contact_method NOT NULL DEFAULT 'phone',
    message                  TEXT NOT NULL,
    status                   platform.as_request_status NOT NULL DEFAULT 'submitted',
    privacy_agreed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_timestamp_as_requests
BEFORE UPDATE ON platform.as_requests
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS as_requests_customer_idx ON platform.as_requests(customer_id);
CREATE INDEX IF NOT EXISTS as_requests_status_idx ON platform.as_requests(status);
CREATE INDEX IF NOT EXISTS as_requests_created_idx ON platform.as_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS platform.as_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES platform.as_requests(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE CASCADE,
    bucket      TEXT NOT NULL DEFAULT 'measurement-media',
    object_path TEXT NOT NULL,
    media_type  TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    file_name   TEXT NOT NULL,
    file_size   BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS as_media_request_idx ON platform.as_media(request_id);
CREATE INDEX IF NOT EXISTS as_media_customer_idx ON platform.as_media(customer_id);

ALTER TABLE platform.as_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.as_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insert_own_as_request ON platform.as_requests;
CREATE POLICY insert_own_as_request ON platform.as_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS select_own_as_request ON platform.as_requests;
CREATE POLICY select_own_as_request ON platform.as_requests
    FOR SELECT
    TO authenticated
    USING (
        customer_id = (SELECT auth.uid())
        OR platform_private.is_admin()
        OR platform_private.is_sales_manager()
    );

DROP POLICY IF EXISTS update_as_request ON platform.as_requests;
CREATE POLICY update_as_request ON platform.as_requests
    FOR UPDATE
    TO authenticated
    USING (platform_private.is_admin() OR platform_private.is_sales_manager())
    WITH CHECK (platform_private.is_admin() OR platform_private.is_sales_manager());

DROP POLICY IF EXISTS insert_own_as_media ON platform.as_media;
CREATE POLICY insert_own_as_media ON platform.as_media
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1
            FROM platform.as_requests r
            WHERE r.id = request_id
              AND r.customer_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS select_own_as_media ON platform.as_media;
CREATE POLICY select_own_as_media ON platform.as_media
    FOR SELECT
    TO authenticated
    USING (
        customer_id = (SELECT auth.uid())
        OR platform_private.is_admin()
        OR platform_private.is_sales_manager()
    );

GRANT SELECT, INSERT ON platform.as_requests TO authenticated;
GRANT UPDATE (status, updated_at) ON platform.as_requests TO authenticated;
GRANT SELECT, INSERT ON platform.as_media TO authenticated;
