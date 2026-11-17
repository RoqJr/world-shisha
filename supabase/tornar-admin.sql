-- Torna um usuário admin. Troque o e-mail e rode no SQL Editor do Supabase.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'SEU-EMAIL-AQUI');

-- Confere o resultado
select p.nome, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id;
