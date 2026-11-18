-- =====================================================================
-- World Shisha — Fase 2 (Social): Top 5, recomendações, notificações, avatares
-- =====================================================================

-- ---------------------------------------------------------------------
-- Top 5 de cada membro
-- ---------------------------------------------------------------------
create table public.top5 (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  essence_id  bigint not null references public.essences (id) on delete cascade,
  posicao     smallint not null check (posicao between 1 and 5),
  primary key (user_id, posicao),
  unique (user_id, essence_id)
);

alter table public.top5 enable row level security;
revoke all on public.top5 from anon, authenticated;
grant select, insert, delete on public.top5 to authenticated;

create policy "membros veem top5" on public.top5
  for select to authenticated using (true);
create policy "monta o proprio top5" on public.top5
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.essences e where e.id = essence_id and e.status = 'approved')
  );
create policy "limpa o proprio top5" on public.top5
  for delete to authenticated using (user_id = (select auth.uid()));

-- Substitui o Top 5 inteiro de uma vez (a ordem do array é a posição)
create function public.set_top5(essence_ids bigint[])
returns void
language plpgsql set search_path = ''
as $$
begin
  if coalesce(array_length(essence_ids, 1), 0) > 5 then
    raise exception 'O Top 5 aceita no máximo 5 essências';
  end if;
  delete from public.top5 where user_id = auth.uid();
  insert into public.top5 (user_id, essence_id, posicao)
    select auth.uid(), t.e, t.ord from unnest(essence_ids) with ordinality as t(e, ord);
end;
$$;

-- ---------------------------------------------------------------------
-- Notificações (criadas só pelo banco; o usuário lê, marca como lida e apaga)
-- ---------------------------------------------------------------------
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  tipo        text not null,
  payload     jsonb not null default '{}',
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (lida) on public.notifications to authenticated;

create policy "ve as proprias notificacoes" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "marca as proprias como lidas" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "apaga as proprias notificacoes" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Nome de exibição (apelido ou nome)
create function public.display_name(uid uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(trim(apelido), ''), nome) from public.profiles where id = uid;
$$;

-- ---------------------------------------------------------------------
-- Recomendações (para uma ou várias pessoas)
-- ---------------------------------------------------------------------
create table public.recommendations (
  id          bigint generated always as identity primary key,
  from_user   uuid not null references public.profiles (id) on delete cascade,
  essence_id  bigint not null references public.essences (id) on delete cascade,
  mensagem    text,
  created_at  timestamptz not null default now()
);
create index recommendations_essence_idx on public.recommendations (essence_id);
create index recommendations_from_idx on public.recommendations (from_user);

create table public.recommendation_recipients (
  recommendation_id  bigint not null references public.recommendations (id) on delete cascade,
  to_user            uuid not null references public.profiles (id) on delete cascade,
  primary key (recommendation_id, to_user)
);
create index recommendation_recipients_to_idx on public.recommendation_recipients (to_user);

-- Quem enviou a recomendação (ignora RLS para evitar recursão nas regras)
create function public.recommendation_sender(rec_id bigint)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select from_user from public.recommendations where id = rec_id;
$$;

alter table public.recommendations enable row level security;
alter table public.recommendation_recipients enable row level security;
revoke all on public.recommendations, public.recommendation_recipients from anon, authenticated;
grant select on public.recommendations, public.recommendation_recipients to authenticated;

create policy "remetente ou destinatario ve" on public.recommendations
  for select to authenticated
  using (
    from_user = (select auth.uid())
    or exists (
      select 1 from public.recommendation_recipients r
      where r.recommendation_id = id and r.to_user = (select auth.uid())
    )
  );
create policy "remetente ou destinatario ve destinatarios" on public.recommendation_recipients
  for select to authenticated
  using (to_user = (select auth.uid()) or public.recommendation_sender(recommendation_id) = (select auth.uid()));

