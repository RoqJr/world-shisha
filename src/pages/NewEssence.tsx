import { useNavigate } from 'react-router-dom'
import EssenceForm from '../components/EssenceForm'
import { useAuth } from '../lib/auth'
import { createEssence, useCatalog } from '../lib/data'

export default function NewEssence() {
  const { session, isAdmin } = useAuth()
  const { brands, tags } = useCatalog()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastrar essência</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isAdmin
            ? 'Como admin, sua essência é publicada na hora.'
            : 'Sua essência fica visível para todos depois que um admin aprovar.'}
        </p>
      </div>
      <EssenceForm
        brands={brands}
        tags={tags}
        submitLabel={isAdmin ? 'Publicar' : 'Enviar para aprovação'}
        onSubmit={async (values) => {
          const id = await createEssence(session!.user.id, values)
          navigate(`/essencia/${id}`, { replace: true })
        }}
      />
    </div>
  )
}
