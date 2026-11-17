import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { compressImage, type Brand, type EssenceFormValues, type Tag } from '../lib/data'
import { errorMessage } from '../lib/supabase'
import { Alert, Button, Field } from './ui'

type Props = {
  brands: Brand[]
  tags: Tag[]
  initial?: { brandId: number; nome: string; descricao: string | null; tagIds: number[]; fotoUrl: string | null }
  allowNewBrand?: boolean
  submitLabel: string
  onSubmit: (values: EssenceFormValues) => Promise<void>
  onCancel?: () => void
}

const NEW_BRAND = 'nova'

export default function EssenceForm({ brands, tags, initial, allowNewBrand = true, submitLabel, onSubmit, onCancel }: Props) {
  const [brand, setBrand] = useState(initial ? String(initial.brandId) : '')
  const [newBrand, setNewBrand] = useState('')
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [tagIds, setTagIds] = useState<number[]>(initial?.tagIds ?? [])
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(initial?.fotoUrl ?? null)
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)
    setError('')
    try {
      const blob = await compressImage(file)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
    } catch (err) {
      setError(errorMessage(err))
    }
    setProcessing(false)
  }

  function toggleTag(id: number) {
    setTagIds((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!brand) return setError('Escolha a marca.')
    if (brand === NEW_BRAND && !newBrand.trim()) return setError('Digite o nome da nova marca.')
    if (!nome.trim()) return setError('Digite o nome da essência.')
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        brandId: brand === NEW_BRAND ? null : Number(brand),
        newBrand,
        nome,
        descricao,
        tagIds,
        photo,
      })
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  const inputClass =
    'rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base font-normal outline-none focus:border-current dark:border-neutral-700'

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex cursor-pointer flex-col gap-1.5 text-sm font-medium">
        Foto
        <span className="relative flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-neutral-500">{processing ? 'Processando…' : 'Toque para escolher uma foto'}</span>
          )}
        </span>
        <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
        {preview && <span className="text-xs font-normal text-neutral-500">Toque na foto para trocar.</span>}
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Marca
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className={`${inputClass} dark:bg-black`} required>
          <option value="">Selecione…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome}
              {b.status === 'pending' ? ' (aguardando aprovação)' : ''}
            </option>
          ))}
          {allowNewBrand && <option value={NEW_BRAND}>➕ Outra marca (sugerir)</option>}
        </select>
      </label>

      {brand === NEW_BRAND && (
        <Field label="Nome da nova marca" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="A marca vai para aprovação junto com a essência" />
      )}

      <Field label="Nome da essência" value={nome} onChange={(e) => setNome(e.target.value)} required />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descrição do sabor <span className="font-normal text-neutral-500">(opcional)</span>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputClass} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Tags de sabor</legend>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const on = tagIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  on ? 'border-current bg-black text-white dark:bg-white dark:text-black' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              >
                {t.nome}
              </button>
            )
          })}
        </div>
      </fieldset>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex gap-3">
        <Button type="submit" disabled={busy || processing} className="flex-1">
          {busy ? 'Salvando…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
