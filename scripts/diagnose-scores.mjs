// 唯讀診斷：名單上傳後評分「不見了」——查評分是否還在、掛在啟用/停用的哪些房務員身上。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
const req = async (m, p, b) => { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${await r.text()}`); return r.json() }

const atts = await req('GET', 'attendants?select=*&order=created_at')
const scores = await req('GET', 'scores?select=id,attendant_id,date,score,created_at&order=created_at')

const byId = new Map(atts.map(a => [a.id, a]))
const scoreByAtt = new Map()
for (const s of scores) { if (!scoreByAtt.has(s.attendant_id)) scoreByAtt.set(s.attendant_id, []); scoreByAtt.get(s.attendant_id).push(s) }

const active = atts.filter(a => a.active), inactive = atts.filter(a => !a.active)
console.log(`房務員總數 ${atts.length}（啟用 ${active.length}、停用 ${inactive.length}）`)
console.log(`評分總筆數 ${scores.length}`)

const scoredActive = [...scoreByAtt.keys()].filter(id => byId.get(id)?.active).length
const scoredInactive = [...scoreByAtt.keys()].filter(id => byId.get(id) && !byId.get(id).active).length
const scoredOrphan = [...scoreByAtt.keys()].filter(id => !byId.get(id)).length
console.log(`  掛在「啟用」房務員：${scoredActive} 人`)
console.log(`  掛在「停用」房務員：${scoredInactive} 人  ← 評分被藏在這裡`)
if (scoredOrphan) console.log(`  掛在已刪除房務員(孤兒)：${scoredOrphan} 人`)

console.log('\n── 有評分但被停用的房務員（就是「不見了」的評分）──')
for (const [id, ss] of scoreByAtt) {
  const a = byId.get(id)
  if (a && !a.active) console.log(`  停用｜${a.floor || '—'} ${a.name}${a.name_cn ? ' ' + a.name_cn : ''}｜emp_id=${a.emp_id || '無'}｜${ss.length} 筆評分（最近 ${ss.map(s => s.date).sort().slice(-1)[0]}）`)
}

console.log('\n── 名單上傳後新建、目前啟用但「還沒有評分」的房務員 ──')
for (const a of active) if (!scoreByAtt.has(a.id)) console.log(`  啟用｜${a.floor || '—'} ${a.name}${a.name_cn ? ' ' + a.name_cn : ''}｜emp_id=${a.emp_id || '無'}`)

// 找可能的重複：同名/同ID 但一個啟用一個停用
console.log('\n── 疑似重複（同名或同ID，一啟一停）──')
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')
for (const inA of inactive) {
  const match = active.find(a => (a.emp_id && a.emp_id === inA.emp_id) || norm(a.name) === norm(inA.name) || (inA.name_cn && norm(a.name_cn) === norm(inA.name_cn)))
  if (match) console.log(`  停用「${inA.name}${inA.name_cn ? ' ' + inA.name_cn : ''}」(${scoreByAtt.get(inA.id)?.length || 0}筆評分) ↔ 啟用「${match.name}${match.name_cn ? ' ' + match.name_cn : ''}」(${scoreByAtt.get(match.id)?.length || 0}筆)`)
}
