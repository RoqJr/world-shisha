// Edge Function "invite-user": só admins podem criar usuários.
// Modos:
//   invite   -> envia e-mail de convite; a pessoa define a própria senha
//   password -> cria com senha provisória; a pessoa troca no primeiro acesso
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function translate(msg: string) {
  if (/already been registered|already registered|already exists/i.test(msg)) return 'Já existe um usuário com este e-mail.'
  if (/rate limit/i.test(msg)) return 'Limite de envio de e-mails atingido. Tente mais tarde ou use a senha provisória.'
  if (/sending|smtp|email/i.test(msg))
    return 'Não foi possível enviar o e-mail de convite. Confira a configuração de e-mail (SMTP) no Supabase ou use a senha provisória.'
  return msg
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Quem está chamando precisa estar logado e ser admin
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth.user) return json({ error: 'Sessão expirada. Faça login novamente.' }, 401)

  const { data: caller } = await admin.from('profiles').select('role').eq('id', auth.user.id).single()
  if (caller?.role !== 'admin') return json({ error: 'Apenas administradores podem criar usuários.' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Dados inválidos.' }, 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const nome = String(body.nome ?? '').trim()
  const role = body.role === 'admin' ? 'admin' : 'user'
  const mode = body.mode === 'password' ? 'password' : 'invite'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
  if (!nome) return json({ error: 'Informe o nome.' }, 400)

  let userId: string
  if (mode === 'invite') {
    const origin = req.headers.get('origin')
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: origin ? `${origin}/definir-senha` : undefined,
    })
    if (error) return json({ error: translate(error.message) }, 400)
    userId = data.user.id
  } else {
    const password = String(body.password ?? '')
    if (password.length < 8) return json({ error: 'A senha provisória precisa ter pelo menos 8 caracteres.' }, 400)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, must_change_password: true },
    })
    if (error) return json({ error: translate(error.message) }, 400)
    userId = data.user.id
  }

  if (role === 'admin') {
    const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('id', userId)
    if (error) return json({ error: 'Usuário criado, mas não foi possível torná-lo admin: ' + error.message }, 500)
  }

  return json({ ok: true })
})
