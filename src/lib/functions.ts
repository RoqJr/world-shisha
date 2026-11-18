import { FunctionsHttpError } from '@supabase/supabase-js'
import { errorMessage, supabase } from './supabase'

/** Chama uma Edge Function e devolve a mensagem de erro (ou null se deu certo). */
export async function callFunction(name: string, body: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = await error.context.json().catch(() => null)
      if (res?.error) return errorMessage(res.error)
    }
    return errorMessage(error)
  }
  return data?.error ? errorMessage(data.error) : null
}
