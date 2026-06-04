-- MVP-02.1 follow-up hardening for booking operations.
-- Keeps customer-facing schedule data out of SECURITY DEFINER views and makes
-- admin-configured booking rules enforceable at the database boundary.

ALTER TABLE platform.measurement_product_categories
  ADD CONSTRAINT measurement_product_categories_key_format
  CHECK (key ~ '^[a-z0-9_]+$') NOT VALID;

ALTER TABLE platform.measurement_product_categories
  VALIDATE CONSTRAINT measurement_product_categories_key_format;

ALTER TABLE platform.measurement_booking_settings
  ADD CONSTRAINT measurement_booking_settings_days_range
  CHECK (min_days_out >= 0 AND max_days_out >= min_days_out) NOT VALID;

ALTER TABLE platform.measurement_booking_settings
  VALIDATE CONSTRAINT measurement_booking_settings_days_range;

ALTER TABLE platform.measurement_date_overrides
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE platform.measurement_date_overrides
  ADD CONSTRAINT measurement_date_overrides_source_check
  CHECK (source IN ('manual', 'holiday')) NOT VALID;

ALTER TABLE platform.measurement_date_overrides
  VALIDATE CONSTRAINT measurement_date_overrides_source_check;

UPDATE platform.measurement_date_overrides
SET source = 'holiday'
WHERE memo IN (
  '신정',
  '설날 연휴',
  '설날',
  '대체공휴일 (설날)',
  '삼일절',
  '대체공휴일 (삼일절)',
  '어린이날',
  '부처님오신날',
  '대체공휴일 (부처님오신날)',
  '현충일',
  '광복절',
  '추석 연휴',
  '추석',
  '개천절',
  '한글날',
  '대체공휴일 (개천절)',
  '성탄절'
);

DROP VIEW IF EXISTS platform.customer_date_overrides;

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

  v_dow := EXTRACT(DOW FROM NEW.preferred_visit_date);
  IF v_close_sat = true AND v_dow = 6 THEN
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
BEFORE INSERT OR UPDATE OF preferred_visit_date
ON platform.measurement_requests
FOR EACH ROW
EXECUTE FUNCTION platform_private.validate_measurement_request_date();
