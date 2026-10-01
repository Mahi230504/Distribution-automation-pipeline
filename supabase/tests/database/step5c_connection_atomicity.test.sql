begin;
select plan(6);

select has_function('public','commit_platform_connection_authorization',array['uuid','uuid','text','bigint','bigint','jsonb','jsonb','timestamp with time zone'],'atomic authorization RPC exists');
select has_function('public','disconnect_platform_connection',array['uuid','uuid','text','bigint','bigint','jsonb','timestamp with time zone'],'atomic disconnect RPC exists');
select isnt(has_function_privilege('authenticated','public.commit_platform_connection_authorization(uuid,uuid,text,bigint,bigint,jsonb,jsonb,timestamp with time zone)','execute'),true,'browser cannot write connection authorization');
select isnt(has_function_privilege('authenticated','public.disconnect_platform_connection(uuid,uuid,text,bigint,bigint,jsonb,timestamp with time zone)','execute'),true,'browser cannot atomically disconnect');
select has_function_privilege('service_role','public.commit_platform_connection_authorization(uuid,uuid,text,bigint,bigint,jsonb,jsonb,timestamp with time zone)','execute','service role can commit authorization');
select has_function_privilege('service_role','public.disconnect_platform_connection(uuid,uuid,text,bigint,bigint,jsonb,timestamp with time zone)','execute','service role can disconnect');

select * from finish();
rollback;
