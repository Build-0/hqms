// 搬資料：後勤(BOH)與缺陷系統 → 品質系統專案。可重複執行（以 id 合併）。
// 前提：已在品質專案的 SQL Editor 執行 supabase/merge-boh-defect.sql；本機 .env 為品質專案的網址與 anon key。
// 用法：node scripts/merge-copy.mjs
// （舊專案的 anon key 本來就公開在網頁裡，不是秘密）
import fs from 'node:fs'
const root = new URL('../', import.meta.url)
const rd = p => fs.readFileSync(new URL(p, root), 'utf8')
const envFile = Object.fromEntries(rd('.env').split(String.fromCharCode(10)).map(l => l.split(String.fromCharCode(13)).join('')).filter(l => l.includes('=')).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]))
const NEW = { url: envFile.VITE_SUPABASE_URL, key: envFile.VITE_SUPABASE_ANON_KEY }
const BOH = { url: 'https://qxgntqtzaefapjyxaqhs.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4Z250cXR6YWVmYXBqeXhhcWhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzM5ODQsImV4cCI6MjEwMjU0OTk4NH0.PZeJEbGlBFIE1GVCjAJZgPEw_v9R_AYc956HlJoimlg' }
const DEF = { url: 'https://lxzaeowijxtayogkhjij.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4emFlb3dpanh0YXlvZ2toamlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODM5OTEsImV4cCI6MjA5NTA1OTk5MX0.6B_YLKKaoiJY9Iw-QTBY2TwNIndQxkk-yc8M-TDcxXM' }
const H = c => ({ apikey: c.key, Authorization: 'Bearer ' + c.key })
const getAll = async (c, t, order = 'id') => { const out = []; for (let off = 0; ; off += 200) { const r = await fetch(`${c.url}/rest/v1/${t}?select=*&order=${order}&limit=200&offset=${off}`, { headers: H(c) }); const j = await r.json(); if (!Array.isArray(j)) throw new Error(t + ' read ' + JSON.stringify(j).slice(0, 100)); out.push(...j); if (j.length < 200) break } return out }
const put = async (t, rows) => { const r = await fetch(`${NEW.url}/rest/v1/${t}?on_conflict=id`, { method: 'POST', headers: { ...H(NEW), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error(`${t} write ${r.status} ${(await r.text()).slice(0, 200)}`) }
const copy = async (src, from, to, batch) => { const rows = await getAll(src, from); for (let i = 0; i < rows.length; i += batch) await put(to, rows.slice(i, i + batch)); console.log(from, '→', to, rows.length); return rows.length }

const counts = {}
// 後勤（外鍵順序）
for (const [f, t, b] of [['categories', 'boh_categories', 100], ['tool_categories', 'tool_categories', 100], ['equipment_types', 'equipment_types', 100], ['vacuum_floors', 'vacuum_floors', 100],
  ['products', 'products', 4], ['product_batches', 'product_batches', 100], ['stock_movements', 'stock_movements', 100],
  ['vacuums', 'vacuums', 3], ['vacuum_maintenance', 'vacuum_maintenance', 100], ['tools', 'tools', 4], ['equipment', 'equipment', 3], ['equipment_maintenance', 'equipment_maintenance', 100]])
  counts[t] = await copy(BOH, f, t, b)

// 缺陷：先搬相片到新儲存桶，再把網址改成新專案的
await copy(DEF, 'defect_types', 'defect_types', 100); counts.defect_types = 10
await copy(DEF, 'users', 'defect_users', 100)
const defects = await getAll(DEF, 'defects')
const oldBase = `${DEF.url}/storage/v1/object/public/defect-photos/`
let moved = 0, failed = 0
for (const d of defects) {
  const photos = Array.isArray(d.photos) ? d.photos : []
  const np = []
  for (const u of photos) {
    if (typeof u === 'string' && u.startsWith(oldBase)) {
      const path = u.slice(oldBase.length)
      try {
        const g = await fetch(u); if (!g.ok) throw new Error('dl ' + g.status)
        const buf = Buffer.from(await g.arrayBuffer())
        const up = await fetch(`${NEW.url}/storage/v1/object/defect-photos/${path}`, { method: 'POST', headers: { ...H(NEW), 'Content-Type': g.headers.get('content-type') || 'image/jpeg', 'x-upsert': 'true' }, body: buf })
        if (!up.ok) throw new Error('up ' + up.status + ' ' + (await up.text()).slice(0, 80))
        np.push(`${NEW.url}/storage/v1/object/public/defect-photos/${path}`); moved++; if (moved % 25 === 0) console.log("photos moved", moved)
      } catch (e) { failed++; np.push(u); if (failed < 4) console.log('photo fail', e.message) }
    } else np.push(u)
  }
  d.photos = np
}
for (let i = 0; i < defects.length; i += 50) await put('defect_records', defects.slice(i, i + 50))
console.log('defects → defect_records', defects.length, '相片搬移', moved, '失敗(保留舊網址)', failed)
await fetch(`${NEW.url}/rest/v1/rpc/merge_fix_sequences`, { method: 'POST', headers: { ...H(NEW), 'Content-Type': 'application/json' }, body: '{}' })

// 核對筆數
const cnt = async (c, t) => { const r = await fetch(`${c.url}/rest/v1/${t}?select=id&limit=1`, { headers: { ...H(c), Prefer: 'count=exact' } }); return +(r.headers.get('content-range') || '').split('/')[1] }
const pairs = [[BOH, 'categories', 'boh_categories'], [BOH, 'products', 'products'], [BOH, 'vacuums', 'vacuums'], [BOH, 'vacuum_maintenance', 'vacuum_maintenance'], [BOH, 'tools', 'tools'], [BOH, 'equipment', 'equipment'], [BOH, 'equipment_maintenance', 'equipment_maintenance'], [BOH, 'product_batches', 'product_batches'], [BOH, 'stock_movements', 'stock_movements'], [DEF, 'defects', 'defect_records'], [DEF, 'users', 'defect_users'], [DEF, 'defect_types', 'defect_types']]
for (const [c, a, b] of pairs) { const x = await cnt(c, a), y = await cnt(NEW, b); console.log(x === y ? '✓' : '✗', a, x, '→', b, y) }
