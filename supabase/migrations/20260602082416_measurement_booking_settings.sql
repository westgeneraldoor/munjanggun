-- 1. platform.measurement_requests 테이블에 신규 컬럼 추가
ALTER TABLE platform.measurement_requests
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS road_address TEXT,
  ADD COLUMN IF NOT EXISTS jibun_address TEXT,
  ADD COLUMN IF NOT EXISTS address_extra TEXT,
  ADD COLUMN IF NOT EXISTS preferred_visit_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_visit_time_slot TEXT,
  ADD COLUMN IF NOT EXISTS interest_categories TEXT[],
  ADD COLUMN IF NOT EXISTS is_manual_address BOOLEAN NOT NULL DEFAULT false;

-- 2. platform.measurement_product_categories 테이블 생성
CREATE TABLE IF NOT EXISTS platform.measurement_product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. platform.measurement_booking_settings 테이블 생성 (단일행 보장)
CREATE TABLE IF NOT EXISTS platform.measurement_booking_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_days_out INTEGER NOT NULL DEFAULT 2,
  max_days_out INTEGER NOT NULL DEFAULT 30,
  close_saturday BOOLEAN NOT NULL DEFAULT true,
  close_sunday BOOLEAN NOT NULL DEFAULT true,
  close_holidays BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. platform.measurement_date_overrides 테이블 생성
CREATE TABLE IF NOT EXISTS platform.measurement_date_overrides (
  date DATE PRIMARY KEY,
  is_closed BOOLEAN NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. RLS 활성화 명시
ALTER TABLE platform.measurement_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.measurement_booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.measurement_date_overrides ENABLE ROW LEVEL SECURITY;

-- 6. 보안 뷰(View) 생성 (고객은 메모를 보지 못하게 날짜와 닫힘 상태만 노출)
CREATE OR REPLACE VIEW platform.customer_date_overrides AS
  SELECT date, is_closed
  FROM platform.measurement_date_overrides;

-- 7. RLS Policy 작성
-- 7.1) measurement_product_categories 정책
DROP POLICY IF EXISTS select_measurement_product_categories ON platform.measurement_product_categories;
CREATE POLICY select_measurement_product_categories ON platform.measurement_product_categories
  FOR SELECT
  USING (
    is_active = true 
    OR platform_private.is_sales_manager()
  );

DROP POLICY IF EXISTS manage_measurement_product_categories ON platform.measurement_product_categories;
CREATE POLICY manage_measurement_product_categories ON platform.measurement_product_categories
  FOR ALL
  USING (
    platform_private.is_admin()
  );

-- 7.2) measurement_booking_settings 정책
DROP POLICY IF EXISTS select_measurement_booking_settings ON platform.measurement_booking_settings;
CREATE POLICY select_measurement_booking_settings ON platform.measurement_booking_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS manage_measurement_booking_settings ON platform.measurement_booking_settings;
CREATE POLICY manage_measurement_booking_settings ON platform.measurement_booking_settings
  FOR ALL
  USING (
    platform_private.is_admin()
  );

-- 7.3) measurement_date_overrides 정책 (고객 차단, 관리자만 조회/수정 가능)
DROP POLICY IF EXISTS select_measurement_date_overrides ON platform.measurement_date_overrides;
CREATE POLICY select_measurement_date_overrides ON platform.measurement_date_overrides
  FOR SELECT
  USING (
    platform_private.is_sales_manager()
  );

DROP POLICY IF EXISTS manage_measurement_date_overrides ON platform.measurement_date_overrides;
CREATE POLICY manage_measurement_date_overrides ON platform.measurement_date_overrides
  FOR ALL
  USING (
    platform_private.is_admin()
  );

-- 8. GRANT 구문
GRANT SELECT ON platform.measurement_product_categories TO authenticated, anon;
GRANT SELECT ON platform.measurement_booking_settings TO authenticated, anon;
GRANT SELECT ON platform.customer_date_overrides TO authenticated, anon;

GRANT ALL ON platform.measurement_product_categories TO authenticated;
GRANT ALL ON platform.measurement_booking_settings TO authenticated;
GRANT ALL ON platform.measurement_date_overrides TO authenticated;

-- 9. platform_private 스키마 하위 예약 날짜 검증 트리거 함수
CREATE OR REPLACE FUNCTION platform_private.validate_measurement_request_date()
RETURNS TRIGGER AS $$
DECLARE
  v_min_days INTEGER;
  v_max_days INTEGER;
  v_close_sat BOOLEAN;
  v_close_sun BOOLEAN;
  v_close_hol BOOLEAN;
  v_override_closed BOOLEAN;
  v_override_exists BOOLEAN;
  v_dow INTEGER;
  v_days_out INTEGER;
