import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { EssencePhoto } from '../components/EssenceCard'
import { Stars } from '../components/Stars'
import { useAuth } from '../lib/auth'
import { formatNota } from '../lib/data'
import { timeAgo } from '../lib/notifications'
import { supabase } from '../lib/supabase'

type Person = { nome: string; apelido: string | null; avatar_url: string | null }
type EssenceLite = { id: number; nome: string; foto_url: string | null; brand: { nome: string } | null }

type FeedItem =
  | { kind: 'review'; at: string; key: string; userId: string; person: Person | null; essence: EssenceLite | null; nota: number; observacao: string | null }
  | { kind: 'essence'; at: string; key: string; userId: string | null; person: Person | null; essence: EssenceLite }
  | { kind: 'achievement'; at: string; key: string; userId: string; person: Person | null; nome: string; icone: string; descricao: string }
  | { kind: 'member'; at: string; key: string; userId: string; person: Person }

const PAGE = 20
const name = (p: Person | null) => p?.apelido || p?.nome || 'Alguém'

async function loadFeed(before: string | null): Promise<FeedItem[]> {
  const lt = before ?? new Date(Date.now() + 60_000).toISOString()
  const [reviews, essences, achievements, members] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, user_id, nota, observacao, created_at, person:profiles(nome, apelido, avatar_url), essence:essences(id, nome, foto_url, brand:brands(nome))')
      .lt('created_at', lt)
      .order('created_at', { ascending: false })
      .limit(PAGE),
    supabase
      .from('essences')
      .select('id, nome, foto_url, approved_at, created_by, brand:brands(nome), person:profiles!essences_created_by_fkey(nome, apelido, avatar_url)')
      .eq('status', 'approved')
      .lt('approved_at', lt)
      .order('approved_at', { ascending: false })
      .limit(PAGE),
    supabase
      .from('user_achievements')
      .select('user_id, code, earned_at, person:profiles(nome, apelido, avatar_url), achievement:achievements(nome, icone, descricao)')
      .lt('earned_at', lt)
      .order('earned_at', { ascending: false })
      .limit(PAGE),
    supabase.from('profiles').select('id, nome, apelido, avatar_url, created_at').lt('created_at', lt).order('created_at', { ascending: false }).limit(PAGE),
  ])

  type Any = Record<string, unknown> & { person: Person | null }
  const items: FeedItem[] = [
    ...((reviews.data ?? []) as unknown as (Any & { id: number; user_id: string; nota: number; observacao: string | null; created_at: string; essence: EssenceLite | null })[]).map(
      (r): FeedItem => ({ kind: 'review', at: r.created_at, key: `r${r.id}`, userId: r.user_id, person: r.person, essence: r.essence, nota: Number(r.nota), observacao: r.observacao }),
    ),
    ...((essences.data ?? []) as unknown as (Any & EssenceLite & { approved_at: string; created_by: string | null })[]).map(
      (e): FeedItem => ({ kind: 'essence', at: e.approved_at, key: `e${e.id}`, userId: e.created_by, person: e.person, essence: e }),
    ),
    ...((achievements.data ?? []) as unknown as (Any & { user_id: string; code: string; earned_at: string; achievement: { nome: string; icone: string; descricao: string } | null })[]).map(
      (a): FeedItem => ({
        kind: 'achievement',
        at: a.earned_at,
        key: `a${a.user_id}${a.code}`,
        userId: a.user_id,
        person: a.person,
        nome: a.achievement?.nome ?? '',
        icone: a.achievement?.icone ?? '🏅',
        descricao: a.achievement?.descricao ?? '',
      }),
    ),
    ...((members.data ?? []) as (Person & { id: string; created_at: string })[]).map(
      (m): FeedItem => ({ kind: 'member', at: m.created_at, key: `m${m.id}`, userId: m.id, person: m }),
    ),
  ]
  // Junta tudo por data; cada página mostra só até onde todas as fontes têm dados
  items.sort((a, b) => b.at.localeCompare(a.at))
  return items.slice(0, PAGE)
}

