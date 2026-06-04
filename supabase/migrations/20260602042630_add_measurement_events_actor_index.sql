-- MVP-02 performance follow-up: cover measurement event actor foreign key

CREATE INDEX IF NOT EXISTS measurement_events_actor_idx
ON platform.measurement_request_events(actor_id);
