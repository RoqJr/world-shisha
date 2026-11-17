-- =====================================================================
-- World Shisha — Fase 1 (MVP): tabelas, regras de segurança e fotos
-- Rodar UMA vez no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfis (um por usuário do Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null,
  apelido     text,
  avatar_url  text,
  bio         text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- Retorna true se o usuário logado é admin
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Cria o perfil automaticamente quando um usuário é criado/convidado
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que um usuário comum mude o próprio papel
create function public.guard_profile_role()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Apenas admins podem alterar papéis';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------
-- Marcas
-- ---------------------------------------------------------------------
create table public.brands (
  id          bigint generated always as identity primary key,
  nome        text not null check (length(trim(nome)) > 0),
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create unique index brands_nome_unique on public.brands (lower(trim(nome)));

-- ---------------------------------------------------------------------
-- Tags de sabor
-- ---------------------------------------------------------------------
create table public.tags (
  id    bigint generated always as identity primary key,
  nome  text not null unique
);

-- ---------------------------------------------------------------------
-- Essências
-- ---------------------------------------------------------------------
create table public.essences (
  id               bigint generated always as identity primary key,
  brand_id         bigint not null references public.brands (id),
  nome             text not null check (length(trim(nome)) > 0),
  descricao        text,
  foto_url         text,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  motivo_rejeicao  text,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index essences_status_idx on public.essences (status);
create index essences_brand_idx on public.essences (brand_id);
-- Não deixa cadastrar o mesmo nome duas vezes na mesma marca (rejeitadas não contam)
create unique index essences_brand_nome_unique
  on public.essences (brand_id, lower(trim(nome)))
  where status <> 'rejected';

create table public.essence_tags (
  essence_id  bigint not null references public.essences (id) on delete cascade,
  tag_id      bigint not null references public.tags (id) on delete cascade,
  primary key (essence_id, tag_id)
);
create index essence_tags_tag_idx on public.essence_tags (tag_id);

-- ---------------------------------------------------------------------
-- Avaliações (uma por usuário por essência, nota 0,5 a 5 em passos de 0,5)
-- ---------------------------------------------------------------------
create table public.reviews (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  essence_id  bigint not null references public.essences (id) on delete cascade,
  nota        numeric(2, 1) not null check (nota between 0.5 and 5 and mod(nota * 2, 1) = 0),
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, essence_id)
);
create index reviews_essence_idx on public.reviews (essence_id);

-- Média e total de avaliações por essência
create view public.essence_ratings
with (security_invoker = true) as
  select essence_id, round(avg(nota), 2) as media, count(*)::int as total
  from public.reviews
  group by essence_id;

-- ---------------------------------------------------------------------
-- Regras automáticas (status, aprovação, datas)
-- ---------------------------------------------------------------------

-- Marca: admin cadastra aprovada; usuário comum cadastra pendente
create function public.brands_before_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL Editor / servidor
  new.created_by := auth.uid();
  new.status := case when public.is_admin() then 'approved' else 'pending' end;
  return new;
end;
$$;

create trigger brands_before_insert
  before insert on public.brands
  for each row execute function public.brands_before_insert();

-- Essência: admin cadastra aprovada; usuário comum cadastra pendente
create function public.essences_before_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;
  new.created_by := auth.uid();
  new.motivo_rejeicao := null;
  if public.is_admin() then
    new.status := 'approved';
    new.approved_by := auth.uid();
  else
    new.status := 'pending';
    new.approved_by := null;
  end if;
  return new;
end;
$$;

create trigger essences_before_insert
  before insert on public.essences
  for each row execute function public.essences_before_insert();

-- Essência: ao aprovar, aprova a marca sugerida junto; ao rejeitar, exige motivo
create function public.essences_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
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

create trigger essences_before_update
  before update on public.essences
  for each row execute function public.essences_before_update();

-- Avaliação: atualiza a data de edição
create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Permissões e Row Level Security
-- Só usuários logados acessam qualquer coisa.
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.brands, public.tags, public.essences,
              public.essence_tags, public.reviews, public.essence_ratings from anon;
grant select, insert, update, delete on public.profiles, public.brands, public.tags,
              public.essences, public.essence_tags, public.reviews to authenticated;
grant select on public.essence_ratings to authenticated;

alter table public.profiles     enable row level security;
alter table public.brands       enable row level security;
alter table public.tags         enable row level security;
alter table public.essences     enable row level security;
alter table public.essence_tags enable row level security;
alter table public.reviews      enable row level security;

-- Perfis: todos os membros veem; cada um edita o seu; admin edita qualquer um
create policy "membros veem perfis" on public.profiles
  for select to authenticated using (true);
create policy "edita o proprio perfil ou admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- Marcas: aprovadas para todos; pendentes só para quem sugeriu e admins
create policy "ver marcas" on public.brands
  for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_admin()));
