-- =====================================================================
-- World Shisha — Mais conquistas
-- =====================================================================

insert into public.achievements (code, nome, descricao, icone, ordem) values
  ('avaliador_250',  'Lenda viva',              'Avaliou 250 essências',                                         '🐉', 13),
  ('pioneiro',       'Desbravador',             'Foi o primeiro a avaliar 5 essências',                          '🚩', 14),
  ('nota_maxima',    'Amor à primeira tragada', 'Deu nota 5 para uma essência',                                  '😍', 15),
  ('sincero',        'Sem papas na língua',     'Deu nota 1 ou menos para uma essência',                         '🗯️', 16),
  ('detalhista',     'Detalhista',              'Deu 10 notas com meia estrela',                                 '🔍', 17),
  ('maratonista',    'Maratonista',             'Fez 5 avaliações no mesmo dia',                                 '🏃', 18),
  ('coruja',         'Coruja',                  'Avaliou uma essência entre meia-noite e 5h da manhã',           '🦉', 19),
  ('sabadou',        'Sabadou',                 'Fez 10 avaliações em sábados',                                  '🎉', 20),
  ('fiel',           'Fiel à marca',            'Avaliou 10 essências da mesma marca',                           '💍', 21),
  ('volta_ao_mundo', 'Volta ao mundo',          'Avaliou essências de 15 marcas diferentes',                     '🌍', 22),
  ('arco_iris',      'Arco-íris',               'Avaliou ao menos uma essência de cada tag de sabor',            '🌈', 23),
  ('rei_das_frutas', 'Rei das frutas',          'Avaliou 10 essências frutadas, tropicais ou cítricas',          '🍉', 24),
  ('pinguim',        'Pinguim',                 'Avaliou 10 essências mentoladas ou geladas',                    '🐧', 25),
  ('formiguinha',    'Formiguinha',             'Avaliou 10 essências doces, cremosas ou de sobremesa',          '🐜', 26),
  ('bom_de_indicacao','Bom de indicação',       '5 recomendações suas ganharam nota 4 ou mais de quem recebeu',  '🎯', 27),
  ('popular',        'Popular',                 'Recebeu 10 recomendações',                                      '💌', 28),
  ('conector',       'Conector',                'Recomendou essências para 10 pessoas diferentes',               '🤝', 29),
  ('cartao_de_visita','Cartão de visita',       'Completou o perfil com foto, apelido e bio',                    '🪪', 30),
  ('veterano',       'Veterano',                'Faz parte da comunidade há 1 ano',                              '🎂', 31)
on conflict (code) do nothing;

