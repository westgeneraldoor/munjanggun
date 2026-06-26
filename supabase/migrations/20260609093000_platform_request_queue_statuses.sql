-- Platform request queue status model for customer-facing state and admin work queue.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_request_status' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.customer_request_status AS ENUM (
            'confirmation_pending',
            'confirmed',
            'change_pending',
            'change_confirmed',
            'cancel_pending',
            'cancel_confirmed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_work_status' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.queue_work_status AS ENUM (
            'new_received',
            'new_done',
            'change_received',
            'change_done',
            'cancel_received',
            'cancel_done'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_source_type' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.queue_source_type AS ENUM ('measurement', 'as');
    END IF;
END$$;

ALTER TABLE platform.measurement_requests
  ADD COLUMN IF NOT EXISTS customer_status platform.customer_request_status NOT NULL DEFAULT 'confirmation_pending',
  ADD COLUMN IF NOT EXISTS queue_status platform.queue_work_status NOT NULL DEFAULT 'new_received',
  ADD COLUMN IF NOT EXISTS customer_action_note TEXT,
  ADD COLUMN IF NOT EXISTS customer_action_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES platform.profiles(id);

ALTER TABLE platform.as_requests
  ADD COLUMN IF NOT EXISTS customer_status platform.customer_request_status NOT NULL DEFAULT 'confirmation_pending',
  ADD COLUMN IF NOT EXISTS queue_status platform.queue_work_status NOT NULL DEFAULT 'new_received',
  ADD COLUMN IF NOT EXISTS customer_action_note TEXT,
  ADD COLUMN IF NOT EXISTS customer_action_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES platform.profiles(id);

UPDATE platform.measurement_requests
SET
  customer_status = CASE
    WHEN status = 'cancelled' THEN 'cancel_confirmed'::platform.customer_request_status
    WHEN status IN ('appsheet_registered', 'contacted', 'assigned', 'scheduled', 'measured') THEN 'confirmed'::platform.customer_request_status
    ELSE customer_status
  END,
  queue_status = CASE
    WHEN status = 'cancelled' THEN 'cancel_done'::platform.queue_work_status
    WHEN status IN ('appsheet_registered', 'contacted', 'assigned', 'scheduled', 'measured') THEN 'new_done'::platform.queue_work_status
    ELSE queue_status
  END
WHERE customer_status = 'confirmation_pending'::platform.customer_request_status
  AND queue_status = 'new_received'::platform.queue_work_status;

UPDATE platform.as_requests
SET
  customer_status = CASE
    WHEN status = 'cancelled' THEN 'cancel_confirmed'::platform.customer_request_status
    WHEN status IN ('reviewing', 'scheduled', 'resolved') THEN 'confirmed'::platform.customer_request_status
    ELSE customer_status
  END,
  queue_status = CASE
    WHEN status = 'cancelled' THEN 'cancel_done'::platform.queue_work_status
    WHEN status IN ('reviewing', 'scheduled', 'resolved') THEN 'new_done'::platform.queue_work_status
    ELSE queue_status
  END
WHERE customer_status = 'confirmation_pending'::platform.customer_request_status
  AND queue_status = 'new_received'::platform.queue_work_status;

CREATE INDEX IF NOT EXISTS measurement_requests_queue_status_idx ON platform.measurement_requests(queue_status, created_at DESC);
CREATE INDEX IF NOT EXISTS measurement_requests_customer_status_idx ON platform.measurement_requests(customer_id, customer_status, created_at DESC);
CREATE INDEX IF NOT EXISTS measurement_requests_action_requested_idx ON platform.measurement_requests(customer_action_requested_at DESC) WHERE customer_action_requested_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS as_requests_queue_status_idx ON platform.as_requests(queue_status, created_at DESC);
CREATE INDEX IF NOT EXISTS as_requests_customer_status_idx ON platform.as_requests(customer_id, customer_status, created_at DESC);
CREATE INDEX IF NOT EXISTS as_requests_action_requested_idx ON platform.as_requests(customer_action_requested_at DESC) WHERE customer_action_requested_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform.request_action_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type          platform.queue_source_type NOT NULL,
    source_id            UUID NOT NULL,
    actor_id             UUID NOT NULL REFERENCES platform.profiles(id),
    actor_role           platform.profile_role,
    event_type           TEXT NOT NULL,
    from_customer_status platform.customer_request_status,
    to_customer_status   platform.customer_request_status,
    from_queue_status    platform.queue_work_status,
    to_queue_status      platform.queue_work_status,
    memo                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS request_action_events_source_idx ON platform.request_action_events(source_type, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS request_action_events_actor_idx ON platform.request_action_events(actor_id, created_at DESC);

ALTER TABLE platform.request_action_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_request_action_events ON platform.request_action_events;
CREATE POLICY select_request_action_events ON platform.request_action_events
    FOR SELECT
    TO authenticated
    USING (
        platform_private.is_admin()
        OR platform_private.is_sales_manager()
        OR (
            source_type = 'measurement'::platform.queue_source_type
            AND EXISTS (
                SELECT 1
                FROM platform.measurement_requests r
                WHERE r.id = source_id
                  AND r.customer_id = (SELECT auth.uid())
            )
        )
        OR (
            source_type = 'as'::platform.queue_source_type
            AND EXISTS (
                SELECT 1
                FROM platform.as_requests r
                WHERE r.id = source_id
                  AND r.customer_id = (SELECT auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS insert_request_action_events ON platform.request_action_events;
CREATE POLICY insert_request_action_events ON platform.request_action_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        actor_id = (SELECT auth.uid())
        AND (
            platform_private.is_admin()
            OR platform_private.is_sales_manager()
            OR EXISTS (
                SELECT 1
                FROM platform.measurement_requests r
                WHERE source_type = 'measurement'::platform.queue_source_type
                  AND r.id = source_id
                  AND r.customer_id = (SELECT auth.uid())
            )
            OR EXISTS (
                SELECT 1
                FROM platform.as_requests r
                WHERE source_type = 'as'::platform.queue_source_type
                  AND r.id = source_id
                  AND r.customer_id = (SELECT auth.uid())
            )
        )
    );

GRANT SELECT, INSERT ON platform.request_action_events TO authenticated;
GRANT UPDATE (
  customer_status,
  queue_status,
  customer_action_note,
  customer_action_requested_at,
  processed_at,
  processed_by,
  updated_at
) ON platform.measurement_requests TO authenticated;
GRANT UPDATE (
  customer_status,
  queue_status,
  customer_action_note,
  customer_action_requested_at,
  processed_at,
  processed_by,
  updated_at
) ON platform.as_requests TO authenticated;
