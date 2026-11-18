import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { EssencePhoto } from '../components/EssenceCard'
import { Stars, StarInput } from '../components/Stars'
import StatusBadge from '../components/StatusBadge'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../lib/auth'
import { ESSENCE_SELECT, formatNota, useCatalog, type Essence } from '../lib/data'
import { errorMessage, supabase } from '../lib/supabase'

type Review = {
  id: number
  user_id: string
  nota: number
  observacao: string | null
  updated_at: string
  profile: { nome: string; apelido: string | null; avatar_url: string | null } | null
}

export default function EssenceDetail() {
  const { id } = useParams()
  const { session } = useAuth()
  const { tags } = useCatalog()
  const [essence, setEssence] = useState<Essence | null | undefined>(undefined)
  const [reviews, setReviews] = useState<Review[]>([])

  const userId = session!.user.id

  const load = useCallback(async () => {
    const [e, r] = await Promise.all([
      supabase.from('essences').select(ESSENCE_SELECT).eq('id', Number(id)).maybeSingle(),
      supabase
        .from('reviews')
        .select('id, user_id, nota, observacao, updated_at, profile:profiles(nome, apelido, avatar_url)')
        .eq('essence_id', Number(id))
        .order('updated_at', { ascending: false }),
    ])
    setEssence((e.data ?? null) as unknown as Essence | null)
    setReviews((r.data ?? []) as unknown as Review[])
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (essence === undefined) return <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>
  if (essence === null)
    return (
      <div className="py-10 text-center">
        <p>Essência não encontrada.</p>
        <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">Voltar</Link>
      </div>
    )

  const myReview = reviews.find((r) => r.user_id === userId)
  const media = reviews.length ? reviews.reduce((s, r) => s + Number(r.nota), 0) / reviews.length : 0
  const tagNames = essence.essence_tags.map((et) => tags.find((t) => t.id === et.tag_id)?.nome).filter(Boolean)

  return (
    <article className="flex flex-col gap-6">
      <Link to="/" className="text-sm text-neutral-500">← Essências</Link>

      <div className="flex flex-col gap-5 sm:flex-row">
        <EssencePhoto url={essence.foto_url} className="rounded-2xl sm:w-64" />
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-sm uppercase tracking-wide text-neutral-500">{essence.brand?.nome}</p>
          <h1 className="text-3xl font-bold tracking-tight">{essence.nome}</h1>
          {essence.status !== 'approved' && (
            <div>
              <StatusBadge status={essence.status} />
            </div>
          )}
          {essence.status === 'rejected' && essence.motivo_rejeicao && (
            <Alert kind="error">Motivo: {essence.motivo_rejeicao}</Alert>
          )}
          {essence.status === 'approved' && (
            <div className="flex items-center gap-2">
              <Stars value={media} size={20} />
              <span className="font-semibold tabular-nums">{reviews.length ? formatNota(media) : '–'}</span>
              <span className="text-sm text-neutral-500">
                ({reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'})
              </span>
            </div>
          )}
          {tagNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagNames.map((n) => (
                <span key={n} className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs dark:border-neutral-700">{n}</span>
              ))}
            </div>
          )}
          {essence.descricao && <p className="whitespace-pre-line text-neutral-700 dark:text-neutral-300">{essence.descricao}</p>}
        </div>
      </div>

      {essence.status === 'approved' && (
        <>
          <ReviewForm key={myReview?.id ?? 'new'} essenceId={essence.id} userId={userId} existing={myReview} onSaved={load} />
          <RecommendPanel essenceId={essence.id} userId={userId} />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Avaliações</h2>
            {reviews.length === 0 && <p className="text-sm text-neutral-500">Ninguém avaliou ainda. Seja o primeiro!</p>}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/perfil/${r.user_id}`} className="flex min-w-0 items-center gap-2 font-medium">
                    <Avatar url={r.profile?.avatar_url} name={r.profile?.apelido || r.profile?.nome || 'Membro'} size={28} />
                    <span className="truncate">{r.profile?.apelido || r.profile?.nome || 'Membro'}</span>
                  </Link>
                  <span className="flex items-center gap-1.5 text-sm tabular-nums">
                    <Stars value={Number(r.nota)} size={14} /> {formatNota(Number(r.nota))}
                  </span>
                </div>
                {r.observacao && <p className="mt-2 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">{r.observacao}</p>}
                <p className="mt-2 text-xs text-neutral-500">{new Date(r.updated_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </article>
  )
}

function ReviewForm({
  essenceId,
  userId,
  existing,
  onSaved,
}: {
  essenceId: number
  userId: string
  existing?: Review
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState(!existing)
  const [nota, setNota] = useState(existing ? Number(existing.nota) : 0)
  const [observacao, setObservacao] = useState(existing?.observacao ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!nota) return setError('Escolha uma nota.')
    setBusy(true)
    setError('')
    const { error } = await supabase
      .from('reviews')
      .upsert({ user_id: userId, essence_id: essenceId, nota, observacao: observacao.trim() || null }, { onConflict: 'user_id,essence_id' })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    setEditing(false)
    await onSaved()
  }

  async function remove() {
    if (!existing || !confirm('Apagar sua avaliação?')) return
    const { error } = await supabase.from('reviews').delete().eq('id', existing.id)
    if (error) return setError(errorMessage(error))
    await onSaved()
  }

  if (!editing && existing) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <p className="text-sm text-neutral-500">Sua nota</p>
          <p className="flex items-center gap-2 font-semibold tabular-nums">
            <Stars value={Number(existing.nota)} size={18} /> {formatNota(Number(existing.nota))}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
          <Button variant="ghost" onClick={remove}>Apagar</Button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{existing ? 'Editar sua avaliação' : 'Avaliar'}</h2>
      <StarInput value={nota} onChange={setNota} />
      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        rows={3}
        placeholder="Observação (opcional)"
        className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-current dark:border-neutral-700"
      />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy} className="flex-1">{busy ? 'Salvando…' : 'Salvar avaliação'}</Button>
        {existing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
      </div>
    </form>
  )
}

type Member = { id: string; nome: string; apelido: string | null; avatar_url: string | null }

function RecommendPanel({ essenceId, userId }: { essenceId: number; userId: string }) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  async function openPanel() {
    setOpen(true)
    setSent('')
    if (members.length) return
    const { data } = await supabase.from('profiles').select('id, nome, apelido, avatar_url').neq('id', userId).order('nome')
    setMembers((data ?? []) as Member[])
  }

  const label = (m: Member) => m.apelido || m.nome
  const q = search.trim().toLowerCase()
  const visible = q ? members.filter((m) => `${m.nome} ${m.apelido ?? ''}`.toLowerCase().includes(q)) : members

  async function send() {
    if (selected.length === 0) return setError('Escolha pelo menos uma pessoa.')
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('recommend', { p_essence_id: essenceId, p_to_users: selected, p_mensagem: mensagem })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    const names = members.filter((m) => selected.includes(m.id)).map(label)
    setSent(`Recomendação enviada para ${names.join(', ')}!`)
    setSelected([])
    setMensagem('')
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        {sent && <Alert kind="success">{sent}</Alert>}
        <Button variant="ghost" onClick={openPanel}>Recomendar para alguém</Button>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Recomendar</h2>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar membro…"
        className="rounded-xl border border-neutral-300 bg-transparent px-4 py-2.5 outline-none focus:border-current dark:border-neutral-700"
      />
      <div className="flex max-h-64 flex-col overflow-y-auto">
        {members.length === 0 && <p className="py-2 text-sm text-neutral-500">Nenhum outro membro ainda.</p>}
        {visible.map((m) => {
          const on = selected.includes(m.id)
          return (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900">
              <input
                type="checkbox"
                checked={on}
                onChange={() => setSelected((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                className="size-4 accent-black dark:accent-white"
              />
              <Avatar url={m.avatar_url} name={label(m)} size={28} />
              <span className="truncate text-sm">{label(m)}</span>
            </label>
          )
        })}
      </div>
      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={2}
        placeholder="Mensagem (opcional)"
        className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-current dark:border-neutral-700"
      />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-3">
        <Button onClick={send} disabled={busy} className="flex-1">
          {busy ? 'Enviando…' : selected.length > 1 ? `Enviar para ${selected.length} pessoas` : 'Enviar'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </section>
  )
}
