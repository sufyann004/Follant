-- Extend invite preview to match local API: active members, account-exists, sign-in vs register paths.

create or replace function public.get_invite_preview(p_organization_id uuid, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_member public.organization_members%rowtype;
  v_org_name text;
  v_account_exists boolean;
begin
  if p_organization_id is null or v_email = '' then
    return null;
  end if;

  select * into v_member
  from public.organization_members
  where organization_id = p_organization_id
    and email = v_email
    and status <> 'removed';

  if not found then
    return null;
  end if;

  select name into v_org_name from public.organizations where id = p_organization_id;
  if v_org_name is null then
    return null;
  end if;

  v_account_exists := exists(
    select 1 from public.profiles where lower(email) = v_email
  );

  return jsonb_build_object(
    'orgId', p_organization_id,
    'orgName', v_org_name,
    'email', v_email,
    'role', v_member.role,
    'title', v_member.title,
    'memberStatus', v_member.status,
    'accountExists', v_account_exists,
    'canRegister', v_member.status = 'invited' and not v_account_exists,
    'canAcceptWhileSignedIn', v_member.status = 'invited' and v_account_exists
  );
end;
$$;

revoke all on function public.get_invite_preview(uuid, text) from public;
grant execute on function public.get_invite_preview(uuid, text) to anon, authenticated;
