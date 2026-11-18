// Roda um arquivo SQL (ou um texto) no Supabase pela Management API.
// Uso: node scripts/sql.mjs caminho/arquivo.sql
//      node scripts/sql.mjs -e "select 1"
// O token fica em .supabase-token.local (não vai para o GitHub).
import { readFileSync } from 'node:fs'

const REF = 'hlgnzdsbfdxdfaejulca'
const token = readFileSync(new URL('../.supabase-token.local', import.meta.url), 'utf8')
  .match(/^SUPABASE_ACCESS_TOKEN=(\S+)/m)?.[1]
if (!token) throw new Error('Token não encontrado em .supabase-token.local')

const [flag, arg] = process.argv.slice(2)
const query = flag === '-e' ? arg : readFileSync(flag, 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const text = await res.text()
console.log(`HTTP ${res.status}`)
console.log(text.length > 4000 ? text.slice(0, 4000) + '…' : text)
if (!res.ok) process.exit(1)
