\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'meetly_rls_test' THEN
    RAISE EXCEPTION 'Use only the disposable meetly_rls_test database';
  END IF;
END $$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;

CREATE TABLE public.rooms (id uuid PRIMARY KEY, owner_user_id uuid, title text NOT NULL);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rooms" ON public.rooms FOR SELECT USING (true);
-- Reproduce the permissive policies currently in 002_rls_policies.sql.
CREATE POLICY "Room owners can update their rooms" ON public.rooms FOR UPDATE
  USING (owner_user_id IS NULL OR auth.uid() = owner_user_id);
CREATE POLICY "Room owners can delete their rooms" ON public.rooms FOR DELETE
  USING (owner_user_id IS NULL OR auth.uid() = owner_user_id);
GRANT SELECT, UPDATE, DELETE ON public.rooms TO anon, authenticated, service_role;

INSERT INTO public.rooms VALUES
 ('00000000-0000-0000-0000-000000000001', NULL, 'anonymous room'),
 ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'owned A'),
 ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'owned B'),
 ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'owned A deletable');

CREATE FUNCTION public.assert_changed(command text, expected integer, label text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE touched integer;
BEGIN
  EXECUTE command;
  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched <> expected THEN
    RAISE EXCEPTION '%: expected %, got %', label, expected, touched;
  END IF;
  RAISE NOTICE 'PASS %', label;
END $$;

CREATE FUNCTION public.assert_denied(command text, label text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS %', label;
    RETURN;
  END;
  RAISE EXCEPTION '%: expected a permission error', label;
END $$;
