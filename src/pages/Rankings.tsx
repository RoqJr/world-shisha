import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { EssencePhoto } from '../components/EssenceCard'
import { ESSENCE_SELECT, formatNota, type Essence } from '../lib/data'
import { supabase } from '../lib/supabase'

type ReviewLite = { essence_id: number; user_id: string; nota: number; created_at: string }
type Member = { id: string; nome: string; apelido: string | null; avatar_url: string | null }
type Tab = 'melhores' | 'avaliadas' | 'alta' | 'marcas' | 'membros'

const TABS: [Tab, string][] = [
  ['melhores', 'Melhores'],
  ['avaliadas', 'Mais avaliadas'],
  ['alta', 'Em alta'],
  ['marcas', 'Por marca'],
  ['membros', 'Membros'],
]

const MIN_REVIEWS = 2 // mínimo de avaliações para entrar em "Melhores"

function Row({ pos, to, image, over, title, metric, sub }: { pos: number; to: string; image: ReactNode; over?: string; title: string; metric: string; sub?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2 pr-4 dark:border-neutral-800">
      <span className={`w-8 text-center text-xl font-bold tabular-nums ${pos <= 3 ? '' : 'text-neutral-400'}`}>{pos}</span>
      {image}
      <div className="min-w-0 flex-1">
        {over && <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{over}</p>}
        <p className="truncate font-semibold">{title}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{metric}</p>
        {sub && <p className="text-xs text-neutral-500">{sub}</p>}
      </div>
    </Link>
  )
}

export default function Rankings() {
  const [tab, setTab] = useState<Tab>('melhores')
  const [essences, setEssences] = useState<Essence[] | null>(null)
  const [reviews, setReviews] = useState<ReviewLite[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loadedAt, setLoadedAt] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('essences').select(ESSENCE_SELECT).eq('status', 'approved'),
      supabase.from('reviews').select('essence_id, user_id, nota, created_at'),
      supabase.from('profiles').select('id, nome, apelido, avatar_url'),
    ]).then(([e, r, m]) => {
      setEssences((e.data ?? []) as unknown as Essence[])
      setReviews((r.data ?? []) as ReviewLite[])
      setMembers((m.data ?? []) as Member[])
      setLoadedAt(Date.now())
    })
  }, [])

  const data = useMemo(() => {
    const byEssence = new Map<number, { sum: number; total: number; week: number }>()
    const weekAgo = loadedAt - 7 * 86400_000
    for (const r of reviews) {
      const s = byEssence.get(r.essence_id) ?? { sum: 0, total: 0, week: 0 }
      s.sum += Number(r.nota)
      s.total += 1
      if (new Date(r.created_at).getTime() >= weekAgo) s.week += 1
      byEssence.set(r.essence_id, s)
    }
    const rated = (essences ?? [])
      .map((e) => {
        const s = byEssence.get(e.id)
        return s ? { e, media: s.sum / s.total, total: s.total, week: s.week } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const melhores = rated.filter((x) => x.total >= MIN_REVIEWS).sort((a, b) => b.media - a.media || b.total - a.total)
    const avaliadas = [...rated].sort((a, b) => b.total - a.total || b.media - a.media)
    const alta = rated.filter((x) => x.week > 0).sort((a, b) => b.week - a.week || b.media - a.media)

    const bestByBrand = new Map<number, (typeof rated)[number]>()
    for (const x of rated) {
      const cur = bestByBrand.get(x.e.brand_id)
      if (!cur || x.media > cur.media || (x.media === cur.media && x.total > cur.total)) bestByBrand.set(x.e.brand_id, x)
    }
    const marcas = [...bestByBrand.values()].sort((a, b) => (a.e.brand?.nome ?? '').localeCompare(b.e.brand?.nome ?? '', 'pt-BR'))

    const perUser = new Map<string, number>()
    for (const r of reviews) perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + 1)
    const ranking = members
      .map((m) => ({ m, total: perUser.get(m.id) ?? 0 }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)

    return { melhores, avaliadas, alta, marcas, ranking }
  }, [essences, reviews, members, loadedAt])

  const avaliacoes = (n: number) => `${n} ${n === 1 ? 'avaliação' : 'avaliações'}`
  const photo = (e: Essence) => <EssencePhoto url={e.foto_url} className="w-12! shrink-0 rounded-lg text-xl" />

  const hints: Record<Tab, string> = {
    melhores: `Maior nota média (mínimo de ${MIN_REVIEWS} avaliações).`,
    avaliadas: 'Essências com mais avaliações.',
    alta: 'Mais avaliadas nos últimos 7 dias.',
    marcas: 'A essência com melhor nota de cada marca.',
    membros: 'Quem mais avaliou essências.',
  }

  let content: ReactNode
  if (essences === null) content = <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>
  else if (tab === 'membros')
    content = data.ranking.map(({ m, total }, i) => (
      <Row key={m.id} pos={i + 1} to={`/perfil/${m.id}`} image={<Avatar url={m.avatar_url} name={m.apelido || m.nome} size={48} />} title={m.apelido || m.nome} metric={String(total)} sub={total === 1 ? 'avaliação' : 'avaliações'} />
    ))
  else {
    const list = tab === 'melhores' ? data.melhores : tab === 'avaliadas' ? data.avaliadas : tab === 'alta' ? data.alta : data.marcas
    content = list.map((x, i) => (
      <Row
        key={x.e.id}
        pos={i + 1}
        to={`/essencia/${x.e.id}`}
        image={photo(x.e)}
        over={x.e.brand?.nome}
        title={x.e.nome}
        metric={tab === 'avaliadas' ? String(x.total) : tab === 'alta' ? `+${x.week}` : `★ ${formatNota(x.media)}`}
        sub={tab === 'avaliadas' ? (x.total === 1 ? 'avaliação' : 'avaliações') : tab === 'alta' ? 'esta semana' : avaliacoes(x.total)}
      />
    ))
  }

  const empty = Array.isArray(content) && content.length === 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Rankings</h1>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              tab === t ? 'border-current bg-black font-semibold text-white dark:bg-white dark:text-black' : 'border-neutral-300 dark:border-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-neutral-500">{hints[tab]}</p>
      <div className="flex flex-col gap-2">
        {empty ? <p className="text-sm text-neutral-500">Ainda não há dados suficientes para este ranking.</p> : content}
      </div>
    </div>
  )
}