function Who({ userId, person }: { userId: string | null; person: Person | null }) {
  return userId ? (
    <Link to={`/perfil/${userId}`} className="font-semibold">{name(person)}</Link>
  ) : (
    <b>{name(person)}</b>
  )
}

function EssenceChip({ e }: { e: EssenceLite }) {
  return (
    <Link to={`/essencia/${e.id}`} className="mt-3 flex items-center gap-3 rounded-xl bg-neutral-100 p-2 dark:bg-neutral-900">
      <EssencePhoto url={e.foto_url} className="w-12! shrink-0 rounded-lg text-xl" />
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{e.brand?.nome}</p>
        <p className="truncate font-semibold">{e.nome}</p>
      </div>
    </Link>
  )
}

function Card({ item }: { item: FeedItem }) {
  let body: ReactNode
  switch (item.kind) {
    case 'review':
      body = (
        <>
          <p className="text-sm">
            <Who userId={item.userId} person={item.person} /> avaliou
            <span className="ml-2 inline-flex items-center gap-1 align-middle tabular-nums">
              <Stars value={item.nota} size={13} /> {formatNota(item.nota)}
            </span>
          </p>
          {item.observacao && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">“{item.observacao}”</p>}
          {item.essence && <EssenceChip e={item.essence} />}
        </>
      )
      break
    case 'essence':
      body = (
        <>
          <p className="text-sm">
            Nova essência no catálogo{item.person && <>, cadastrada por <Who userId={item.userId} person={item.person} /></>}
          </p>
          <EssenceChip e={item.essence} />
        </>
      )
      break
    case 'achievement':
      body = (
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{item.icone}</span>
          <div>
            <p className="text-sm">
              <Who userId={item.userId} person={item.person} /> desbloqueou <b>{item.nome}</b>
            </p>
            <p className="text-xs text-neutral-500">{item.descricao}</p>
          </div>
        </div>
      )
      break
    case 'member':
      body = (
        <p className="text-sm">
          <Who userId={item.userId} person={item.person} /> entrou para a comunidade. Dê as boas-vindas! 👋
        </p>
      )
  }
  return (
    <article className="flex gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <Link to={item.userId ? `/perfil/${item.userId}` : '#'} className="shrink-0">
        <Avatar url={item.person?.avatar_url} name={name(item.person)} size={36} />
      </Link>
      <div className="min-w-0 flex-1">
        {body}
        <p className="mt-2 text-xs text-neutral-500">{timeAgo(item.at)}</p>
      </div>
    </article>
  )
}

export default function Feed() {
  const { profile } = useAuth()
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadFeed(null).then((page) => {
      setItems(page)
      setMore(page.length === PAGE)
    })
  }, [])

  async function next() {
    if (!items?.length) return
    setBusy(true)
    const page = await loadFeed(items[items.length - 1].at)
    setItems([...items, ...page.filter((p) => !items.some((i) => i.key === p.key))])
    setMore(page.length === PAGE)
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Olá, {profile?.apelido || profile?.nome?.split(' ')[0] || 'membro'}!</h1>
          <p className="text-sm text-neutral-500">O que a comunidade anda fumando.</p>
        </div>
        <Link to="/nova" className="shrink-0 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black">
          + Cadastrar
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <Link to="/essencias" className="rounded-2xl border border-neutral-200 py-3 font-medium dark:border-neutral-800">Essências</Link>
        <Link to="/quero-provar" className="rounded-2xl border border-neutral-200 py-3 font-medium dark:border-neutral-800">Quero provar</Link>
        <Link to="/rankings" className="rounded-2xl border border-neutral-200 py-3 font-medium dark:border-neutral-800">Rankings</Link>
      </div>

      {items === null && <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>}
      {items?.length === 0 && <p className="py-10 text-center text-sm text-neutral-500">Ainda não há atividade. Que tal avaliar a primeira essência?</p>}
      {items?.map((item) => <Card key={item.key} item={item} />)}

      {items && items.length > 0 && more && (
        <button onClick={next} disabled={busy} className="rounded-xl border border-neutral-300 py-3 text-sm font-medium disabled:opacity-50 dark:border-neutral-700">
          {busy ? 'Carregando…' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}
