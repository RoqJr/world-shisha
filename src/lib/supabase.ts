import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local')
}

// Lido antes do Supabase limpar a URL: indica se a pessoa chegou por um link
// de convite ou de recuperação de senha (nos dois casos ela precisa definir a senha).
const linkType = new URLSearchParams(window.location.hash.slice(1)).get('type')
export const arrivedToSetPassword = linkType === 'invite' || linkType === 'recovery'

export const supabase = createClient(url, anonKey)

const messages: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail ainda não confirmado.',
  'User not found': 'Usuário não encontrado.',
  'New password should be different from the old password.': 'A nova senha precisa ser diferente da anterior.',
  'Password should be at least 6 characters.': 'A senha precisa ter pelo menos 6 caracteres.',
}

export function errorMessage(error: unknown): string {
  const msg =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  if (messages[msg]) return messages[msg]
  if (/rate limit|security purposes/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  return msg
}
