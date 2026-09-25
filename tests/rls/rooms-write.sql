\set ON_ERROR_STOP on
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT public.assert_changed($q$UPDATE rooms SET title='attack' WHERE id='00000000-0000-0000-0000-000000000001'$q$, 0, 'anonymous update blocked');
SELECT public.assert_changed($q$DELETE FROM rooms WHERE id='00000000-0000-0000-0000-000000000001'$q$, 0, 'anonymous delete blocked');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
SELECT public.assert_changed($q$UPDATE rooms SET title='owner update' WHERE id='00000000-0000-0000-0000-000000000002'$q$, 1, 'owner update allowed');
SELECT public.assert_changed($q$UPDATE rooms SET title='attack' WHERE id='00000000-0000-0000-0000-000000000003'$q$, 0, 'other owner update blocked');
SELECT public.assert_changed($q$DELETE FROM rooms WHERE id='00000000-0000-0000-0000-000000000003'$q$, 0, 'other owner delete blocked');
SELECT public.assert_changed($q$UPDATE rooms SET title='attack' WHERE id='00000000-0000-0000-0000-000000000001'$q$, 0, 'authenticated non-owner cannot edit anonymous room');
SELECT public.assert_denied($q$UPDATE rooms SET owner_user_id=NULL WHERE id='00000000-0000-0000-0000-000000000002'$q$, 'owner cannot remove ownership to bypass checks');
SELECT public.assert_changed($q$DELETE FROM rooms WHERE id='00000000-0000-0000-0000-000000000004'$q$, 1, 'owner delete allowed');
RESET ROLE;

SET ROLE service_role;
SELECT public.assert_changed($q$UPDATE rooms SET title='authorized edge function' WHERE id='00000000-0000-0000-0000-000000000001'$q$, 1, 'service role path remains available');
RESET ROLE;
