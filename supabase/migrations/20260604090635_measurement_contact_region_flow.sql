-- MVP-02 guided estimate intake follow-up.
-- Captures real contact-routing needs and enforces regional visit-day rules.

ALTER TABLE platform.measurement_requests
  ADD COLUMN IF NOT EXISTS applicant_relationship TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS additional_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS service_region TEXT,
  ADD COLUMN IF NOT EXISTS service_region_status TEXT NOT NULL DEFAULT 'supported';

ALTER TABLE platform.measurement_requests
  ADD CONSTRAINT measurement_requests_service_region_status_check
  CHECK (service_region_status IN ('supported', 'chungcheong_limited', 'unsupported', 'unknown')) NOT VALID;

ALTER TABLE platform.measurement_requests
  VALIDATE CONSTRAINT measurement_requests_service_region_status_check;

ALTER TABLE platform.measurement_requests
  ADD CONSTRAINT measurement_requests_additional_contacts_array_check
  CHECK (jsonb_typeof(additional_contacts) = 'array') NOT VALID;

ALTER TABLE platform.measurement_requests
  VALIDATE CONSTRAINT measurement_requests_additional_contacts_array_check;

CREATE OR REPLACE FUNCTION platform_private.validate_measurement_request_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = platform, platform_private
AS $$
DECLARE
  v_min_days INTEGER;
  v_max_days INTEGER;
  v_close_sat BOOLEAN;
  v_close_sun BOOLEAN;
  v_close_hol BOOLEAN;
  v_override_closed BOOLEAN;
  v_override_source TEXT;
  v_dow INTEGER;
  v_days_out INTEGER;
BEGIN
  IF NEW.service_region_status = 'unsupported' THEN
    RAISE EXCEPTION '현재 문장군 무료방문 실측견적 상담 가능 지역 밖입니다.';
  END IF;

  IF NEW.preferred_visit_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT min_days_out, max_days_out, close_saturday, close_sunday, close_holidays
  INTO v_min_days, v_max_days, v_close_sat, v_close_sun, v_close_hol
  FROM platform.measurement_booking_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    v_min_days := 2;
    v_max_days := 30;
    v_close_sat := true;
    v_close_sun := true;
    v_close_hol := true;
  END IF;

  v_days_out := NEW.preferred_visit_date - CURRENT_DATE;
  IF v_days_out < v_min_days OR v_days_out > v_max_days THEN
    RAISE EXCEPTION '선택하신 방문 예약 날짜(%)는 예약 가능 범위(오늘 기준 +%일 ~ +%일 사이)가 아닙니다.',
      NEW.preferred_visit_date, v_min_days, v_max_days;
  END IF;

  v_dow := EXTRACT(DOW FROM NEW.preferred_visit_date);

  IF NEW.service_region_status = 'chungcheong_limited' AND v_dow NOT IN (3, 6) THEN
    RAISE EXCEPTION '천안, 아산, 청주, 세종, 대전은 수요일과 토요일 방문일만 선택할 수 있습니다.';
  END IF;

  SELECT is_closed, source
  INTO v_override_closed, v_override_source
  FROM platform.measurement_date_overrides
  WHERE date = NEW.preferred_visit_date;

  IF FOUND THEN
    IF v_override_source = 'manual' THEN
      IF v_override_closed = true THEN
        RAISE EXCEPTION '선택하신 날짜(%)는 예약이 마감되었거나 불가능한 날짜입니다.', NEW.preferred_visit_date;
      ELSE
        RETURN NEW;
      END IF;
    END IF;

    IF v_override_source = 'holiday' AND v_close_hol = true AND v_override_closed = true THEN
      RAISE EXCEPTION '선택하신 날짜(%)는 공휴일로 예약이 마감되었습니다.', NEW.preferred_visit_date;
    END IF;
  END IF;

  IF v_close_sat = true AND v_dow = 6 AND NEW.service_region_status <> 'chungcheong_limited' THEN
    RAISE EXCEPTION '토요일은 방문 예약을 접수하지 않습니다.';
  END IF;

  IF v_close_sun = true AND v_dow = 0 THEN
    RAISE EXCEPTION '일요일은 방문 예약을 접수하지 않습니다.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_measurement_request_date ON platform.measurement_requests;
CREATE TRIGGER check_measurement_request_date
BEFORE INSERT OR UPDATE OF preferred_visit_date, service_region_status
ON platform.measurement_requests
FOR EACH ROW
EXECUTE FUNCTION platform_private.validate_measurement_request_date();
