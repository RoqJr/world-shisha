import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { EssencePhoto } from '../components/EssenceCard'
import EssenceForm from '../components/EssenceForm'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../lib/auth'
import { ESSENCE_SELECT, updateEssence, useCatalog, type Brand, type Essence, type Tag } from '../lib/data'
import { errorMessage, supabase } from '../lib/supabase'

type Pending = Essence & { author: { nome: string; apelido: string | null } | null }

export default function Admin() {
  const { isAdmin, loading } = useAuth()
  const { brands, tags, reload: reloadCatalog } = useCatalog()
  const [pending, setPending] = useState<Pending[] | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('essences')
      .select(`${ESSENCE_SELECT}, author:profiles!essences_created_by_fkey(nome, apelido)`)
      .eq('status', 'pending')
      .order('created_at')
    setPending((data ?? []) as unknown as Pending[])
    window.dispatchEvent(new Event('pending-changed'))
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (!loading && !isAdmin) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Aprovações</h1>
      {pending === null && <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>}
      {pending?.length === 0 && <p className="text-sm text-neutral-500">Nenhuma essência aguardando aprovação. 🎉</p>}
      {pending?.map((e) => (
        <PendingItem
          key={e.id}
          essence={e}
          brands={brands}
          tags={tags}
          onDone={async () => {
            await Promise.all([load(), reloadCatalog()])
          }}
        />
      ))}
    </div>
  )
}

function PendingItem({ essence, brands, tags, onDone }: { essence: Pending; brands: Brand[]; tags: Tag[]; onDone: () => Promise<void> }) {
  const { session } = useAuth()
  const [mode, setMode] = useState<'view' | 'edit' | 'reject'>('view')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const tagIds = essence.essence_tags.map((et) => et.tag_id)
  const tagNames = tagIds.map((id) => tags.find((t) => t.id === id)?.nome).filter(Boolean)

  async function run(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true)
    setError('')
    const { error } = await action()
    setBusy(false)
    if (error) return setError(errorMessage(error))
    await onDone()
  }

  const approve = () => run(() => supabase.from('essences').update({ status: 'approved' }).eq('id', essence.id))
  const reject = () => {
    if (!motivo.trim()) return setError('Informe o motivo da rejeição.')
    return run(() => supabase.from('essences').update({ status: 'rejected', motivo_rejeicao: motivo.trim() }).eq('id', essence.id))
  }

  if (mode === 'edit') {
    return (
      <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <EssenceForm
          brands={brands}
          tags={tags}
          allowNewBrand={false}
          initial={{ brandId: essence.brand_id, nome: essence.nome, descricao: essence.descricao, tagIds, fotoUrl: essence.foto_url }}
          submitLabel="Salvar e aprovar"
          onCancel={() => setMode('view')}
          onSubmit={async (values) => {
            await updateEssence(session!.user.id, essence.id, values, true)
            await onDone()
          }}
        />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex gap-3">
        <EssencePhoto url={essence.foto_url} className="w-24! shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {essence.brand?.nome}
            {essence.brand?.status === 'pending' && <span className="ml-1 normal-case text-amber-600">(marca nova)</span>}
          </p>
          <p className="font-semibold">{essence.nome}</p>
          {tagNames.length > 0 && <p className="text-xs text-neutral-500">{tagNames.join(' · ')}</p>}
          <p className="text-xs text-neutral-500">
            Enviada por {essence.author?.apelido || essence.author?.nome || '—'} em {new Date(essence.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
      {essence.descricao && <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">{essence.descricao}</p>}

      {mode === 'reject' && (
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Motivo da rejeição (a pessoa vai ver)"
          className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-current dark:border-neutral-700"
        />
      )}
      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {mode === 'view' ? (
          <>
            <Button onClick={approve} disabled={busy} className="flex-1">Aprovar</Button>
            <Button variant="ghost" onClick={() => setMode('edit')} disabled={busy}>Editar</Button>
            <Button variant="ghost" onClick={() => setMode('reject')} disabled={busy}>Rejeitar</Button>
          </>
        ) : (
          <>
            <Button onClick={reject} disabled={busy} className="flex-1">Confirmar rejeição</Button>
            <Button variant="ghost" onClick={() => setMode('view')} disabled={busy}>Cancelar</Button>
          </>
        )}
      </div>
    </section>
  )
}
