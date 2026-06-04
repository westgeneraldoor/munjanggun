alter role authenticator set pgrst.db_schemas = 'public, colorbook, showroom, platform';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
