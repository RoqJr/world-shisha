import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import Avatar from '../components/Avatar'
import { Alert, Button, Field } from '../components/ui'
import { useAuth, type Profile } from '../lib/auth'
import { callFunction } from '../lib/functions'
import { errorMessage, supabase } from '../lib/supabase'

type Mode = 'invite' | 'password'

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default function Members() {
  const { isAdmin, session } = useAuth()
  const [members, setMembers] = useState<Profile[] | null>(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = normalize(search.trim())
  const visible = (members ?? []).filter((p) => !q || normalize(`${p.nome} ${p.apelido ?? ''}`).includes(q))

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setMembers((data ?? []) as Profile[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function act(p: Profile, action: 'admin' | 'user' | 'block' | 'unblock' | 'delete') {
    const name = p.apelido || p.nome
    const questions = {
      admin: `Tornar ${name} administrador?`,
      user: `Remover o acesso de administrador de ${name}?`,
      block: `Bloquear ${name}? A pessoa não conseguirá mais entrar, mas as avaliações dela continuam no app. Dá para desbloquear depois.`,
      unblock: `Desbloquear ${name}? A pessoa volta a conseguir entrar.`,
      delete: `EXCLUIR ${name} definitivamente?\n\nAs avaliações, o Top 5, as recomendações e as notificações dessa pessoa serão apagados. As essências que ela cadastrou continuam no app.\n\nIsso não pode ser desfeito.`,
    }
    if (!confirm(questions[action])) return
    setBusy(true)
    setError('')
    let err: string | null = null
    if (action === 'admin' || action === 'user') {
      const { error } = await supabase.from('profiles').update({ role: action }).eq('id', p.id)
      if (error) err = errorMessage(error)
    } else {
      err = await callFunction('manage-user', { user_id: p.id, action })
    }
    setBusy(false)
    if (err) return setError(err)
    setOpenId(null)
    await load()
  }

  const smallBtn = 'px-3! py-2! text-xs!'

  return (
    <div className="flex flex-col gap-8">
      {isAdmin && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Novo membro</h1>
          <InviteForm onCreated={load} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className={isAdmin ? 'text-lg font-semibold' : 'text-2xl font-bold tracking-tight'}>Membros {members && <span className="text-neutral-500">({members.length})</span>}</h2>
        {error && <Alert kind="error">{error}</Alert>}
        {members === null && <p className="text-sm text-neutral-500">Carregando…</p>}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar membro por nome ou apelido…"
          className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-current dark:border-neutral-700"
        />
        {members && visible.length === 0 && <p className="text-sm text-neutral-500">Nenhum membro encontrado.</p>}
        {visible.map((p) => {
          const canManage = isAdmin && p.id !== session?.user.id
          const open = openId === p.id
          return (
            <div key={p.id} className={`rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800 ${p.ativo ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between gap-3">
                <Link to={`/perfil/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar url={p.avatar_url} name={p.apelido || p.nome} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.apelido || p.nome}</p>
                    <p className="text-xs text-neutral-500">
                      {p.role === 'admin' ? 'Administrador' : 'Membro'}
                      {!p.ativo && <span className="ml-1 font-semibold text-red-600 dark:text-red-400">· Bloqueado</span>}
                    </p>
                  </div>
                </Link>
                {canManage && (
                  <button
                    onClick={() => setOpenId(open ? null : p.id)}
                    aria-label="Gerenciar membro"
                    aria-expanded={open}
                    className="rounded-xl border border-neutral-300 px-3 py-1.5 text-lg leading-none dark:border-neutral-700"
                  >
                    ⋯
                  </button>
                )}
              </div>
              {canManage && open && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                  {p.role === 'admin' ? (
                    <Button variant="ghost" disabled={busy} onClick={() => act(p, 'user')} className={smallBtn}>Remover admin</Button>
                  ) : (
                    <Button variant="ghost" disabled={busy} onClick={() => act(p, 'admin')} className={smallBtn}>Tornar admin</Button>
                  )}
                  {p.ativo ? (
                    <Button variant="ghost" disabled={busy} onClick={() => act(p, 'block')} className={smallBtn}>Bloquear</Button>
                  ) : (
                    <Button variant="ghost" disabled={busy} onClick={() => act(p, 'unblock')} className={smallBtn}>Desbloquear</Button>
                  )}
                  <Button variant="ghost" disabled={busy} onClick={() => act(p, 'delete')} className={`${smallBtn} text-red-600! dark:text-red-400!`}>
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}

function InviteForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Profile['role']>('user')
  const [mode, setMode] = useState<Mode>('invite')
  const [password, setPassword] = useState(randomPassword)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { nome, email, role, mode, password },
    })
    setBusy(false)

    if (error) {
      let msg = errorMessage(error)
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null)
        if (body?.error) msg = body.error
      }
      return setError(msg)
    }
    if (data?.error) return setError(data.error)

    setSuccess(
      mode === 'invite'
        ? `Convite enviado para ${email}. A pessoa recebe um link para criar a senha.`
        : `Usuário criado! Envie para ${nome}: e-mail ${email} e senha provisória ${password}. A senha será trocada no primeiro acesso.`,
    )
    setNome('')
    setEmail('')
    setRole('user')
    setPassword(randomPassword())
    await onCreated()
  }

  const radio = (on: boolean) =>
    `flex-1 rounded-xl border px-3 py-2.5 text-center text-sm ${
      on ? 'border-current bg-black font-semibold text-white dark:bg-white dark:text-black' : 'border-neutral-300 dark:border-neutral-700'
    }`

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Tipo
        <div className="flex gap-2">
          <button type="button" className={radio(role === 'user')} onClick={() => setRole('user')}>Membro</button>
          <button type="button" className={radio(role === 'admin')} onClick={() => setRole('admin')}>Administrador</button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Como a pessoa vai entrar
        <div className="flex gap-2">
          <button type="button" className={radio(mode === 'invite')} onClick={() => setMode('invite')}>Convite por e-mail</button>
          <button type="button" className={radio(mode === 'password')} onClick={() => setMode('password')}>Senha provisória</button>
        </div>
        <p className="font-normal text-neutral-500">
          {mode === 'invite'
            ? 'Ela recebe um e-mail com um link para criar a própria senha.'
            : 'Você passa a senha para a pessoa (ex.: pelo WhatsApp). No primeiro acesso ela cria uma senha nova.'}
        </p>
      </div>

      {mode === 'password' && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Senha provisória" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </div>
          <Button type="button" variant="ghost" onClick={() => setPassword(randomPassword())}>Gerar</Button>
        </div>
      )}

      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <Button type="submit" disabled={busy}>{busy ? 'Criando…' : mode === 'invite' ? 'Enviar convite' : 'Criar usuário'}</Button>
    </form>
  )
}
