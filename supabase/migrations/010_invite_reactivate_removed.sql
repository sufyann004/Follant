-- 010_invite_reactivate_removed.sql
-- Allow org inviters to move removed members back to invited (re-invite same email).

create or replace function public.guard_member_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Self-accept pending invitation (authenticated user matching invite email)
  if old.status = 'invited'
     and new.status = 'active'
     and old.user_id is null
     and new.user_id = auth.uid()
     and lower(old.email) = (select lower(trim(email)) from auth.users where id = auth.uid())
     and new.role is not distinct from old.role
     and new.access_profile_id is not distinct from old.access_profile_id
     and new.organization_id is not distinct from old.organization_id
     and new.email is not distinct from old.email
  then
    return new;
  end if;

  -- Re-invite a previously removed member (unique on org_id + email)
  if old.status = 'removed'
     and new.status = 'invited'
     and public.can_invite_members(old.organization_id)
  then
    return new;
  end if;

  if (
    new.role is distinct from old.role
    or new.access_profile_id is distinct from old.access_profile_id
    or new.status is distinct from old.status
    or new.organization_id is distinct from old.organization_id
    or new.email is distinct from old.email
  ) then
    if public.has_org_permission(old.organization_id, 'members', 'assign_roles') then
      return new;
    end if;

    if new.status = 'removed'
      and old.status <> 'removed'
      and public.has_org_permission(old.organization_id, 'members', 'remove') then
      return new;
    end if;

    raise exception 'Insufficient permission to modify member access';
  end if;

  if not public.has_org_permission(old.organization_id, 'members', 'update')
     and not public.can_manage_organization(old.organization_id) then
    raise exception 'Insufficient permission to update member details';
  end if;

  return new;
end;
$$;
