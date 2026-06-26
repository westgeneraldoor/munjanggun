-- Harden MVP-01 platform auth policies after advisor review.

CREATE OR REPLACE FUNCTION platform.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = platform;

DROP POLICY IF EXISTS select_profiles ON platform.profiles;
DROP POLICY IF EXISTS update_profiles ON platform.profiles;
DROP POLICY IF EXISTS select_staff_profiles ON platform.staff_profiles;
DROP POLICY IF EXISTS manage_staff_profiles ON platform.staff_profiles;
DROP POLICY IF EXISTS insert_staff_profiles ON platform.staff_profiles;
DROP POLICY IF EXISTS update_staff_profiles ON platform.staff_profiles;
DROP POLICY IF EXISTS delete_staff_profiles ON platform.staff_profiles;

CREATE POLICY select_profiles ON platform.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR (SELECT platform_private.is_admin())
    );

CREATE POLICY update_profiles ON platform.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR (SELECT platform_private.is_admin())
    )
    WITH CHECK (
        (SELECT platform_private.is_admin())
        OR (
            id = (SELECT auth.uid())
            AND role = (SELECT platform_private.get_user_role((SELECT auth.uid())))
        )
    );

CREATE POLICY select_staff_profiles ON platform.staff_profiles
    FOR SELECT
    TO authenticated
    USING (
        (SELECT platform_private.is_sales_manager())
    );

CREATE POLICY insert_staff_profiles ON platform.staff_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT platform_private.is_admin())
    );

CREATE POLICY update_staff_profiles ON platform.staff_profiles
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT platform_private.is_admin())
    )
    WITH CHECK (
        (SELECT platform_private.is_admin())
    );

CREATE POLICY delete_staff_profiles ON platform.staff_profiles
    FOR DELETE
    TO authenticated
    USING (
        (SELECT platform_private.is_admin())
    );
