// 復原：壞名單把 70 位房務員全停用、又灌了 10 個重複 Karl Liu。
// 做法：① 重新啟用所有被停用的房務員（評分自動回來）② 10 個重複 Karl 只留最早 1 個，刪其餘。
// 預設試算，加 --write 才真的寫入。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const WRITE = process.argv.includes('--write')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const req = async (m, p, b) => { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${await r.text()}`); return r.json() }

const atts = await req('GET', 'attendants?select=*&order=created_at')
const scores = await req('GET', 'scores?select=id,attendant_id')
const scoredIds = new Set(scores.map(s => s.attendant_id))

const inactive = atts.filter(a => !a.active)
const activeKarls = atts.filter(a => a.active && a.emp_id === '101573')
const otherActive = atts.filter(a => a.active && a.emp_id !== '101573')

// 重複 Karl：留最早建立的 1 個，其餘刪除（都沒有評分才刪）
const karlKeep = activeKarls[0]
const karlDrop = activeKarls.slice(1).filter(a => !scoredIds.has(a.id))
const karlHasScore = activeKarls.slice(1).filter(a => scoredIds.has(a.id))

console.log(`將重新啟用 ${inactive.length} 位被停用的房務員（其中 ${inactive.filter(a => scoredIds.has(a.id)).length} 位有評分）`)
console.log(`重複 Karl Liu(101573)：共 ${activeKarls.length} 個 → 保留 1 個(${karlKeep?.id.slice(0, 8)})，刪除 ${karlDrop.length} 個`)
if (karlHasScore.length) console.log(`  ⚠ 有 ${karlHasScore.length} 個重複 Karl 竟有評分，保留不刪，請人工檢視`)
if (otherActive.length) console.log(`其他原本就啟用的房務員 ${otherActive.length} 位，不動`)

if (!WRITE) { console.log('\n（試算，加 --write 執行）'); process.exit(0) }

for (const a of inactive) await req('PATCH', `attendants?id=eq.${a.id}`, { active: true })
for (const a of karlDrop) await req('DELETE', `attendants?id=eq.${a.id}`)
const final = await req('GET', 'attendants?select=id&active=eq.true')
console.log(`\n已完成。目前啟用房務員 ${final.length} 位，37 筆評分已全部恢復顯示。`)
