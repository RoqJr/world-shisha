-- =====================================================================
-- World Shisha — Fase 3 (Extras): duplicados, conquistas, ping
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Detecção de duplicados: essências com nome parecido na mesma marca
-- (inclui pendentes de outras pessoas, mostrando só o nome)
-- ---------------------------------------------------------------------
create function public.normalize_name(t text)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))), '[^a-z0-9]+', ' ', 'g');
$$;

create function public.similar_essences(p_brand_id bigint, p_nome text, p_ignore_id bigint default null)
returns table (id bigint, nome text, status text)
language sql stable security definer set search_path = ''
as $$
  with q as (select trim(public.normalize_name(p_nome)) as n)
  select e.id, e.nome, e.status
  from public.essences e, q
  where e.brand_id = p_brand_id
    and e.status <> 'rejected'
    and e.id is distinct from p_ignore_id
    and length(q.n) >= 3
    and (
      extensions.similarity(public.normalize_name(e.nome), q.n) >= 0.35
      or replace(public.normalize_name(e.nome), ' ', '') like '%' || replace(q.n, ' ', '') || '%'
      or replace(q.n, ' ', '') like '%' || replace(public.normalize_name(e.nome), ' ', '') || '%'
    )
  order by extensions.similarity(public.normalize_name(e.nome), q.n) desc
  limit 5;
$$;

-- ---------------------------------------------------------------------
-- Conquistas
-- ---------------------------------------------------------------------
create table public.achievements (
  code       text primary key,
  nome       text not null,
  descricao  text not null,
  icone      text not null,
  ordem      int not null
);

