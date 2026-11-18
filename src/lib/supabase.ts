import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local')
}

// Lido antes do Supabase limpar a URL: indica se a pessoa chegou por um link
// de convite ou de recuperação de senha (nos dois casos ela precisa definir a senha).
const linkType = new URLSearchParams(window.location.hash.slice(1)).get('type')
let pendingSetPassword = linkType === 'invite' || linkType === 'recovery'

/** Retorna true só na primeira chamada após chegar por um desses links. */
export function consumeSetPasswordLink() {
  const result = pendingSetPassword
  pendingSetPassword = false
  return result
}

export const supabase = createClient(url, anonKey)

// Tradução das mensagens do Supabase/navegador (em inglês) para o usuário.
// A ordem importa: a primeira regra que combinar é usada.
const translations: [RegExp, string][] = [
  // Login e conta
  [/user is banned|banned/i, 'Seu acesso está bloqueado. Entre em contato com um administrador.'],
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Seu e-mail ainda não foi confirmado. Procure o e-mail de convite ou fale com um administrador.'],
  [/user not found/i, 'Usuário não encontrado.'],
  [/user already registered|already been registered|already exists/i, 'Já existe um usuário com este e-mail.'],
  [/signups? not allowed|signup.*disabled/i, 'O cadastro é feito apenas por convite. Fale com um administrador.'],
  [/invalid format|unable to validate email|invalid email/i, 'E-mail inválido.'],
  // Senha
  [/should be different from the old password/i, 'A nova senha precisa ser diferente da anterior.'],
  [/password should be at least (\d+)/i, 'A senha precisa ter pelo menos $1 caracteres.'],
  [/password.*(weak|easy to guess|pwned|leaked)/i, 'Essa senha é muito fraca ou conhecida. Escolha outra mais difícil.'],
  [/password.*(characters|contain)/i, 'A senha não atende aos requisitos. Use letras e números.'],
  // Sessão e links
  [/auth session missing|jwt expired|invalid jwt|session.*(expired|not found)|refresh token/i, 'Sua sessão expirou. Entre novamente.'],
  [/(token|link).*(expired|invalid)|(expired|invalid).*(token|link)|otp/i, 'Este link expirou ou já foi usado. Peça um novo.'],
  // Limites
  [/rate limit|too many requests|security purposes|over_email_send_rate_limit/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
  // Conexão
  [/failed to fetch|networkerror|load failed|network request failed|fetch failed/i, 'Sem conexão com a internet. Verifique sua rede e tente de novo.'],
  [/timeout|timed out/i, 'O servidor demorou para responder. Tente de novo.'],
  // Banco de dados
  [/duplicate key|unique constraint/i, 'Este registro já existe.'],
  [/foreign key/i, 'Este item está sendo usado em outro lugar e não pode ser removido.'],
  [/row-level security|permission denied|not allowed|unauthorized|forbidden/i, 'Você não tem permissão para fazer isso.'],
  [/value too long/i, 'Texto muito longo.'],
  [/violates check constraint/i, 'Algum dado está fora do permitido. Confira os campos.'],
  // Arquivos
  [/exceeded the maximum allowed size|payload too large|entity too large/i, 'Arquivo muito grande.'],
  [/mime type|not supported|invalid.*image/i, 'Formato de arquivo não suportado. Use JPG ou PNG.'],
  // Funções do servidor
  [/edge function|non-2xx|functionsfetcherror|functionsrelayerror/i, 'Não foi possível concluir a operação no servidor. Tente de novo.'],
]

// Mensagens que já vêm em português (das nossas regras) passam direto
const looksPortuguese = /[ãõçáéíóúâêô]|\b(não|você|essência|marca|membro|senha|informe|apenas|escolha|faça)\b/i

export function errorMessage(error: unknown): string {
  const msg =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')
  if (!msg) return 'Algo deu errado. Tente de novo.'
  if (looksPortuguese.test(msg)) return msg
  for (const [pattern, text] of translations) {
    const m = msg.match(pattern)
    if (m) return text.replace('$1', m[1] ?? '')
  }
  console.warn('Mensagem sem tradução:', msg)
  return 'Algo deu errado. Tente de novo. Se continuar, fale com um administrador.'
}
