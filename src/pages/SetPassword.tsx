import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, AuthCard, Button, Field, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'

// Usada tanto no link de convite (primeiro acesso) quanto no de recuperação de senha.
export default function SetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />

  if (!session) {
    return (
      <AuthCard title="Link inválido" subtitle="Este link expirou ou já foi usado.">
        <Link to="/esqueci-senha" className="text-center text-sm underline underline-offset-4">Pedir um novo link</Link>
      </AuthCard>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    navigate('/', { replace: true })
  }

  return (
    <AuthCard title="Defina sua senha" subtitle={session.user.email}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert kind="error">{error}</Alert>}
        <Field label="Nova senha" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Confirme a senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar senha'}</Button>
      </form>
    </AuthCard>
  )
}
