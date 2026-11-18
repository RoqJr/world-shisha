-- =====================================================================
-- World Shisha — Lista "Quero provar" e dados para o feed
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quero provar (lista pessoal)
-- ---------------------------------------------------------------------
create table public.wishlist (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  essence_id  bigint not null references public.essences (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, essence_id)
);

alter table public.wishlist enable row level security;
revoke all on public.wishlist from anon, authenticated;
grant select, insert, delete on public.wishlist to authenticated;

create policy "ve a propria lista" on public.wishlist
  for select to authenticated using (user_id = (select auth.uid()));
create policy "adiciona na propria lista" on public.wishlist
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.essences e where e.id = essence_id and e.status = 'approved')
  );
create policy "remove da propria lista" on public.wishlist
  for delete to authenticated using (user_id = (select auth.uid()));

-- Provou (avaliou)? Sai da lista automaticamente
create function public.wishlist_remove_on_review()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.wishlist where user_id = new.user_id and essence_id = new.essence_id;
  return new;
end;
$$;
create trigger reviews_wishlist_cleanup
  after insert on public.reviews
  for each row execute function public.wishlist_remove_on_review();
revoke execute on function public.wishlist_remove_on_review() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Feed: guarda quando a essência foi aprovada
-- ---------------------------------------------------------------------
alter table public.essences add column approved_at timestamptz;
update public.essences set approved_at = coalesce(updated_at, created_at) where status = 'approved';
create index essences_approved_at_idx on public.essences (approved_at desc) where status = 'approved';
create index reviews_created_at_idx on public.reviews (created_at desc);
create index user_achievements_earned_idx on public.user_achievements (earned_at desc);

create or replace function public.essences_before_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null then
    if new.status = 'approved' then new.approved_at := coalesce(new.approved_at, now()); end if;
    return new;
  end if;
  new.created_by := auth.uid();
  new.motivo_rejeicao := null;
  if public.is_admin() then
    new.status := 'approved';
    new.approved_by := auth.uid();
    new.approved_at := now();
  else
    new.status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.essences_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := now();
    new.motivo_rejeicao := null;
    update public.brands set status = 'approved'
      where id = new.brand_id and status = 'pending';
  end if;

  if new.status = 'rejected' and coalesce(trim(new.motivo_rejeicao), '') = '' then
    raise exception 'Informe o motivo da rejeição';
  end if;

  return new;
end;
$$;
