import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, AuthCard, Button, Field, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'

// Usada no link de convite (primeiro acesso), no de recuperação e na troca da senha provisória.
export default function SetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <AuthCard title="Senha salva!">
        <div className="flex flex-col gap-4">
          <Alert kind="success">Sua senha foi alterada com sucesso. Use a nova senha nos próximos acessos.</Alert>
          <Button onClick={() => navigate('/', { replace: true })}>Entrar no app</Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut()
              navigate('/login', { replace: true })
            }}
          >
            Voltar ao login
          </Button>
        </div>
      </AuthCard>
    )
  }

  if (loading) return <Spinner />

  if (!session) {
    return (
      <AuthCard title="Link inválido" subtitle="Este link expirou ou já foi usado.">
        <div className="flex flex-col gap-3 text-center text-sm">
          <Link to="/esqueci-senha" className="underline underline-offset-4">Pedir um novo link</Link>
          <Link to="/login" className="text-neutral-500 underline underline-offset-4">Voltar ao login</Link>
        </div>
      </AuthCard>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    setDone(true)
  }

  return (
    <AuthCard
      title="Defina sua senha"
      subtitle={
        session.user.user_metadata?.must_change_password
          ? 'Você entrou com uma senha provisória. Crie a sua senha para continuar.'
          : session.user.email
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert kind="error">{error}</Alert>}
        <Field label="Nova senha" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Confirme a senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar senha'}</Button>
        <p className="text-center text-xs text-neutral-500">Mínimo de 8 caracteres.</p>
      </form>
    </AuthCard>
  )
}
