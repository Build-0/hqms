// 匯入 2026-08 版 客诉统计.xlsx（完整 1–8 月，336 列）
// 策略：以「日期＋房號」為主鍵比對既有記錄 → 命中則補 RA／主管／處理內容，未命中則新增
// 無房號的賓客意見以「日期＋內容前 8 字」比對
// 加 --write 才會實際寫入，否則只試算
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

const XLSX_PATH = process.argv.find(a => a.endsWith('.xlsx'))
  || 'C:/Users/user/Documents/xwechat_files/bensoning_c894/msg/file/2026-08/客诉统计.xlsx'
const wb = XLSX.readFile(XLSX_PATH)
const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
  .slice(1).filter(r => String(r[2] || '').trim() && String(r[6] || '').trim())

// 支援 M/D/YY 與 D/M/YYYY 兩種格式（首段 > 12 視為日）
const normDate = d => {
  const p = String(d).trim().split('/')
  if (p.length < 3) return null
  let [a, b, y] = p
  if (+a > 12) [a, b] = [b, a]
  return `20${y.slice(-2)}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
}
const normRoom = r => String(r || '').trim().replace(/^RM\s*/i, '').replace(/\s+/g, '') || '—'
const clean = s => String(s || '').trim().replace(/\s+/g, ' ')
// 明顯不是人名的欄位值（表格裡誤填的備註）
const badName = s => !s || s.length > 12 || /系統|地漏|rm\s*\d/i.test(s)
const normName = s => (badName(clean(s)) ? '' : clean(s))

const SRC_MAP = { 'wechat': 'wechat', 'Guest comment': 'Guest comment', 'Incident report': 'Incident report', 'FO Mail': 'FO Mail' }

const items = raw.map(r => ({
  date: normDate(r[2]),
  source: SRC_MAP[clean(r[3])] || clean(r[3]) || 'wechat',
  room: normRoom(r[4]),
  comment: clean(r[6]),
  handle: clean(r[7]),
  ra: normName(r[8]),
  sup: normName(r[9]),
})).filter(x => x.date)

// ── 分類與部門判斷 ──
const RULES = [
  [/蟑螂|壁虎|蝸牛|蜘蛛|甲蟲|蟋蟀|虫|蟲|跳蝨|床蝨|虱|螨|咬|敏感|紅點|痕|癢|痒/, '蟲害', '客房'],
  [/床單|床单|被套|被子|枕|布草|毛巾|浴巾|浴袍|床品|床上用品|被單/, '床品布草', '客房'],
  [/遺留|遗留|不見|不见|唔見|失竊|偷|少了|丟/, '遺留物', '客房'],
  [/電視|电视|冷氣|冷气|空調|空调|插座|燈|灯|風筒|吹風|吹风|馬桶排水|排水慢|漏水|水壓|水压|跳閘|跳电|花灑|花洒|水龍頭|水龙头|冰箱|體重秤|体重秤|电子称|喇叭|揚聲器|扬声器|隔音|吵|噪音|滴水|排風|排风|抽氣|抽气|烟感|門卡|门卡|刷卡|電梯|电梯|設施|设施|老舊|老旧|廉價|廉价|天花板掉|水塞|存不了水|不夠凍|不凍|太熱|太冷|太凍/, '設備', '工程其他'],
  [/跌|摔|滑倒|撞|刮傷|刮伤|夾|夹|受傷|受伤|踢到|流血|燙|烫|警|消防|符/, '安全', '客房'],
  [/馬桶|马桶|浴缸|浴室|廁所|厕所|淋浴|洗手盆|地漏|花灑軟管|排水口/, '浴室', '客房'],
  [/態度|态度|敲門|敲门|直接入|入房|沒回應|服務|服务|禮儀|礼仪|收費|收费|香薰|水不夠|不够喝|回應|回应/, '服務', '客房'],
]
function classify(t) {
  for (const [re, cat, dept] of RULES) if (re.test(t)) return [cat, dept]
  return ['房間', '客房']
}
const FRESH = /新鮮|新鲜/
const isAbuse = t => FRESH.test(t)

// ── 讀既有記錄（自動偵測 ra/supervisor 欄是否已建立）──
let hasStaff = true
try { await req('GET', 'complaints?select=ra&limit=1') } catch { hasStaff = false }
if (!hasStaff) console.log('⚠ ra/supervisor 欄尚未建立，請先執行 supabase/add-staff.sql（本次試算仍可進行）')
const cols = `id,date,room,guest_comment,improvement,category,dept,nature${hasStaff ? ',ra,supervisor' : ''}`
const existing = await req('GET', `complaints?select=${cols}&limit=2000`)
const byKey = new Map()
for (const c of existing) {
  const k = `${c.date}|${String(c.room).trim()}`
  if (!byKey.has(k)) byKey.set(k, [])
  byKey.get(k).push(c)
}

let upd = 0, ins = 0, skip = 0
const toInsert = []
const usedIds = new Set()

for (const it of items) {
  const key = `${it.date}|${it.room}`
  const pool = (byKey.get(key) || []).filter(c => !usedIds.has(c.id))
  let hit = pool[0]
  if (!hit && it.room === '—') {
    // 無房號：同日 + 內容開頭相近
    const head = it.comment.slice(0, 6)
    hit = existing.find(c => c.date === it.date && !usedIds.has(c.id) && c.guest_comment.includes(head.slice(0, 4)))
  }
  const text = it.comment + ' ' + it.handle
  const [cat, dept] = classify(text)

  if (hit) {
    usedIds.add(hit.id)
    const patch = {}
    if (hasStaff && it.ra && !hit.ra) patch.ra = it.ra
    if (hasStaff && it.sup && !hit.supervisor) patch.supervisor = it.sup
    if (it.handle && !hit.improvement) patch.improvement = it.handle
    if (Object.keys(patch).length) {
      if (WRITE) await req('PATCH', `complaints?id=eq.${hit.id}`, patch)
      upd++
    } else skip++
  } else {
    toInsert.push({
      date: it.date, source: it.source, room: it.room,
      category: cat, dept, nature: isAbuse(text) ? '濫訴' : '投訴',
      guest_comment: it.comment, actual_cause: '', correct_standard: '', improvement: it.handle,
      ...(hasStaff ? { ra: it.ra, supervisor: it.sup } : {}),
      shared: false, check_scheduled: false, recurred: false, photos: [],
    })
    ins++
  }
}

console.log(`比對結果：更新 ${upd}、新增 ${ins}、無變化 ${skip}（既有 ${existing.length} 筆）`)
if (!WRITE) {
  console.log('--- 將新增的前 25 筆 ---')
  for (const r of toInsert.slice(0, 25)) console.log(`${r.date} ${r.room} [${r.category}/${r.dept}/${r.nature}] ${r.guest_comment.slice(0, 30)} | RA:${r.ra}`)
  const byM = {}
  for (const r of toInsert) { const m = r.date.slice(0, 7); byM[m] = (byM[m] || 0) + 1 }
  console.log('新增分月：' + JSON.stringify(byM))
  console.log('（試算模式，未寫入。加 --write 執行）')
} else {
  for (let i = 0; i < toInsert.length; i += 50) await req('POST', 'complaints', toInsert.slice(i, i + 50))
  console.log('已寫入完成')
}
