// 客訴分類細化（2026-08）：房間拆成 房間清潔/氣味異味/地毯地板；浴室拆成 浴室衛生/馬桶廁所/排水花灑
// 並修正歸錯的（→設備/蟲害）。加 --write 才寫入，否則試算。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const WRITE = process.argv.includes('--write')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const req = async (m, p, b) => { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${await r.text()}`); return r.json() }

// 新分類（名稱, emoji, 色）
const NEW_CATS = [
  ['氣味異味', '🌫️', '#9c6b4a'],
  ['地毯地板', '🟫', '#8a7355'],
  ['馬桶廁所', '🚽', '#5b8fa5'],
  ['排水花灑', '🚰', '#3f9e9e'],
]
// 最終順序
const ORDER = ['房間清潔', '氣味異味', '地毯地板', '床品布草', '浴室', '馬桶廁所', '排水花灑', '遺留物', '蟲害', '設備', '安全', '服務', '工作間', '工具']
// 分類規則（順序＝優先）；只套用於 房間清潔 + 浴室 的客訴
const RULES = [
  ['蟲害', /小強|蟑螂|蝸牛|甲蟲|壁虎|蜘蛛|蟲|跳蝨|床蝨|過敏|紅點|蟲咬/],
  ['設備', /插座|燈帶|燈眼|冷時熱|忽冷忽熱|冷風|熱風|冷氣|太熱|漏水|浸水|風筒|吹風|熨|電視|門用力可以推開|礦泉水|熱水壺|沒有熨斗|水時冷時熱/],
  ['排水花灑', /排水|去水|地漏|排不了|存不了水|滲水|花灑|花洒|水龍頭|水壓|水压|出水量|軟管|噴頭|水塞/],
  ['馬桶廁所', /馬桶|马桶|廁所|厕所|抽氣扇|抽气|尿漬|尿渍|有屎/],
  ['地毯地板', /地毯|地氈|地板|地墊|壁紙|背景牆/],
  ['浴室衛生', /浴缸|淋浴|洗手台|洗手盆|玻璃門|防水膠|刮鬍刀|刮胡刀|浴室|沖涼房|沖涼去水/],
  ['氣味異味', /臭|煙味|烟味|發霉|霉味|有霉|餿|異味|异味|尿味|難聞|汗味|抽過菸|有臭味|一陣.{0,4}味|好難聞|味道.*久/],
]
const classify = (text, srcDefault) => {
  for (const [cat, re] of RULES) if (re.test(text)) return cat
  return srcDefault
}

// ① 房間 → 房間清潔（連主題）
const cats = await req('GET', 'categories?select=id,name,sort_order')
const roomCat = cats.find(c => c.name === '房間')
if (roomCat && WRITE) {
  await req('PATCH', `categories?id=eq.${roomCat.id}`, { name: '房間清潔', emoji: '🧹' })
  await req('PATCH', `topics?category=eq.${encodeURIComponent('房間')}`, { category: '房間清潔' })
}
// ② 新增分類
if (WRITE) for (const [name, emoji, color] of NEW_CATS) {
  if (!cats.some(c => c.name === name)) await req('POST', 'categories', { name, emoji, color, sort_order: 50 })
}
// ②b 統一排序
if (WRITE) {
  const all = await req('GET', 'categories?select=id,name')
  for (const c of all) { const i = ORDER.indexOf(c.name); await req('PATCH', `categories?id=eq.${c.id}`, { sort_order: i < 0 ? 99 : i }) }
}

// ③ 重新歸類 房間(清潔) + 浴室 的客訴
const targetCats = ['房間', '房間清潔', '浴室']
const cs = await req('GET', `complaints?select=id,category,guest_comment,improvement&category=in.(${targetCats.map(encodeURIComponent).join(',')})`)
const counts = {}, changed = []
for (const c of cs) {
  const srcDefault = c.category === '浴室' ? '浴室' : '房間清潔'
  const text = `${c.guest_comment} ${c.improvement || ''}`
  const to = classify(text, srcDefault)
  counts[to] = (counts[to] || 0) + 1
  if (to !== c.category && !(c.category === '房間' && to === '房間清潔')) changed.push([c.id, to, c.guest_comment.slice(0, 22)])
}
console.log('重新歸類後分佈：')
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
console.log(`\n需變更 ${changed.length} 筆`)
if (WRITE) {
  for (const [id, to] of changed) await req('PATCH', `complaints?id=eq.${id}`, { category: to })
  console.log('已寫入')
} else {
  changed.slice(0, 20).forEach(([, to, t]) => console.log(`  →${to}  ${t}`))
  console.log('（試算，加 --write 執行）')
}
