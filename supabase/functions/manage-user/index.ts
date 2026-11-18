// Edge Function "manage-user": só admins podem bloquear, desbloquear ou excluir membros.
//   block   -> impede o login (reversível); avaliações e dados são mantidos
//   unblock -> libera o login de novo
//   delete  -> exclui a conta; avaliações, Top 5, recomendações e notificações
//              da pessoa são apagados; as essências cadastradas continuam
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth.user) return json({ error: 'Sessão expirada. Faça login novamente.' }, 401)

  const { data: caller } = await admin.from('profiles').select('role').eq('id', auth.user.id).single()
  if (caller?.role !== 'admin') return json({ error: 'Apenas administradores podem gerenciar membros.' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Dados inválidos.' }, 400)
  }

  const userId = String(body.user_id ?? '')
  const action = String(body.action ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Membro inválido.' }, 400)
  if (userId === auth.user.id) return json({ error: 'Você não pode fazer isso com a sua própria conta.' }, 400)

  if (action === 'block' || action === 'unblock') {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: action === 'block' ? '876000h' : 'none',
    })
    if (error) return json({ error: error.message }, 400)
    const p = await admin.from('profiles').update({ ativo: action === 'unblock' }).eq('id', userId)
    if (p.error) return json({ error: p.error.message }, 500)
    return json({ ok: true })
  }

  if (action === 'delete') {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Ação desconhecida.' }, 400)
})
