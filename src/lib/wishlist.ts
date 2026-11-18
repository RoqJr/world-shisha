import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** IDs das essências na lista "Quero provar" do usuário, com adicionar/remover instantâneo. */
export function useWishlist() {
  const [ids, setIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    supabase
      .from('wishlist')
      .select('essence_id')
      .then(({ data }) => setIds(new Set((data ?? []).map((x) => x.essence_id as number))))
  }, [])

  const toggle = useCallback(
    async (essenceId: number) => {
      const had = ids.has(essenceId)
      // Atualiza a tela na hora; desfaz se o servidor recusar
      const flip = (add: boolean) =>
        setIds((s) => {
          const next = new Set(s)
          if (add) next.add(essenceId)
          else next.delete(essenceId)
          return next
        })
      flip(!had)
      const { error } = had
        ? await supabase.from('wishlist').delete().eq('essence_id', essenceId)
        : await supabase.from('wishlist').insert({ essence_id: essenceId })
      if (error) flip(had)
    },
    [ids],
  )

  return { ids, toggle }
}
