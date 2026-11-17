import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EssenceCard from '../components/EssenceCard'
import { ESSENCE_SELECT, useCatalog, type Essence, type Rating } from '../lib/data'
import { supabase } from '../lib/supabase'

type Sort = 'nota' | 'avaliacoes' | 'recentes' | 'nome'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function Home() {
  const { brands, tags } = useCatalog()
  const [essences, setEssences] = useState<Essence[] | null>(null)
  const [ratings, setRatings] = useState<Map<number, Rating>>(new Map())
  const [search, setSearch] = useState('')
  const [brandId, setBrandId] = useState('')
  const [tagIds, setTagIds] = useState<number[]>([])
  const [sort, setSort] = useState<Sort>('nota')

  useEffect(() => {
    Promise.all([
      supabase.from('essences').select(ESSENCE_SELECT).eq('status', 'approved'),
      supabase.from('essence_ratings').select('essence_id, media, total'),
    ]).then(([e, r]) => {
      setEssences((e.data ?? []) as unknown as Essence[])
      setRatings(new Map(((r.data ?? []) as Rating[]).map((x) => [x.essence_id, x])))
    })
  }, [])

  const visible = useMemo(() => {
    if (!essences) return []
    const q = normalize(search.trim())
    const list = essences.filter((e) => {
      if (brandId && e.brand_id !== Number(brandId)) return false
      if (tagIds.some((t) => !e.essence_tags.some((et) => et.tag_id === t))) return false
      if (q && !normalize(`${e.nome} ${e.brand?.nome ?? ''} ${e.descricao ?? ''}`).includes(q)) return false
      return true
    })
    const media = (e: Essence) => Number(ratings.get(e.id)?.media ?? 0)
    const total = (e: Essence) => ratings.get(e.id)?.total ?? 0
    return list.sort((a, b) => {
      if (sort === 'nota') return media(b) - media(a) || total(b) - total(a)
      if (sort === 'avaliacoes') return total(b) - total(a) || media(b) - media(a)
      if (sort === 'recentes') return b.created_at.localeCompare(a.created_at)
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [essences, ratings, search, brandId, tagIds, sort])

  function toggleTag(id: number) {
    setTagIds((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]))
  }

  const selectClass = 'rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-black'
  const approvedBrands = brands.filter((b) => b.status === 'approved')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Essências</h1>
        <Link to="/nova" className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black">
          + Cadastrar
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou marca…"
        className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-current dark:border-neutral-700"
      />

      <div className="grid grid-cols-2 gap-2">
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectClass} aria-label="Marca">
          <option value="">Todas as marcas</option>
          {approvedBrands.map((b) => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectClass} aria-label="Ordenar">
          <option value="nota">Melhor avaliadas</option>
          <option value="avaliacoes">Mais avaliadas</option>
          <option value="recentes">Mais recentes</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tags.map((t) => {
          const on = tagIds.includes(t.id)
          return (
            <button
              key={t.id}
              onClick={() => toggleTag(t.id)}
              aria-pressed={on}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                on ? 'border-current bg-black text-white dark:bg-white dark:text-black' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {t.nome}
            </button>
          )
        })}
      </div>

      {essences === null ? (
        <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          {essences.length === 0 ? 'Nenhuma essência cadastrada ainda. Que tal cadastrar a primeira?' : 'Nenhuma essência encontrada com esses filtros.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((e) => (
            <EssenceCard key={e.id} essence={e} rating={ratings.get(e.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