-- Envia uma recomendação e notifica cada destinatário
create function public.recommend(p_essence_id bigint, p_to_users uuid[], p_mensagem text default null)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id bigint;
  v_essence text;
  v_msg text := nullif(trim(p_mensagem), '');
begin
  if v_me is null then raise exception 'Faça login novamente'; end if;

  select e.nome || ' · ' || b.nome into v_essence
  from public.essences e join public.brands b on b.id = e.brand_id
  where e.id = p_essence_id and e.status = 'approved';
  if v_essence is null then raise exception 'Essência não encontrada'; end if;

  if not exists (select 1 from unnest(p_to_users) u where u <> v_me) then
    raise exception 'Escolha pelo menos uma pessoa';
  end if;

  insert into public.recommendations (from_user, essence_id, mensagem)
  values (v_me, p_essence_id, v_msg)
  returning id into v_id;

  insert into public.recommendation_recipients (recommendation_id, to_user)
    select distinct v_id, p.id
    from unnest(p_to_users) u join public.profiles p on p.id = u
    where p.id <> v_me;

  insert into public.notifications (user_id, tipo, payload)
    select r.to_user, 'recommendation',
           jsonb_build_object('essence_id', p_essence_id, 'essence', v_essence,
                              'from_id', v_me, 'from', public.display_name(v_me), 'mensagem', v_msg)
    from public.recommendation_recipients r
    where r.recommendation_id = v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Notificações automáticas
-- ---------------------------------------------------------------------

-- Nova essência pendente -> avisa todos os admins
create function public.notify_pending_essence()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, tipo, payload)
      select p.id, 'pending_essence',
             jsonb_build_object('essence_id', new.id, 'essence', new.nome,
                                'from_id', new.created_by, 'from', public.display_name(new.created_by))
      from public.profiles p
      where p.role = 'admin' and p.id is distinct from new.created_by;
  end if;
  return new;
end;
$$;

create trigger essences_notify_pending
  after insert on public.essences
  for each row execute function public.notify_pending_essence();

-- Essência aprovada ou rejeitada -> avisa quem cadastrou
create function public.notify_essence_decision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and new.created_by is not null
     and new.created_by is distinct from auth.uid() then
    insert into public.notifications (user_id, tipo, payload)
    values (
      new.created_by,
      case when new.status = 'approved' then 'essence_approved' else 'essence_rejected' end,
      jsonb_build_object('essence_id', new.id, 'essence', new.nome, 'motivo', new.motivo_rejeicao)
    );
  end if;
  return new;
end;
$$;

create trigger essences_notify_decision
  after update on public.essences
  for each row execute function public.notify_essence_decision();

-- Alguém avaliou uma essência que você recomendou para ela -> avisa quem recomendou
create function public.notify_recommended_reviewed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (user_id, tipo, payload)
    select distinct rc.from_user, 'recommended_reviewed',
           jsonb_build_object('essence_id', new.essence_id,
                              'essence', (select nome from public.essences where id = new.essence_id),
                              'from_id', new.user_id, 'from', public.display_name(new.user_id),
                              'nota', new.nota)
    from public.recommendations rc
    join public.recommendation_recipients rr on rr.recommendation_id = rc.id
    where rc.essence_id = new.essence_id
      and rr.to_user = new.user_id
      and rc.from_user <> new.user_id;
  return new;
end;
$$;

create trigger reviews_notify_recommender
  after insert on public.reviews
  for each row execute function public.notify_recommended_reviewed();

-- ---------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------
revoke execute on function public.set_top5(bigint[]) from public, anon;
revoke execute on function public.recommend(bigint, uuid[], text) from public, anon;
revoke execute on function public.display_name(uuid) from public, anon;
revoke execute on function public.recommendation_sender(bigint) from public, anon;
grant execute on function public.set_top5(bigint[]) to authenticated;
grant execute on function public.recommend(bigint, uuid[], text) to authenticated;
grant execute on function public.display_name(uuid) to authenticated;
grant execute on function public.recommendation_sender(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de perfil
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatar: enviar na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar: apagar da propria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
