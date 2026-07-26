// 一次性資料遷移（2026-07-26）：
// ① 分類插入「蟲害」於安全與遺留物之間（sort_order 重排）
// ② 主題/教材內容粵語→繁體國語（按標題比對更新，使用者改過標題的不動）
// ③ 客訴記錄簡體→繁體國語；連通門/夜燈/工程噪音三筆改性質為「工程投訴」
// 用法：node scripts/migrate-20260726.mjs（讀 .env 的 URL 與 anon key，開放模式下可寫）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { seedTopics, TRAINING } from '../src/data/seedData.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function req(method, path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method, headers: { ...H, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`)
  return r.json()
}

// ① 蟲害分類
const cats = await req('GET', 'categories?select=id,name,sort_order&order=sort_order')
if (!cats.some(c => c.name === '蟲害')) {
  for (const c of cats) {
    if (['遺留物', '工具', '工作間'].includes(c.name))
      await req('PATCH', `categories?id=eq.${c.id}`, { sort_order: c.sort_order + 1 })
  }
  await req('POST', 'categories', { name: '蟲害', emoji: '🐛', color: '#7d9440', sort_order: 4 })
  console.log('① 已插入分類「蟲害」（安全與遺留物之間）')
} else console.log('① 蟲害已存在，略過')

// ② 主題內容同步（標題比對；床底及梳化底檢查 → 床底及沙發底檢查）
const RENAMES = { '床底及沙發底檢查': '床底及梳化底檢查', '濕滑告示牌擺放': '濕地牌擺放' }
let tOk = 0, tMiss = []
for (const t of seedTopics) {
  const oldTitle = RENAMES[t.title] || t.title
  const rows = await req('PATCH', `topics?title=eq.${encodeURIComponent(oldTitle)}`, {
    title: t.title, why: t.why, correct_steps: t.correct_steps, mistakes: t.mistakes,
    supervisor_check: t.supervisor_check, reminder: t.reminder, question: t.question, answer: t.answer,
  })
  if (rows.length) tOk++
  else tMiss.push(oldTitle)
}
console.log(`② 主題已更新 ${tOk}/${seedTopics.length}${tMiss.length ? `（找不到：${tMiss.join('、')}）` : ''}`)

let gOk = 0, gMiss = []
for (const t of TRAINING) {
  const rows = await req('PATCH', `training_sections?title=eq.${encodeURIComponent(t.title)}`, {
    intro: t.intro, steps: t.steps, emoji: t.emoji,
  })
  if (rows.length) gOk++
  else gMiss.push(t.title)
}
console.log(`② 教材已更新 ${gOk}/${TRAINING.length}${gMiss.length ? `（找不到：${gMiss.join('、')}）` : ''}`)

// ③ 客訴繁體化 + 工程投訴
const FIX = [
  ['2026-07-20', '925', { guest_comment: '客人稱遺留耳機', improvement: '複檢未發現' }],
  ['2026-07-20', '605.607', { guest_comment: '連通門不能自由開關', improvement: '轉房733.734', nature: '工程投訴' }],
  ['2026-07-20', '908', { guest_comment: '反映床單被套不乾淨', actual_cause: '月經血跡，判斷人為', improvement: '更換床品' }],
  ['2026-07-20', '320', { guest_comment: '反映床尾被套有污漬', actual_cause: '舊漬', improvement: '更換床品並送贈品' }],
  ['2026-07-20', '1056', { guest_comment: '反映礦泉水開過', actual_cause: '壓力不足引起水蓋鬆動', improvement: '解釋因壓力不足引起水蓋鬆動並…（截圖截斷，請在app補完）' }],
  ['2026-07-21', '1262', { guest_comment: '反映枕頭袋有污漬', actual_cause: '床已睡，新鮮污漬', improvement: '已更換枕頭袋…（截圖截斷，請在app補完）' }],
  ['2026-07-21', '1275', { guest_comment: '報警受到驚嚇', actual_cause: '因隔壁1277更換全身鏡工程噪音…（截圖截斷，請在app補完）', nature: '工程投訴' }],
  ['2026-07-22', '1258', { guest_comment: '反映被套裡面有污漬', improvement: '已更換並送贈品' }],
  ['2026-07-22', '1255', { guest_comment: '回房洗手台多出一粒藍莓', improvement: 'Fifi在體重秤附近撿起放置洗手台…（截圖截斷，請在app補完）' }],
  ['2026-07-23', '1003', { guest_comment: '致電總機床單有污漬', improvement: '更換床品並送贈品' }],
  ['2026-07-24', '1141', { guest_comment: '反映被套有污漬', improvement: '更換床品並送贈品' }],
  ['2026-07-24', '1156', { guest_comment: '反映床單有污漬', improvement: '更換床品並送贈品' }],
  ['2026-07-24', '974', { guest_comment: '客人稱夜燈壞', improvement: '客人當日拒絕維修', nature: '工程投訴' }],
  ['2026-07-24', '421', { guest_comment: '客人稱馬桶邊有尿漬，轉381後有頭髮，又轉379', improvement: '同DAN一起檢查並入VI…（截圖截斷，請在app補完）' }],
]
let cOk = 0
for (const [date, room, patch] of FIX) {
  const rows = await req('PATCH', `complaints?date=eq.${date}&room=eq.${encodeURIComponent(room)}`, patch)
  if (rows.length) cOk++
}
console.log(`③ 客訴已繁體化 ${cOk}/${FIX.length}（其中 3 筆改為工程投訴）`)
console.log('完成')
