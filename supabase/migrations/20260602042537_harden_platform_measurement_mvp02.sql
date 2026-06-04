-- MVP-02 follow-up hardening: status consistency and media ownership checks

ALTER TYPE platform.measurement_status ADD VALUE IF NOT EXISTS 'contacted' AFTER 'appsheet_registered';

DROP POLICY IF EXISTS insert_own_media ON platform.measurement_media;

CREATE POLICY insert_own_media ON platform.measurement_media
    FOR INSERT
    WITH CHECK (
        customer_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM platform.measurement_requests r
            WHERE r.id = request_id
              AND r.customer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS select_events ON platform.measurement_request_events;

CREATE POLICY select_events ON platform.measurement_request_events
    FOR SELECT
    USING (
        actor_id = auth.uid()
        OR platform_private.is_admin()
        OR platform_private.is_sales_manager()
        OR EXISTS (
            SELECT 1
            FROM platform.measurement_requests r
            WHERE r.id = request_id
              AND r.customer_id = auth.uid()
        )
    );
