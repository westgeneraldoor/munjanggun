alter view public.vw_search_index
  set (security_invoker = true);

revoke all on public.vw_search_index
  from public, anon, authenticated, service_role;

grant select on public.vw_search_index
  to anon, authenticated, service_role;
