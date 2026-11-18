-- =====================================================================
-- World Shisha — Ferramentas de admin: membros bloqueados
-- =====================================================================

-- Membro bloqueado não consegue entrar (o bloqueio de login é feito pela
-- função manage-user); esta coluna só serve para o app mostrar o status.
alter table public.profiles add column ativo boolean not null default true;

-- Só admin altera papel ou status de bloqueio
create or replace function public.guard_profile_role()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.ativo is distinct from old.ativo)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Apenas admins podem alterar papéis ou bloquear membros';
  end if;
  return new;
end;
$$;