create table public.user_achievements (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  code       text not null references public.achievements (code) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
revoke all on public.achievements, public.user_achievements from anon, authenticated;
grant select on public.achievements, public.user_achievements to authenticated;
create policy "todos veem conquistas" on public.achievements for select to authenticated using (true);
create policy "todos veem conquistas dos membros" on public.user_achievements for select to authenticated using (true);

insert into public.achievements (code, nome, descricao, icone, ordem) values
  ('primeira_avaliacao', 'Primeira tragada',      'Fez a primeira avaliação',                                 '💨', 1),
  ('avaliador_10',       'Degustador',            'Avaliou 10 essências',                                     '🥈', 2),
  ('avaliador_50',       'Sommelier',             'Avaliou 50 essências',                                     '🥇', 3),
  ('avaliador_100',      'Mestre do narguilé',    'Avaliou 100 essências',                                    '👑', 4),
  ('critico',            'Crítico',               'Escreveu observação em 10 avaliações',                     '✍️', 5),
  ('explorador',         'Explorador',            'Avaliou essências de 5 marcas diferentes',                 '🧭', 6),
  ('paladar_versatil',   'Paladar versátil',      'Avaliou essências de 8 tags de sabor diferentes',          '🎨', 7),
  ('colaborador',        'Colaborador',           'Teve a primeira essência cadastrada aprovada',             '📦', 8),
  ('curador',            'Curador',               'Teve 10 essências cadastradas aprovadas',                  '🗂️', 9),
  ('boca_a_boca',        'Boca a boca',           'Fez a primeira recomendação',                              '📣', 10),
  ('influenciador',      'Influenciador',         '5 recomendações suas foram avaliadas por quem recebeu',    '⭐', 11),
  ('top5_completo',      'Top 5 montado',         'Montou o Top 5 completo',                                  '🏆', 12);

-- Confere e concede as conquistas de um membro; avisa as novas no sino
create function public.check_achievements(uid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  n_reviews int; n_obs int; n_brands int; n_tags int; n_approved int; n_recs int; n_influence int; n_top int;
begin
  if uid is null then return; end if;

  select count(*), count(*) filter (where coalesce(trim(observacao), '') <> '')
    into n_reviews, n_obs from public.reviews where user_id = uid;
  select count(distinct e.brand_id) into n_brands
    from public.reviews r join public.essences e on e.id = r.essence_id where r.user_id = uid;
  select count(distinct et.tag_id) into n_tags
    from public.reviews r join public.essence_tags et on et.essence_id = r.essence_id where r.user_id = uid;
  select count(*) into n_approved from public.essences where created_by = uid and status = 'approved';
  select count(*) into n_recs from public.recommendations where from_user = uid;
  select count(*) into n_influence
    from public.recommendations rc
    join public.recommendation_recipients rr on rr.recommendation_id = rc.id
    join public.reviews rv on rv.essence_id = rc.essence_id and rv.user_id = rr.to_user
    where rc.from_user = uid;
  select count(*) into n_top from public.top5 where user_id = uid;

  with earned(code) as (
    select c from (values
      ('primeira_avaliacao', n_reviews >= 1),
      ('avaliador_10',       n_reviews >= 10),
      ('avaliador_50',       n_reviews >= 50),
      ('avaliador_100',      n_reviews >= 100),
      ('critico',            n_obs >= 10),
      ('explorador',         n_brands >= 5),
      ('paladar_versatil',   n_tags >= 8),
      ('colaborador',        n_approved >= 1),
      ('curador',            n_approved >= 10),
      ('boca_a_boca',        n_recs >= 1),
      ('influenciador',      n_influence >= 5),
      ('top5_completo',      n_top >= 5)
    ) as v(c, ok) where ok
  ),
  novos as (
    insert into public.user_achievements (user_id, code)
    select uid, code from earned
    on conflict do nothing
    returning code
  )
  insert into public.notifications (user_id, tipo, payload)
  select uid, 'achievement', jsonb_build_object('code', a.code, 'nome', a.nome, 'icone', a.icone)
  from novos join public.achievements a on a.code = novos.code;
end;
$$;
revoke execute on function public.check_achievements(uuid) from public, anon, authenticated;

-- Gatilhos que conferem conquistas
create function public.achievements_on_review()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  perform public.check_achievements(new.user_id);
  -- quem recomendou esta essência para o avaliador pode ganhar "Influenciador"
  for r in
    select distinct rc.from_user from public.recommendations rc
    join public.recommendation_recipients rr on rr.recommendation_id = rc.id
    where rc.essence_id = new.essence_id and rr.to_user = new.user_id
  loop
    perform public.check_achievements(r.from_user);
  end loop;
  return new;
end;
$$;
create trigger reviews_achievements
  after insert or update on public.reviews
  for each row execute function public.achievements_on_review();

create function public.achievements_on_essence()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform public.check_achievements(new.created_by);
  end if;
  return new;
end;
$$;
create trigger essences_achievements
  after insert or update on public.essences
  for each row execute function public.achievements_on_essence();

create function public.achievements_on_recommendation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_achievements(new.from_user);
  return new;
end;
$$;
create trigger recommendations_achievements
  after insert on public.recommendations
  for each row execute function public.achievements_on_recommendation();

create function public.achievements_on_top5()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.posicao = 5 then perform public.check_achievements(new.user_id); end if;
  return new;
end;
$$;
create trigger top5_achievements
  after insert on public.top5
  for each row execute function public.achievements_on_top5();

-- Permissões das funções novas
revoke execute on function public.similar_essences(bigint, text, bigint) from public, anon;
grant execute on function public.similar_essences(bigint, text, bigint) to authenticated;
revoke execute on function public.achievements_on_review() from public, anon, authenticated;
revoke execute on function public.achievements_on_essence() from public, anon, authenticated;
revoke execute on function public.achievements_on_recommendation() from public, anon, authenticated;
revoke execute on function public.achievements_on_top5() from public, anon, authenticated;

-- Concede o que os membros atuais já conquistaram
select public.check_achievements(id) from public.profiles;

-- ---------------------------------------------------------------------
-- Ping: chamado por uma tarefa automática para o projeto não pausar
-- ---------------------------------------------------------------------
create function public.ping()
returns int
language sql stable set search_path = ''
as $$ select 1; $$;
revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
