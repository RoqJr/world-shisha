import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Brand = { id: number; nome: string; status: 'pending' | 'approved' }
export type Tag = { id: number; nome: string }
export type EssenceStatus = 'pending' | 'approved' | 'rejected'

export type Essence = {
  id: number
  nome: string
  descricao: string | null
  foto_url: string | null
  status: EssenceStatus
  motivo_rejeicao: string | null
  created_by: string | null
  created_at: string
  brand_id: number
  brand: Brand | null
  essence_tags: { tag_id: number }[]
}

export type Rating = { essence_id: number; media: number; total: number }

export const ESSENCE_SELECT =
  'id, nome, descricao, foto_url, status, motivo_rejeicao, created_by, created_at, brand_id, brand:brands(id, nome, status), essence_tags(tag_id)'

/** Marcas e tags (listas pequenas, carregadas de uma vez). */
export function useCatalog() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const reload = useCallback(async () => {
    const [b, t] = await Promise.all([
      supabase.from('brands').select('id, nome, status').order('nome'),
      supabase.from('tags').select('id, nome').order('nome'),
    ])
    setBrands((b.data ?? []) as Brand[])
    setTags((t.data ?? []) as Tag[])
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { brands, tags, reload }
}

export function formatNota(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// ---------------------------------------------------------------------
// Fotos: reduz no próprio celular para ~200 KB antes de enviar
// ---------------------------------------------------------------------
function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a foto.'))), 'image/jpeg', quality),
  )
}

export async function compressImage(file: File, maxSide = 1200, targetBytes = 200 * 1024): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Formato de imagem não suportado. Use JPG ou PNG.')
  }

  const canvas = document.createElement('canvas')
  let side = maxSide
  let blob: Blob | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.7, 0.6]) {
      blob = await canvasToBlob(canvas, quality)
      if (blob.size <= targetBytes) return blob
    }
    side = Math.round(side * 0.8)
  }
  return blob!
}

export async function uploadPhoto(userId: string, photo: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('essences').upload(path, photo, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('essences').getPublicUrl(path).data.publicUrl
}

// ---------------------------------------------------------------------
// Salvar essência
// ---------------------------------------------------------------------
export type EssenceFormValues = {
  brandId: number | null
  newBrand: string
  nome: string
  descricao: string
  tagIds: number[]
  photo: Blob | null
}

function isDuplicate(error: { code?: string } | null) {
  return error?.code === '23505'
}

async function replaceTags(essenceId: number, tagIds: number[]) {
  const del = await supabase.from('essence_tags').delete().eq('essence_id', essenceId)
  if (del.error) throw del.error
  if (tagIds.length === 0) return
  const ins = await supabase.from('essence_tags').insert(tagIds.map((tag_id) => ({ essence_id: essenceId, tag_id })))
  if (ins.error) throw ins.error
}

export async function createEssence(userId: string, v: EssenceFormValues): Promise<number> {
  let brandId = v.brandId
  if (!brandId) {
    const { data, error } = await supabase.from('brands').insert({ nome: v.newBrand.trim() }).select('id').single()
    if (isDuplicate(error)) throw new Error('Essa marca já existe ou já foi sugerida por alguém. Escolha-a na lista ou aguarde a aprovação.')
    if (error) throw error
    brandId = data.id as number
  }

  const foto_url = v.photo ? await uploadPhoto(userId, v.photo) : null

  const { data, error } = await supabase
    .from('essences')
    .insert({ brand_id: brandId, nome: v.nome.trim(), descricao: v.descricao.trim() || null, foto_url })
    .select('id')
    .single()
  if (isDuplicate(error)) throw new Error('Já existe uma essência com esse nome nessa marca.')
  if (error) throw error

  await replaceTags(data.id as number, v.tagIds)
  return data.id as number
}

/** Admin: salva as alterações e aprova (ou só salva, se approve = false). */
export async function updateEssence(userId: string, id: number, v: EssenceFormValues, approve: boolean) {
  const changes: Record<string, unknown> = {
    brand_id: v.brandId,
    nome: v.nome.trim(),
    descricao: v.descricao.trim() || null,
  }
  if (v.photo) changes.foto_url = await uploadPhoto(userId, v.photo)
  if (approve) changes.status = 'approved'

  await replaceTags(id, v.tagIds)
  const { error } = await supabase.from('essences').update(changes).eq('id', id)
  if (isDuplicate(error)) throw new Error('Já existe uma essência com esse nome nessa marca.')
  if (error) throw error
}
