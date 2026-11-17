import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert, AuthCard, Button, Field } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(errorMessage(error))
    setBusy(false)
  }

  return (
    <AuthCard title="Entrar" subtitle="Comunidade fechada. Acesso apenas por convite.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert kind="error">{error}</Alert>}
        <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        <Link to="/esqueci-senha" className="text-center text-sm text-neutral-500 underline underline-offset-4">
          Esqueci minha senha
        </Link>
      </form>
    </AuthCard>
  )
}
