-- platform 및 platform_private 스키마 생성
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS platform_private;

-- platform 스키마의 ENUM 타입 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_role' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.profile_role AS ENUM ('customer', 'sales_manager', 'administrator');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'measurement_status' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.measurement_status AS ENUM ('submitted', 'appsheet_pending', 'appsheet_registered', 'assigned', 'scheduled', 'measured', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_family' AND typnamespace = 'platform'::regnamespace) THEN
        CREATE TYPE platform.product_family AS ENUM ('middle_door', 'abs_door', 'front_door', 'molding_baseboard', 'other');
    END IF;
END$$;

-- platform.profiles 테이블 생성
CREATE TABLE IF NOT EXISTS platform.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role platform.profile_role NOT NULL DEFAULT 'customer',
    display_name TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- platform.staff_profiles 테이블 생성
CREATE TABLE IF NOT EXISTS platform.staff_profiles (
    profile_id UUID PRIMARY KEY REFERENCES platform.profiles(id) ON DELETE CASCADE,
    team_name TEXT,
    public_name TEXT NOT NULL,
    work_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 업데이트 트리거 함수 및 트리거 설정
CREATE OR REPLACE FUNCTION platform.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON platform.profiles
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_timestamp_staff_profiles
BEFORE UPDATE ON platform.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

-- 기존의 platform.handle_new_user 함수 제거 (platform_private로 이전하기 위함)
DROP FUNCTION IF EXISTS platform.handle_new_user();

-- 신규 가입 시 프로필 자동 생성 트리거 함수 및 트리거 설정 (platform_private 및 search_path 고정)
CREATE OR REPLACE FUNCTION platform_private.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_phone TEXT;
    v_email TEXT;
BEGIN
    v_display_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'nickname',
        new.raw_user_meta_data->>'custom_name'
    );
    
    v_phone := COALESCE(
        new.raw_user_meta_data->>'phone_number',
        new.raw_user_meta_data->>'phone'
    );
    
    v_email := new.email;

    INSERT INTO platform.profiles (id, role, display_name, phone, email)
    VALUES (
        new.id,
        'customer'::platform.profile_role,
        v_display_name,
        v_phone,
        v_email
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        display_name = COALESCE(platform.profiles.display_name, EXCLUDED.display_name),
        phone = COALESCE(platform.profiles.phone, EXCLUDED.phone),
        email = COALESCE(platform.profiles.email, EXCLUDED.email),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform, platform_private;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION platform_private.handle_new_user();

-- RLS 활성화
ALTER TABLE platform.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.staff_profiles ENABLE ROW LEVEL SECURITY;

-- platform_private 헬퍼 함수 생성 (Security Definer 및 search_path 고정)
CREATE OR REPLACE FUNCTION platform_private.current_role()
RETURNS platform.profile_role AS $$
DECLARE
    v_role platform.profile_role;
BEGIN
    SELECT role INTO v_role
    FROM platform.profiles
    WHERE id = auth.uid();
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform;

CREATE OR REPLACE FUNCTION platform_private.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN platform_private.current_role() = 'administrator'::platform.profile_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform, platform_private;

CREATE OR REPLACE FUNCTION platform_private.is_sales_manager()
RETURNS BOOLEAN AS $$
DECLARE
    v_role platform.profile_role;
BEGIN
    v_role := platform_private.current_role();
    RETURN v_role = 'sales_manager'::platform.profile_role OR v_role = 'administrator'::platform.profile_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform, platform_private;

-- RLS 재귀 서브쿼리를 방지하기 위한 역할 조회 헬퍼 함수
CREATE OR REPLACE FUNCTION platform_private.get_user_role(p_user_id UUID)
RETURNS platform.profile_role AS $$
DECLARE
    v_role platform.profile_role;
BEGIN
    SELECT role INTO v_role
    FROM platform.profiles
    WHERE id = p_user_id;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = platform;

-- profiles RLS policy 설정
CREATE POLICY select_profiles ON platform.profiles
    FOR SELECT
    USING (
        id = auth.uid() 
        OR platform_private.is_admin()
    );

CREATE POLICY update_profiles ON platform.profiles
    FOR UPDATE
    USING (
        id = auth.uid() 
        OR platform_private.is_admin()
    )
    WITH CHECK (
        platform_private.is_admin() 
        OR (
            id = auth.uid() 
            AND role = platform_private.get_user_role(auth.uid())
        )
    );

-- staff_profiles RLS policy 설정
CREATE POLICY select_staff_profiles ON platform.staff_profiles
    FOR SELECT
    USING (
        platform_private.is_sales_manager()
    );

CREATE POLICY manage_staff_profiles ON platform.staff_profiles
    FOR ALL
    USING (
        platform_private.is_admin()
    );

-- 필수 인덱스 생성
CREATE INDEX IF NOT EXISTS profiles_role_idx ON platform.profiles(role);
CREATE INDEX IF NOT EXISTS staff_profiles_active_idx ON platform.staff_profiles(is_active);

-- Supabase 권한 GRANT 추가
GRANT USAGE ON SCHEMA platform TO authenticated;
GRANT USAGE ON SCHEMA platform TO anon;

-- profiles 테이블 권한: authenticated는 전체 조회 가능, update는 display_name, phone 컬럼만 제한적 허용
GRANT SELECT ON platform.profiles TO authenticated;
GRANT UPDATE (display_name, phone) ON platform.profiles TO authenticated;
GRANT SELECT ON platform.staff_profiles TO authenticated;
