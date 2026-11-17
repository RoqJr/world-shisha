# World Shisha — Plano do Projeto

App web (PWA, mobile-first) para uma comunidade fechada avaliar essências de narguilé.

## Stack (100% gratuita)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS, instalável como PWA
- **Banco, login, fotos e regras:** Supabase (PostgreSQL, Auth, Storage, Row Level Security)
- **Lógica privilegiada:** Supabase Edge Functions (convite de usuários)
- **Hospedagem do frontend:** Vercel, com deploy automático a cada push
- **Código:** GitHub
- **E-mails:** SMTP gratuito (Resend ou Brevo) ligado ao Supabase
- **Idioma:** Português
- **Visual:** preto e branco, com alternância entre tema claro e escuro

## Regras definidas

### Login e usuários
- Login com e-mail e senha; recuperação de senha por e-mail
- Só admins criam usuários, por **convite por e-mail** (a pessoa define a própria senha)
- Papéis: `user` e `admin`
- Escala esperada: 20 a 200 usuários

### Essências
- Campos: foto, marca, nome, descrição do sabor (opcional), tags de sabor
- **Marcas:** lista fixa; o usuário pode sugerir uma nova, que vai para aprovação junto com a essência
- Todo cadastro feito por usuário comum fica **pendente** até aprovação
- Cadastro feito por admin é **aprovado automaticamente**
- O admin pode **editar** antes de aprovar
- Na rejeição, o admin informa um **motivo**, enviado a quem cadastrou
- **Detecção de duplicados:** avisa se já existe essência com nome parecido na mesma marca
- A foto é comprimida no celular antes do envio (cerca de 200 KB)

### Avaliações
- **Uma avaliação por usuário por essência**, que pode ser editada
- Nota de 1 a 5 com **meia estrela** (passos de 0,5), mais observação opcional

### Recomendações
- Enviada para **uma ou várias pessoas**
- **Mensagem opcional**

### Perfil (visível a todos os membros)
- Foto, apelido e bio
- Avaliações do usuário
- Top 5 essências (escolhidas e ordenadas pelo usuário)
- Estatísticas: total de avaliações, média de notas, marca mais avaliada, tag preferida
- Conquistas (badges)

### Notificações (somente dentro do app: sino com contador)
- Recebeu uma recomendação
- Admins: nova essência pendente de aprovação
- Sua essência foi aprovada ou rejeitada (com o motivo)
- Alguém avaliou uma essência que você recomendou

### Extras
- Tags de sabor e filtros (frutado, cítrico, mentolado, doce, gelado, floral, bebida, sobremesa…)
- Rankings: mais bem avaliadas, mais avaliadas, em alta na semana, melhores por marca

## Modelo de dados (tabelas)
- `profiles`: id, nome, apelido, avatar_url, bio, role, created_at
- `brands`: id, nome, status (pending, approved), created_by
- `tags`: id, nome
- `essences`: id, brand_id, nome, descricao, foto_url, status (pending, approved, rejected), motivo_rejeicao, created_by, approved_by, created_at
- `essence_tags`: essence_id, tag_id
- `reviews`: id, user_id, essence_id, nota (numeric 0,5–5), observacao, created_at, updated_at — chave única (user_id, essence_id)
- `top5`: user_id, essence_id, posicao (1–5)
- `recommendations`: id, from_user, essence_id, mensagem, created_at
- `recommendation_recipients`: recommendation_id, to_user
- `notifications`: id, user_id, tipo, payload, lida, created_at
- `achievements` e `user_achievements`: conquistas

## Fases
0. **Configuração:** instalar Node.js e Git; criar contas no GitHub, Supabase e Vercel; criar o repositório e o projeto base; fazer o primeiro deploy
1. **MVP:** login e recuperação de senha, tema claro/escuro, convite de usuários, marcas, cadastro de essência com foto, painel de aprovação, listagem, busca e filtros por tag, avaliações
2. **Social:** perfil, Top 5, recomendações, notificações
3. **Extras:** rankings, estatísticas, conquistas, detecção de duplicados

## Atenção (plano gratuito do Supabase)
- O projeto é pausado depois de 7 dias sem acesso. Podemos criar um ping automático para manter ativo.
- 500 MB de banco e 1 GB de fotos são suficientes para a escala prevista.
