begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is((select count(*)::bigint from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='private' and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read') and l.lanname='plpgsql' and p.prosecdef and p.pronargdefaults=0 and p.proconfig=array['search_path=""']::text[]),3::bigint,'three notification read definers live in private');
select extensions.is((select count(*)::bigint from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read') and l.lanname='sql' and not p.prosecdef and p.pronargdefaults=0 and p.proconfig=array['search_path=""']::text[] and position('private.'||p.proname||'(' in p.prosrc)>0),3::bigint,'three public notification read invoker wrappers preserve identities');
select extensions.is((select count(*)::bigint from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where n.nspname in('public','private') and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read') and x.grantee=0 and x.privilege_type='EXECUTE'),0::bigint,'no PUBLIC execute grant remains');
select extensions.ok(has_function_privilege('authenticated','public.notification_unread_count()','EXECUTE') and has_function_privilege('authenticated','public.mark_notification_read(uuid)','EXECUTE') and has_function_privilege('authenticated','public.mark_all_notifications_read()','EXECUTE'),'authenticated public grants are preserved');
select extensions.ok(has_function_privilege('service_role','private.notification_unread_count()','EXECUTE') and has_function_privilege('service_role','private.mark_notification_read(uuid)','EXECUTE') and has_function_privilege('service_role','private.mark_all_notifications_read()','EXECUTE'),'service private grants are preserved');
select extensions.ok(not has_function_privilege('anon','public.notification_unread_count()','EXECUTE') and not has_function_privilege('anon','public.mark_notification_read(uuid)','EXECUTE') and not has_function_privilege('anon','public.mark_all_notifications_read()','EXECUTE'),'notification read RPCs remain unavailable to anon');
select extensions.is((select count(*)::bigint from pg_policies policy where position('notification_unread_count(' in coalesce(policy.qual,''))>0 or position('notification_unread_count(' in coalesce(policy.with_check,''))>0 or position('mark_notification_read(' in coalesce(policy.qual,''))>0 or position('mark_notification_read(' in coalesce(policy.with_check,''))>0 or position('mark_all_notifications_read(' in coalesce(policy.qual,''))>0 or position('mark_all_notifications_read(' in coalesce(policy.with_check,''))>0),0::bigint,'no RLS policy depends on notification read identities');

reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
set local role authenticated;
select extensions.throws_ok($$select public.notification_unread_count()$$,'42501','active account required','public unread wrapper preserves active-account validation');
select extensions.throws_ok($$select private.notification_unread_count()$$,'42501','active account required','private unread implementation preserves validation');
reset role;

select * from extensions.finish();
rollback;
