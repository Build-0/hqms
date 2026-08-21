// 全面校對建議（2026-08）：精選規則找出明確錯位，產生建議變更清單。加 --write 才套用。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const WRITE = process.argv.includes('--write')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const req = async (m, p, b) => { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${await r.text()}`); return r.json() }

const cs = await req('GET', 'complaints?select=id,category,guest_comment&limit=2000')
// 建議規則：[目標分類, 比對正則, 限定原分類(可選)]
const SUG = [
  ['安全', /(撞爛|打爛).*燈罩/],                                   // 客人弄爛（客人問題）
  ['設備', /電視.*壞|壞.*電視|反映電視|插座|體重秤|跳電|燈罩爛|窗外.{0,3}吵|窗外有(異響|響聲)|房間有異響|空調.*(霉味|異味|出風)|太冷.*調不到|房間太冷/],
  ['氣味異味', /臭汗味|香薰味太濃|地氈有尿味|房.*地氈.*尿/],
  ['蟲害', /行李架.*(蝸牛|蜗牛)|^皮膚過敏$|皮肤过敏/],
  ['床品布草', /^床上血跡$/],
  ['浴室衛生', /^沖涼後發現長髮$/],
  ['服務', /打爛客人香水|檢查續住.*洗澡遭投訴|检查续住.*洗澡遭投诉|報警受到驚嚇|报警受到惊吓/],
  ['房間清潔', /^.*$/, '房間'],                                   // 殘留舊名 房間→房間清潔（放最後）
]
const cat14 = ['房間清潔', '氣味異味', '地毯地板', '床品布草', '浴室衛生', '馬桶廁所', '排水花灑', '遺留物', '蟲害', '設備', '安全', '服務', '工作間', '工具', '新人培訓']
const changes = []
for (const c of cs) {
  for (const [to, re, only] of SUG) {
    if (only && c.category !== only) continue
    if (re.test(c.guest_comment) && to !== c.category) { changes.push({ id: c.id, from: c.category, to, t: c.guest_comment.slice(0, 30) }); break }
  }
}
const byTo = {}
for (const ch of changes) (byTo[ch.to] = byTo[ch.to] || []).push(ch)
console.log(`建議變更 ${changes.length} 筆：`)
for (const [to, list] of Object.entries(byTo)) {
  console.log(`\n→ ${to} (${list.length})`)
  list.forEach(ch => console.log(`   [${ch.from}] ${ch.t}`))
}
if (WRITE) {
  for (const ch of changes) await req('PATCH', `complaints?id=eq.${ch.id}`, { category: ch.to })
  console.log('\n已套用')
} else console.log('\n（試算，加 --write 套用）')