create policy "sugerir marca" on public.brands
  for insert to authenticated with check (true);
create policy "admin edita marcas" on public.brands
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga marcas" on public.brands
  for delete to authenticated using ((select public.is_admin()));

-- Tags: todos veem; só admin altera
create policy "ver tags" on public.tags
  for select to authenticated using (true);
create policy "admin cria tags" on public.tags
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin edita tags" on public.tags
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga tags" on public.tags
  for delete to authenticated using ((select public.is_admin()));

-- Essências: aprovadas para todos; pendentes/rejeitadas só para o autor e admins
create policy "ver essencias" on public.essences
  for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_admin()));
create policy "cadastrar essencia" on public.essences
  for insert to authenticated with check (true);
create policy "admin edita essencias" on public.essences
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin ou autor (nao aprovada) apaga" on public.essences
  for delete to authenticated
  using ((select public.is_admin()) or (created_by = (select auth.uid()) and status <> 'approved'));

-- Tags da essência: segue a visibilidade da essência; autor mexe enquanto pendente
create policy "ver tags da essencia" on public.essence_tags
  for select to authenticated
  using (exists (select 1 from public.essences e where e.id = essence_id));
create policy "adicionar tag na essencia" on public.essence_tags
  for insert to authenticated
  with check (exists (
    select 1 from public.essences e
    where e.id = essence_id
      and ((select public.is_admin()) or (e.created_by = (select auth.uid()) and e.status = 'pending'))
  ));
create policy "remover tag da essencia" on public.essence_tags
  for delete to authenticated
  using (exists (
    select 1 from public.essences e
    where e.id = essence_id
      and ((select public.is_admin()) or (e.created_by = (select auth.uid()) and e.status = 'pending'))
  ));

-- Avaliações: todos veem; cada um cria/edita/apaga a sua, só em essência aprovada
create policy "ver avaliacoes" on public.reviews
  for select to authenticated using (true);
create policy "avaliar essencia aprovada" on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.essences e where e.id = essence_id and e.status = 'approved')
  );
create policy "editar a propria avaliacao" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "apagar a propria avaliacao" on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Fotos (Storage): bucket público para leitura; cada usuário envia na sua pasta
-- Caminho do arquivo: <id do usuário>/<nome do arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('essences', 'essences', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "enviar foto na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'essences' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "apagar foto propria ou admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'essences'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ---------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------
insert into public.tags (nome) values
  ('Frutado'), ('Cítrico'), ('Mentolado'), ('Doce'), ('Gelado'), ('Floral'),
  ('Bebida'), ('Sobremesa'), ('Tropical'), ('Especiarias'), ('Herbal'), ('Cremoso');

insert into public.brands (nome, status) values
  ('Adalya', 'approved'), ('Al Fakher', 'approved'), ('Darkside', 'approved'),
  ('Fumari', 'approved'), ('Nay', 'approved'), ('Starbuzz', 'approved'),
  ('Tangiers', 'approved'), ('Ziggy', 'approved'), ('Zomo', 'approved');
