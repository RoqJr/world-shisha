import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EssencePhoto } from '../components/EssenceCard'
import { formatNota, type Rating } from '../lib/data'
import { supabase } from '../lib/supabase'

type Item = {
  essence_id: number
  created_at: string
  essence: { id: number; nome: string; foto_url: string | null; brand: { nome: string } | null } | null
}

export default function Wishlist() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [ratings, setRatings] = useState<Map<number, Rating>>(new Map())

  useEffect(() => {
    Promise.all([
      supabase
        .from('wishlist')
        .select('essence_id, created_at, essence:essences(id, nome, foto_url, brand:brands(nome))')
        .order('created_at', { ascending: false }),
      supabase.from('essence_ratings').select('essence_id, media, total'),
    ]).then(([w, r]) => {
      setItems((w.data ?? []) as unknown as Item[])
      setRatings(new Map(((r.data ?? []) as Rating[]).map((x) => [x.essence_id, x])))
    })
  }, [])

  async function remove(id: number) {
    setItems((list) => list?.filter((i) => i.essence_id !== id) ?? null)
    await supabase.from('wishlist').delete().eq('essence_id', id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quero provar</h1>
        <p className="mt-1 text-sm text-neutral-500">Quando você avaliar uma essência da lista, ela sai daqui sozinha.</p>
      </div>

      {items === null && <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>}
      {items?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Sua lista está vazia. Na lista de <Link to="/essencias" className="underline underline-offset-4">essências</Link>, toque no ícone
          de marcador sobre a foto para adicionar.
        </div>
      )}

      {items?.map(
        ({ essence: e }) =>
          e && (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2 pr-3 dark:border-neutral-800">
              <Link to={`/essencia/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <EssencePhoto url={e.foto_url} className="w-16! shrink-0 rounded-xl text-2xl" />
                <div className="min-w-0">
                  <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{e.brand?.nome}</p>
                  <p className="truncate font-semibold">{e.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {ratings.get(e.id) ? `★ ${formatNota(Number(ratings.get(e.id)!.media))} · ${ratings.get(e.id)!.total} avaliações` : 'Sem avaliações'}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => remove(e.id)}
                aria-label={`Remover ${e.nome} da lista`}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
              >
                ✕
              </button>
            </div>
          ),
      )}
    </div>
  )
}