create or replace function public.check_achievements(uid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  n_reviews int; n_obs int; n_brands int; n_tags int; n_all_tags int; n_approved int; n_recs int;
  n_influence int; n_good_influence int; n_top int; n_pioneer int; n_half int; max_day int;
  n_night int; n_saturday int; max_brand int; n_fruit int; n_cold int; n_sweet int;
  n_received int; n_people int; max_nota numeric; min_nota numeric; perfil_ok boolean; dias int;
begin
  if uid is null then return; end if;

  select count(*),
         count(*) filter (where coalesce(trim(observacao), '') <> ''),
         count(*) filter (where mod(nota, 1) <> 0),
         count(*) filter (where extract(hour from created_at at time zone tz) < 5),
         count(*) filter (where extract(isodow from created_at at time zone tz) = 6),
         max(nota), min(nota)
    into n_reviews, n_obs, n_half, n_night, n_saturday, max_nota, min_nota
    from public.reviews where user_id = uid;

  select coalesce(max(c), 0) into max_day from (
    select count(*) c from public.reviews where user_id = uid group by (created_at at time zone tz)::date
  ) d;

  select count(distinct e.brand_id), coalesce(max(per_brand), 0) into n_brands, max_brand from (
    select e.brand_id, count(*) over (partition by e.brand_id) per_brand
    from public.reviews r join public.essences e on e.id = r.essence_id where r.user_id = uid
  ) e;

  select count(distinct et.tag_id) into n_tags
    from public.reviews r join public.essence_tags et on et.essence_id = r.essence_id where r.user_id = uid;
  select count(*) into n_all_tags from public.tags;

  -- Avaliações por família de sabor (pelo nome da tag)
  select count(distinct r.id) filter (where t.nome in ('Frutado', 'Tropical', 'Cítrico')),
         count(distinct r.id) filter (where t.nome in ('Mentolado', 'Gelado')),
         count(distinct r.id) filter (where t.nome in ('Doce', 'Sobremesa', 'Cremoso'))
    into n_fruit, n_cold, n_sweet
    from public.reviews r
    join public.essence_tags et on et.essence_id = r.essence_id
    join public.tags t on t.id = et.tag_id
    where r.user_id = uid;

  -- Primeiro a avaliar a essência
  select count(*) into n_pioneer from public.reviews r
    where r.user_id = uid
      and not exists (select 1 from public.reviews r2 where r2.essence_id = r.essence_id and r2.created_at < r.created_at);

  select count(*) into n_approved from public.essences where created_by = uid and status = 'approved';
  select count(*) into n_recs from public.recommendations where from_user = uid;
  select count(distinct rr.to_user) into n_people
    from public.recommendations rc join public.recommendation_recipients rr on rr.recommendation_id = rc.id
    where rc.from_user = uid;
  select count(*), count(*) filter (where rv.nota >= 4) into n_influence, n_good_influence
    from public.recommendations rc
    join public.recommendation_recipients rr on rr.recommendation_id = rc.id
    join public.reviews rv on rv.essence_id = rc.essence_id and rv.user_id = rr.to_user
    where rc.from_user = uid;
  select count(*) into n_received from public.recommendation_recipients where to_user = uid;
  select count(*) into n_top from public.top5 where user_id = uid;

  select coalesce(avatar_url, '') <> '' and coalesce(trim(apelido), '') <> '' and coalesce(trim(bio), '') <> '',
         extract(day from now() - created_at)::int
    into perfil_ok, dias
    from public.profiles where id = uid;

  with earned(code) as (
    select c from (values
      ('primeira_avaliacao', n_reviews >= 1),
      ('avaliador_10',       n_reviews >= 10),
      ('avaliador_50',       n_reviews >= 50),
      ('avaliador_100',      n_reviews >= 100),
      ('avaliador_250',      n_reviews >= 250),
      ('critico',            n_obs >= 10),
      ('explorador',         n_brands >= 5),
      ('volta_ao_mundo',     n_brands >= 15),
      ('paladar_versatil',   n_tags >= 8),
      ('arco_iris',          n_all_tags > 0 and n_tags >= n_all_tags),
      ('colaborador',        n_approved >= 1),
      ('curador',            n_approved >= 10),
      ('boca_a_boca',        n_recs >= 1),
      ('influenciador',      n_influence >= 5),
      ('bom_de_indicacao',   n_good_influence >= 5),
      ('conector',           n_people >= 10),
      ('popular',            n_received >= 10),
      ('top5_completo',      n_top >= 5),
      ('pioneiro',           n_pioneer >= 5),
      ('nota_maxima',        coalesce(max_nota, 0) >= 5),
      ('sincero',            coalesce(min_nota, 5) <= 1),
      ('detalhista',         n_half >= 10),
      ('maratonista',        max_day >= 5),
      ('coruja',             n_night >= 1),
      ('sabadou',            n_saturday >= 10),
      ('fiel',               max_brand >= 10),
      ('rei_das_frutas',     n_fruit >= 10),
      ('pinguim',            n_cold >= 10),
      ('formiguinha',        n_sweet >= 10),
      ('cartao_de_visita',   coalesce(perfil_ok, false)),
      ('veterano',           coalesce(dias, 0) >= 365)
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

-- Perfil completo
create function public.achievements_on_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.avatar_url, new.apelido, new.bio) is distinct from (old.avatar_url, old.apelido, old.bio) then
    perform public.check_achievements(new.id);
  end if;
  return new;
end;
$$;
create trigger profiles_achievements
  after update on public.profiles
  for each row execute function public.achievements_on_profile();

-- Recebeu recomendação
create function public.achievements_on_recipient()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.check_achievements(new.to_user);
  return new;
end;
$$;
create trigger recommendation_recipients_achievements
  after insert on public.recommendation_recipients
  for each row execute function public.achievements_on_recipient();

revoke execute on function public.achievements_on_profile() from public, anon, authenticated;
revoke execute on function public.achievements_on_recipient() from public, anon, authenticated;

-- Concede o que os membros já conquistaram
select public.check_achievements(id) from public.profiles;
