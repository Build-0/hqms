// 匯入清潔度考核評分表（70 位房務員名單 + 26 筆七維度評分）
// 依賴：add-modules.sql、add-scoring.sql 已執行
// 用法：node scripts/import-scores.mjs [--write]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import XLSX from 'xlsx'

const WRITE = process.argv.includes('--write')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
async function req(method, path, body) {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`)
  return r.json()
}

const DIMS = ['抹塵', '吸塵', '鋪床', '清潔器皿', '玻璃及鏡面', '物品整齊度', '做房車整潔度']
const XLSX_PATH = process.argv.find(a => a.endsWith('.xlsx'))
  || 'C:/Users/user/Documents/xwechat_files/bensoning_c894/msg/file/2026-07/清潔度考核評分表 from 4 June 2026.xlsx'
const wb = XLSX.readFile(XLSX_PATH)
const a = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
const rows = a.slice(8).filter(r => String(r[2] || '').trim() || String(r[3] || '').trim())

// 抽查人欄形如 "22June 2026 Ice " → 拆日期與抽查人
const parseInspect = s => {
  const t = String(s || '').trim()
  const m = t.match(/(\d{1,2})\s*([A-Za-z]{3,})\s*(\d{4})/)
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
  let date = null
  if (m) {
    const mon = MON[m[2].slice(0, 3).toLowerCase()]
    if (mon) date = `${m[3]}-${String(mon).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  const inspector = t.replace(/\d{1,2}\s*[A-Za-z]{3,}\s*\d{4}/, '').trim()
  return { date, inspector }
}

const roster = rows.map(r => ({
  floor: String(r[1] || '').trim(),
  name: String(r[2] || '').trim(),
  name_cn: String(r[3] || '').trim(),
  emp_id: String(r[4] || '').trim(),
  room: String(r[5] || '').trim(),
  inspect: String(r[6] || '').trim(),
  dims: DIMS.map((_, i) => String(r[7 + i] || '').trim()),
})).filter(x => x.name || x.name_cn)

// ── 名單 ──
const hasCols = await req('GET', 'attendants?select=name_cn&limit=1').then(() => true).catch(() => false)
if (!hasCols) console.log('⚠ 尚未執行 add-scoring.sql，本次僅試算（不可 --write）')
const existAtt = await req('GET', `attendants?select=id,name${hasCols ? ',name_cn,emp_id' : ''}&limit=500`)
for (const x of existAtt) { x.emp_id = x.emp_id || ''; x.name_cn = x.name_cn || '' }
const attKey = new Map(existAtt.map(x => [(x.emp_id || x.name).toLowerCase(), x]))
let attNew = 0, attUpd = 0
const idByRow = new Map()
for (let i = 0; i < roster.length; i++) {
  const p = roster[i]
  const key = (p.emp_id || p.name).toLowerCase()
  let hit = attKey.get(key) || existAtt.find(x => x.name.toLowerCase() === p.name.toLowerCase())
  if (hit) {
    idByRow.set(i, hit.id)
    const patch = {}
    if (p.name_cn && !hit.name_cn) patch.name_cn = p.name_cn
    if (p.emp_id && !hit.emp_id) patch.emp_id = p.emp_id
    if (p.floor) patch.floor = p.floor
    if (Object.keys(patch).length) { if (WRITE) await req('PATCH', `attendants?id=eq.${hit.id}`, patch); attUpd++ }
  } else {
    if (WRITE) {
      const [row] = await req('POST', 'attendants', { name: p.name || p.name_cn, name_cn: p.name_cn, floor: p.floor, emp_id: p.emp_id, active: true, sort_order: i })
      idByRow.set(i, row.id)
    }
    attNew++
  }
}
console.log(`名單：新增 ${attNew}、更新 ${attUpd}（既有 ${existAtt.length}）`)

// ── 評分 ──
const existScores = WRITE ? await req('GET', 'scores?select=date,attendant_id,room&limit=1000') : []
const seen = new Set(existScores.map(s => `${s.date}|${s.attendant_id}|${s.room}`))
let scNew = 0, scSkip = 0, scPreview = []
for (let i = 0; i < roster.length; i++) {
  const p = roster[i]
  const nums = p.dims.map(x => parseInt(x, 10)).filter(n => !isNaN(n) && n > 0)
  if (nums.length < 7) continue // 未評分
  const { date, inspector } = parseInspect(p.inspect)
  const dims = Object.fromEntries(DIMS.map((k, j) => [k, parseInt(p.dims[j], 10) || 0]))
  const total = Object.values(dims).reduce((t, v) => t + v, 0)
  const attId = idByRow.get(i)
  const rec = { date: date || '2026-06-04', attendant_id: attId, room: p.room, dims, score: total, inspector, note: '', photos: [] }
  if (WRITE) {
    if (seen.has(`${rec.date}|${attId}|${rec.room}`)) { scSkip++; continue }
    await req('POST', 'scores', rec)
  }
  scNew++
  if (scPreview.length < 30) scPreview.push(`${rec.date} ${p.name} ${p.room} 總${total} [${p.dims.join(',')}] ${inspector}`)
}
console.log(`評分：${WRITE ? '新增' : '將新增'} ${scNew}、略過 ${scSkip}`)
if (!WRITE) { scPreview.forEach(x => console.log('  ' + x)); console.log('（試算，加 --write 執行）') }
else console.log('完成')
