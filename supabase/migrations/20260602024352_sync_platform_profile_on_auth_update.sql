-- Ensure existing auth users also get platform profiles when they sign in again.

CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data, last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION platform_private.handle_new_user();
