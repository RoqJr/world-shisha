import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'

type Item = { id: number; nome: string; status?: 'pending' | 'approved' }
type Kind = 'brands' | 'tags'

const LABELS: Record<Kind, { title: string; singular: string; placeholder: string }> = {
  brands: { title: 'Marcas', singular: 'marca', placeholder: 'Nova marca' },
  tags: { title: 'Tags de sabor', singular: 'tag', placeholder: 'Nova tag' },
}

function friendly(error: { code?: string; message?: string }, kind: Kind) {
  if (error.code === '23505') return `Já existe uma ${LABELS[kind].singular} com esse nome.`
  if (error.code === '23503') return 'Esta marca tem essências cadastradas. Mova as essências para outra marca ou exclua-as antes.'
  return errorMessage(error)
}

export default function Catalog() {
  const { isAdmin, loading } = useAuth()
  const [kind, setKind] = useState<Kind>('brands')
  const [items, setItems] = useState<Item[] | null>(null)
  const [counts, setCounts] = useState<Map<number, number>>(new Map())
  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setItems(null)
    if (kind === 'brands') {
      const [b, e] = await Promise.all([
        supabase.from('brands').select('id, nome, status').order('nome'),
        supabase.from('essences').select('brand_id'),
      ])
      const c = new Map<number, number>()
      for (const x of e.data ?? []) c.set(x.brand_id, (c.get(x.brand_id) ?? 0) + 1)
      setCounts(c)
      setItems((b.data ?? []) as Item[])
    } else {
      const [t, et] = await Promise.all([
        supabase.from('tags').select('id, nome').order('nome'),
        supabase.from('essence_tags').select('tag_id'),
      ])
      const c = new Map<number, number>()
      for (const x of et.data ?? []) c.set(x.tag_id, (c.get(x.tag_id) ?? 0) + 1)
      setCounts(c)
      setItems((t.data ?? []) as Item[])
    }
  }, [kind])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (items ?? []).filter((i) => !q || i.nome.toLowerCase().includes(q))
    // Marcas pendentes primeiro
    return list.sort((a, b) => Number(a.status === 'approved') - Number(b.status === 'approved'))
  }, [items, search])

  if (!loading && !isAdmin) return <Navigate to="/" replace />

  async function run(promise: PromiseLike<{ error: { code?: string; message?: string } | null }>) {
    setError('')
    const { error } = await promise
    if (error) {
      setError(friendly(error, kind))
      return false
    }
    await load()
    return true
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!novo.trim()) return
    if (await run(supabase.from(kind).insert({ nome: novo.trim() }))) setNovo('')
  }

  async function rename(id: number) {
    if (!editName.trim()) return
    if (await run(supabase.from(kind).update({ nome: editName.trim() }).eq('id', id))) setEditId(null)
  }

  async function remove(item: Item) {
    const n = counts.get(item.id) ?? 0
    const msg =
      kind === 'tags' && n > 0
        ? `Excluir a tag "${item.nome}"? Ela será removida de ${n} ${n === 1 ? 'essência' : 'essências'}.`
        : `Excluir "${item.nome}"?`
    if (!confirm(msg)) return
    await run(supabase.from(kind).delete().eq('id', item.id))
  }

  const tabClass = (on: boolean) =>
    `flex-1 rounded-xl px-3 py-2 text-sm ${on ? 'bg-black font-semibold text-white dark:bg-white dark:text-black' : ''}`
  const inputClass =
    'min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-4 py-2.5 outline-none focus:border-current dark:border-neutral-700'
  const smallBtn = 'px-3! py-1.5! text-xs!'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Marcas e tags</h1>
      <div className="flex gap-1 rounded-2xl border border-neutral-200 p-1 dark:border-neutral-800">
        {(['brands', 'tags'] as const).map((k) => (
          <button
            key={k}
            className={tabClass(kind === k)}
            onClick={() => {
              setKind(k)
              setEditId(null)
              setSearch('')
              setError('')
            }}
          >
            {LABELS[k].title}
          </button>
        ))}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={LABELS[kind].placeholder} className={inputClass} />
        <Button type="submit">Adicionar</Button>
      </form>

      {error && <Alert kind="error">{error}</Alert>}

      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className={inputClass} />

      {items === null && <p className="py-6 text-center text-sm text-neutral-500">Carregando…</p>}
      <div className="flex flex-col gap-2">
        {visible.map((item) => {
          const n = counts.get(item.id) ?? 0
          return (
            <div key={item.id} className="rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              {editId === item.id ? (
                <div className="flex gap-2">
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
                  <Button onClick={() => rename(item.id)} className={smallBtn}>Salvar</Button>
                  <Button variant="ghost" onClick={() => setEditId(null)} className={smallBtn}>Cancelar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.nome}</p>
                    <p className="text-xs text-neutral-500">
                      {n} {n === 1 ? 'essência' : 'essências'}
                      {item.status === 'pending' && <span className="ml-1 font-semibold text-amber-600">· sugerida, aguardando aprovação</span>}
                    </p>
                  </div>
                  {item.status === 'pending' && (
                    <Button onClick={() => run(supabase.from('brands').update({ status: 'approved' }).eq('id', item.id))} className={smallBtn}>
                      Aprovar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditId(item.id)
                      setEditName(item.nome)
                    }}
                    className={smallBtn}
                  >
                    Renomear
                  </Button>
                  <Button variant="ghost" onClick={() => remove(item)} className={`${smallBtn} text-red-600! dark:text-red-400!`}>
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
