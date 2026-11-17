import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, AuthCard, Button, Field } from '../components/ui'
import { errorMessage, supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    })
    if (error) setError(errorMessage(error))
    else setSent(true)
    setBusy(false)
  }

  return (
    <AuthCard title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert kind="success">
            Se este e-mail estiver cadastrado, você vai receber um link em instantes. Confira também a caixa de spam.
          </Alert>
          <Link to="/login" className="text-center text-sm underline underline-offset-4">Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</Button>
          <Link to="/login" className="text-center text-sm text-neutral-500 underline underline-offset-4">Voltar para o login</Link>
        </form>
      )}
    </AuthCard>
  )
}