BEGIN
  -- preferred_visit_date가 없으면(NULL) 통과 (하위 호환)
  IF NEW.preferred_visit_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- 9.1) 예약 설정 로드 (기본값 fallback 포함)
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

  -- 9.2) 공통 제약: 최소/최대 신청 가능일 범위 내에 있는지 절대 검증 (수동 열림도 이 범위를 뚫을 수 없음)
  v_days_out := NEW.preferred_visit_date - CURRENT_DATE;
  IF v_days_out < v_min_days OR v_days_out > v_max_days THEN
    RAISE EXCEPTION '선택하신 방문 예약 날짜(%)는 예약 가능 범위(오늘 기준 +%일 ~ +%일 사이)가 아닙니다.', 
      NEW.preferred_visit_date, v_min_days, v_max_days;
  END IF;

  -- 9.3) 수동 날짜 오버라이드 확인
  SELECT is_closed INTO v_override_closed
  FROM platform.measurement_date_overrides
  WHERE date = NEW.preferred_visit_date;

  IF FOUND THEN
    -- 명시적 수동 닫힘(is_closed = true)인 경우 예외 발생
    IF v_override_closed = true THEN
      RAISE EXCEPTION '선택하신 날짜(%)는 예약이 마감되었거나 불가능한 날짜입니다.', NEW.preferred_visit_date;
    -- 명시적 수동 열림(is_closed = false)인 경우, 범위 검증을 통과했으므로 요일/공휴일 조건 무시하고 승인
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- 9.4) 요일 확인 (토=6, 일=0)
  v_dow := EXTRACT(DOW FROM NEW.preferred_visit_date);
  IF v_close_sat = true AND v_dow = 6 THEN
    RAISE EXCEPTION '토요일은 방문 예약을 접수하지 않습니다.';
  END IF;
  IF v_close_sun = true AND v_dow = 0 THEN
    RAISE EXCEPTION '일요일은 방문 예약을 접수하지 않습니다.';
  END IF;

  -- 9.5) 공휴일 자동 닫기 처리
  -- 공휴일은 overrides 테이블에 is_closed = true 로 시드되어 있으므로
  -- close_holidays = true이고 해당 날짜가 overrides에 등록되어 있다면 9.3단계에서 이미 걸러집니다.
  -- 만약 overrides에 등록되어 있으면서 is_closed = true 이면 예외가 이미 났습니다.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform, platform_private;

-- 트리거 바인딩
DROP TRIGGER IF EXISTS check_measurement_request_date ON platform.measurement_requests;
CREATE TRIGGER check_measurement_request_date
  BEFORE INSERT ON platform.measurement_requests
  FOR EACH ROW
  EXECUTE FUNCTION platform_private.validate_measurement_request_date();

-- 10. Seed 데이터 삽입
-- 10.1) 기본 관심 카테고리
INSERT INTO platform.measurement_product_categories (key, label, description, sort_order, is_active)
VALUES
  ('middle_door', '중문', 'ABS / 알루미늄 중문', 10, true),
  ('abs_door', 'ABS 도어', '실내 방문 / 화장실문', 20, true),
  ('front_door', '현관문', '단열 현관문 / 방화문', 30, true),
  ('molding_baseboard', '몰딩/걸레받이', '천장 몰딩 및 걸레받이 시공', 40, true),
  ('other', '기타 / 복합', '복합 시공 및 기타 품목', 50, true)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- 10.2) 기본 예약 설정
INSERT INTO platform.measurement_booking_settings (id, min_days_out, max_days_out, close_saturday, close_sunday, close_holidays)
VALUES (1, 2, 30, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- 10.3) 2026-2027년 주요 한국 공휴일 오버라이드 등록 (기본 닫힘)
INSERT INTO platform.measurement_date_overrides (date, is_closed, memo)
VALUES
  -- 2026년 공휴일
  ('2026-01-01', true, '신정'),
  ('2026-02-16', true, '설날 연휴'),
  ('2026-02-17', true, '설날'),
  ('2026-02-18', true, '설날 연휴'),
  ('2026-03-01', true, '삼일절'),
  ('2026-05-05', true, '어린이날'),
  ('2026-05-24', true, '부처님오신날'),
  ('2026-06-06', true, '현충일'),
  ('2026-08-15', true, '광복절'),
  ('2026-09-24', true, '추석 연휴'),
  ('2026-09-25', true, '추석'),
  ('2026-09-26', true, '추석 연휴'),
  ('2026-10-03', true, '개천절'),
  ('2026-10-09', true, '한글날'),
  ('2026-12-25', true, '성탄절'),
  -- 2027년 공휴일
  ('2027-01-01', true, '신정'),
  ('2027-02-06', true, '설날 연휴'),
  ('2027-02-07', true, '설날'),
  ('2027-02-08', true, '설날 연휴'),
  ('2027-02-09', true, '대체공휴일 (설날)'),
  ('2027-03-01', true, '삼일절'),
  ('2027-05-05', true, '어린이날'),
  ('2027-05-13', true, '부처님오신날'),
  ('2027-06-06', true, '현충일'),
  ('2027-08-15', true, '광복절'),
  ('2027-08-16', true, '대체공휴일 (광복절)'),
  ('2027-09-14', true, '추석 연휴'),
  ('2027-09-15', true, '추석'),
  ('2027-09-16', true, '추석 연휴'),
  ('2027-10-03', true, '개천절'),
  ('2027-10-04', true, '대체공휴일 (개천절)'),
  ('2027-10-09', true, '한글날'),
  ('2027-10-11', true, '대체공휴일 (한글날)'),
  ('2027-12-25', true, '성탄절')
ON CONFLICT (date) DO UPDATE
SET is_closed = EXCLUDED.is_closed, memo = EXCLUDED.memo;
