// 匯入 客诉统计(2).xlsx：去重放入新客訴，補 RA/主管，新分類規則。加 --write 才寫入。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import XLSX from 'xlsx'
const WRITE = process.argv.includes('--write')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const req = async (m, p, b) => { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${await r.text()}`); return r.json() }

const XLSX_PATH = process.argv.find(a => a.endsWith('.xlsx')) || 'C:/Users/user/Documents/xwechat_files/bensoning_c894/msg/file/2026-08/客诉统计(2).xlsx'
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
  .filter(r => String(r[6] || '').trim() && !/Remark|备注|Date/i.test(String(r[6])))

const pad = n => String(n).padStart(2, '0')
const normDate = d => {
  if (d instanceof Date) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const s = String(d).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d+(\.\d+)?$/.test(s)) { const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(+s) * 86400000); return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` }
  const p = s.split('/'); if (p.length < 3) return null
  let [a, b, y] = p; if (+a > 12) [a, b] = [b, a]
  return `20${y.slice(-2)}-${pad(a)}-${pad(b)}`
}
const normRoom = r => String(r || '').trim().replace(/^RM\s*/i, '').replace(/\s+/g, '') || '—'
const clean = s => String(s || '').trim().replace(/\s+/g, ' ')
const badName = s => !s || s.length > 12 || /系統|地漏|rm\s*\d|room move|check/i.test(s)
const normName = s => (badName(clean(s)) ? '' : clean(s))

const items = raw.map(r => ({
  date: normDate(r[2]), source: clean(r[3]) || 'wechat', room: normRoom(r[4]),
  comment: clean(r[6]), handle: clean(r[7]), ra: normName(r[8]), sup: normName(r[9]),
})).filter(x => x.date && x.comment)

// 新分類規則（順序＝優先）→ [分類, 部門]
const RULES = [
  [/遺留|遗留|不見|不见|唔見|失竊|偷|少了|丟|太陽眼鏡|眼鏡$|相機|相机|iPhone|手機.*不見|項鏈|金鏈|耳機|充電器|證件/, '遺留物', '客房'],
  [/蟑螂|壁虎|蝸牛|蜗牛|蜘蛛|甲蟲|甲虫|蟋蟀|飛蟻|飞蚁|螞蟻|蚂蚁|蟻|虫|蟲|跳蝨|床蝨|虱|螨|咬|過敏|过敏|敏感|紅點|红点/, '蟲害', '客房'],
  [/(撞爛|打爛|撞烂|打烂).*燈罩/, '安全', '客房'],
  [/床單|床单|被套|被子|枕|布草|毛巾|浴巾|浴袍|床品|床上用品|被單|腳巾/, '床品布草', '客房'],
  [/電視|电视|冷氣|冷气|空調|空调|插座|燈罩爛|燈.{0,3}壞|灯.{0,3}坏|風筒|风筒|吹風|吹风|漏水|浸水|水管|跳閘|跳电|跳電|冰箱|體重秤|体重秤|电子称|喇叭|揚聲器|扬声器|隔音|窗外.{0,3}吵|噪音|滴水|排風|排风|抽氣扇|抽气|門卡|门卡|刷卡|電梯|电梯|設施|设施|老舊|老旧|天花|不夠凍|太熱|太冷|太凍|熨|烟感|報警器|门.{0,2}开关|連通門|连通门/, '設備', '工程其他'],
  [/排水|去水|地漏|排不了|存不了水|滲水|渗水|花灑|花洒|水龍頭|水龙头|水壓|水压|出水|軟管|噴頭|水塞|沖涼去水/, '排水花灑', '工程其他'],
  [/馬桶|马桶|廁所|厕所|尿|屎/, '馬桶廁所', '客房'],
  [/臭|煙味|烟味|發霉|霉|餿|异味|異味|尿味|難聞|难闻|汗味|抽過菸|香薰味|一陣.{0,4}味/, '氣味異味', '客房'],
  [/地毯|地氈|地板|地墊|瓷磚|瓷砖|壁紙|壁纸|背景牆/, '地毯地板', '客房'],
  [/浴缸|淋浴|洗手台|洗手盆|玻璃門|防水膠|刮鬍刀|刮胡刀|浴室|沖涼房|企缸/, '浴室衛生', '客房'],
  [/跌|摔|滑倒|撞|刮傷|刮伤|夾|夹|受傷|受伤|踢|流血|燙|烫|警|消防|符|驚嚇|惊吓/, '安全', '客房'],
  [/態度|态度|敲門|敲门|直接入|入房|沒回應|没回应|沒打掃|没打扫|不整理|服務|服务|禮儀|礼仪|收費|收费|水不夠|不够喝|回應|回应|拒絕|拒绝|加床|加枕|香水/, '服務', '客房'],
]
const classify = t => { for (const [re, cat, dept] of RULES) if (re.test(t)) return [cat, dept]; return ['房間清潔', '客房'] }
const isAbuse = t => /新鮮|新鲜/.test(t)

let hasStaff = true; try { await req('GET', 'complaints?select=ra&limit=1') } catch { hasStaff = false }
const existing = await req('GET', 'complaints?select=id,date,room,guest_comment,improvement,ra,supervisor&limit=3000')
const byKey = new Map()
for (const c of existing) { const k = `${c.date}|${String(c.room).trim()}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(c) }

let ins = 0, upd = 0, skip = 0; const toInsert = []; const used = new Set()
for (const it of items) {
  const pool = (byKey.get(`${it.date}|${it.room}`) || []).filter(c => !used.has(c.id))
  let hit = pool.find(c => c.guest_comment.slice(0, 6) === it.comment.slice(0, 6)) || pool[0]
  if (!hit && it.room === '—') hit = existing.find(c => c.date === it.date && !used.has(c.id) && c.guest_comment.includes(it.comment.slice(0, 6)))
  if (hit) {
    used.add(hit.id); const patch = {}
    if (hasStaff && it.ra && !hit.ra) patch.ra = it.ra
    if (hasStaff && it.sup && !hit.supervisor) patch.supervisor = it.sup
    if (it.handle && !hit.improvement) patch.improvement = it.handle
    if (Object.keys(patch).length) { if (WRITE) await req('PATCH', `complaints?id=eq.${hit.id}`, patch); upd++ } else skip++
  } else {
    const [cat, dept] = classify(it.comment + ' ' + it.handle)
    toInsert.push({ date: it.date, source: it.source, room: it.room, category: cat, dept, nature: isAbuse(it.comment + it.handle) ? '濫訴' : '投訴', guest_comment: it.comment, actual_cause: '', correct_standard: '', improvement: it.handle, ...(hasStaff ? { ra: it.ra, supervisor: it.sup } : {}), shared: false, check_scheduled: false, recurred: false, photos: [], tags: [] })
    ins++
  }
}
console.log(`比對：新增 ${ins}、更新 ${upd}、無變化 ${skip}（既有 ${existing.length}）`)
const byM = {}; for (const r of toInsert) { const m = r.date.slice(0, 7); byM[m] = (byM[m] || 0) + 1 }
console.log('新增分月：' + JSON.stringify(byM))
if (!WRITE) { toInsert.slice(0, 30).forEach(r => console.log(`  ${r.date} ${r.room} [${r.category}] ${r.guest_comment.slice(0, 26)}`)); console.log('（試算，加 --write）') }
else { for (let i = 0; i < toInsert.length; i += 50) await req('POST', 'complaints', toInsert.slice(i, i + 50)); console.log('已寫入') }
