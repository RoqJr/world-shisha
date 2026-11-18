import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { EssencePhoto } from '../components/EssenceCard'
import { Alert, Button, Field } from '../components/ui'
import { useAuth } from '../lib/auth'
import { compressImage } from '../lib/data'
import { errorMessage, supabase } from '../lib/supabase'

type Option = { id: number; nome: string; foto_url: string | null; brand: { nome: string } | null }

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function EditProfile() {
  const { session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const userId = session!.user.id

  const [nome, setNome] = useState(profile?.nome ?? '')
  const [apelido, setApelido] = useState(profile?.apelido ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatar, setAvatar] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(profile?.avatar_url ?? null)

  const [options, setOptions] = useState<Option[]>([])
  const [top, setTop] = useState<number[]>([])
  const [search, setSearch] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('essences').select('id, nome, foto_url, brand:brands(nome)').eq('status', 'approved').order('nome'),
      supabase.from('top5').select('essence_id').eq('user_id', userId).order('posicao'),
    ]).then(([e, t]) => {
      setOptions((e.data ?? []) as unknown as Option[])
      setTop((t.data ?? []).map((x) => x.essence_id as number))
    })
  }, [userId])

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const results = useMemo(() => {
    const q = normalize(search.trim())
    if (!q) return []
    return options
      .filter((o) => !top.includes(o.id) && normalize(`${o.nome} ${o.brand?.nome ?? ''}`).includes(q))
      .slice(0, 8)
  }, [search, options, top])

  async function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const blob = await compressImage(file, 400, 80 * 1024)
      setAvatar(blob)
      setPreview(URL.createObjectURL(blob))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function move(index: number, delta: number) {
    setTop((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setError('Informe seu nome.')
    setBusy(true)
    setError('')
    try {
      const changes: Record<string, string | null> = { nome: nome.trim(), apelido: apelido.trim() || null, bio: bio.trim() || null }
      if (avatar) {
        const path = `${userId}/${crypto.randomUUID()}.jpg`
        const up = await supabase.storage.from('avatars').upload(path, avatar, { contentType: 'image/jpeg' })
        if (up.error) throw up.error
        changes.avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      }
      const p = await supabase.from('profiles').update(changes).eq('id', userId)
      if (p.error) throw p.error
      const t = await supabase.rpc('set_top5', { essence_ids: top })
      if (t.error) throw t.error
      await refreshProfile()
      navigate('/perfil', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const inputClass =
    'rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base font-normal outline-none focus:border-current dark:border-neutral-700'
  const smallBtn = 'rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm disabled:opacity-30 dark:border-neutral-700'

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Editar perfil</h1>

      <label className="flex cursor-pointer items-center gap-4">
        <Avatar url={preview} name={apelido || nome} size={80} />
        <span className="rounded-xl border border-current px-4 py-2 text-sm font-semibold">Trocar foto</span>
        <input type="file" accept="image/*" onChange={onAvatar} className="sr-only" />
      </label>

      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      <Field label="Apelido (como aparece para os outros)" value={apelido} onChange={(e) => setApelido(e.target.value)} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className={inputClass} placeholder="Conte um pouco sobre você" />
      </label>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Top 5</h2>
          <p className="text-sm text-neutral-500">Suas essências favoritas, em ordem. Use as setas para reordenar.</p>
        </div>

        {top.map((id, i) => {
          const o = byId.get(id)
          return (
            <div key={id} className="flex items-center gap-2 rounded-2xl border border-neutral-200 p-2 dark:border-neutral-800">
              <span className="w-6 text-center text-lg font-bold tabular-nums text-neutral-400">{i + 1}</span>
              <EssencePhoto url={o?.foto_url ?? null} className="w-10! shrink-0 rounded-lg text-base" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs uppercase text-neutral-500">{o?.brand?.nome}</p>
                <p className="truncate text-sm font-semibold">{o?.nome ?? '…'}</p>
              </div>
              <button type="button" className={smallBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
              <button type="button" className={smallBtn} disabled={i === top.length - 1} onClick={() => move(i, 1)} aria-label="Descer">↓</button>
              <button type="button" className={smallBtn} onClick={() => setTop((l) => l.filter((x) => x !== id))} aria-label="Remover">✕</button>
            </div>
          )
        })}

        {top.length < 5 && (
          <div className="flex flex-col gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar essência para adicionar (${top.length}/5)`}
              className={inputClass}
            />
            {results.map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => {
                  setTop((l) => [...l, o.id])
                  setSearch('')
                }}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
              >
                <EssencePhoto url={o.foto_url} className="w-9! shrink-0 rounded-lg text-base" />
                <span className="min-w-0 truncate text-sm"><b>{o.nome}</b> <span className="text-neutral-500">· {o.brand?.nome}</span></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy} className="flex-1">{busy ? 'Salvando…' : 'Salvar'}</Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
      </div>
    </form>
  )
}
