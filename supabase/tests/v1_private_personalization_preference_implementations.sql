begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is((select count(*)::bigint from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in('get_my_recommendation_personalization_v1','set_my_recommendation_personalization_v1','clear_my_recommendation_personalization_data_v1') and p.prosecdef and p.pronargdefaults=0 and p.proconfig=array['search_path=""']::text[]),3::bigint,'three personalization definers live in private');
select extensions.is((select count(*)::bigint from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname in('get_my_recommendation_personalization_v1','set_my_recommendation_personalization_v1','clear_my_recommendation_personalization_data_v1') and l.lanname='sql' and not p.prosecdef and p.pronargdefaults=0 and p.proconfig=array['search_path=""']::text[] and position('private.'||p.proname||'(' in p.prosrc)>0),3::bigint,'three public personalization invoker wrappers preserve identities');
select extensions.is((select count(*)::bigint from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where n.nspname in('public','private') and p.proname in('get_my_recommendation_personalization_v1','set_my_recommendation_personalization_v1','clear_my_recommendation_personalization_data_v1') and x.grantee=0 and x.privilege_type='EXECUTE'),0::bigint,'no PUBLIC execute grant remains');
select extensions.ok(has_function_privilege('authenticated','public.get_my_recommendation_personalization_v1()','EXECUTE') and has_function_privilege('authenticated','public.set_my_recommendation_personalization_v1(boolean)','EXECUTE') and has_function_privilege('authenticated','public.clear_my_recommendation_personalization_data_v1()','EXECUTE'),'authenticated public grants are preserved');
select extensions.ok(not has_function_privilege('anon','public.get_my_recommendation_personalization_v1()','EXECUTE') and not has_function_privilege('anon','public.set_my_recommendation_personalization_v1(boolean)','EXECUTE') and not has_function_privilege('anon','public.clear_my_recommendation_personalization_data_v1()','EXECUTE'),'personalization RPCs remain unavailable to anon');
select extensions.is((select count(*)::bigint from pg_policies policy where position('get_my_recommendation_personalization_v1(' in coalesce(policy.qual,''))>0 or position('set_my_recommendation_personalization_v1(' in coalesce(policy.qual,''))>0 or position('clear_my_recommendation_personalization_data_v1(' in coalesce(policy.qual,''))>0),0::bigint,'no RLS policy depends on personalization identities');

set local role authenticated;
select extensions.throws_ok($$select public.set_my_recommendation_personalization_v1(null)$$,'42501','authentication required','public wrapper preserves authentication boundary');
select extensions.throws_ok($$select private.clear_my_recommendation_personalization_data_v1()$$,'42501','authentication required','private clear preserves authentication boundary');
reset role;

select * from extensions.finish();
rollback;
