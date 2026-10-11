// 切換前端連線：把嵌入的後勤與缺陷頁面改連品質專案（搬完資料並核對筆數後才執行）
// 用法：node scripts/merge-patch.mjs
import fs from 'fs'
const root = new URL('../', import.meta.url)
const rd = p => fs.readFileSync(new URL(p, root), 'utf8')
const wr = (p, s) => fs.writeFileSync(new URL(p, root), s)
const env = Object.fromEntries(rd('.env').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]))
const rep = (s, a, b) => { if (!s.includes(a)) throw new Error('miss ' + a.slice(0, 50)); return s.split(a).join(b) }
let boh = rd('public/boh/index.html')
const bohKey = (boh.match(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/) || [])[0]
boh = rep(boh, 'https://qxgntqtzaefapjyxaqhs.supabase.co', env.VITE_SUPABASE_URL)
boh = rep(boh, bohKey, env.VITE_SUPABASE_ANON_KEY)
boh = rep(boh, 'sb.from("categories")', 'sb.from("boh_categories")')
wr('public/boh/index.html', boh)
let d = rd('public/defect/index.html')
const dKey = (d.match(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/) || [])[0]
d = rep(d, 'https://lxzaeowijxtayogkhjij.supabase.co', env.VITE_SUPABASE_URL)
d = rep(d, dKey, env.VITE_SUPABASE_ANON_KEY)
d = rep(d, "sb.from('users')", "sb.from('defect_users')")
d = rep(d, "sb.from('defects')", "sb.from('defect_records')")
wr('public/defect/index.html', d)
console.log('patched')
