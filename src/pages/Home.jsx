import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { addDaysStr, todayStr } from '../lib/dates'
import { PERMS } from '../lib/accounts'

const num = v => parseInt(v, 10) || 0
const dleft = d => Math.round((new Date(d + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000)

// 首頁「今日概覽」：只顯示此帳號有權限查看的系統數字，撳一下直接跳去對應頁面
export default function Home({ session, go }) {
  const perm = session ? PERMS[session.role] : { quality: 'edit', boh: 'edit', defect: 'edit' }
  const [d, setD] = useState({})

  useEffect(() => {
    let dead = false
    ;(async () => {
      const r = {}
      try {
        if (perm.defect !== 'none') {
          const rows = await api.dbSelect('defect_records', { cols: 'id,status' })
          r.pending = rows.filter(x => x.status === 'pending').length
          r.processing = rows.filter(x => x.status === 'processing').length
        }
      } catch { /* 單項失敗不影響其他 */ }
      try {
        if (perm.boh !== 'none') {
          const [products, batches] = await Promise.all([api.dbSelect('products', { cols: 'id,status,stock,min_stock' }), api.dbSelect('product_batches', { cols: 'id,product_id,expiry_date,qty_remaining' })])
          const act = new Map(products.filter(p => p.status !== '停用').map(p => [p.id, p]))
          r.low = [...act.values()].filter(p => num(p.min_stock) > 0 && num(p.stock) < num(p.min_stock)).length
          r.exp = new Set(batches.filter(b => act.has(b.product_id) && b.expiry_date && num(b.qty_remaining) > 0 && dleft(b.expiry_date) <= 30).map(b => b.product_id)).size
        }
      } catch { /* */ }
      try {
        if (perm.quality !== 'none') {
          const rows = await api.listFindings(addDaysStr(-6))
          const batches = {}
          rows.forEach(f => { const k = f.batch || f.id; (batches[k] = batches[k] || { date: f.date, good: String(f.batch || '').startsWith('good-') }) })
          const bs = Object.values(batches)
          r.today = bs.filter(b => b.date === todayStr()).length
          r.issues7 = bs.filter(b => !b.good).length
          r.good7 = bs.filter(b => b.good).length
          const tally = {}
          rows.filter(f => !String(f.batch || '').startsWith('good-') && f.tag).forEach(f => { tally[f.tag] = (tally[f.tag] || 0) + 1 })
          const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
          r.top = top ? { name: top[0], n: top[1] } : null
        }
      } catch { /* */ }
      if (!dead) setD(r)
    })()
    return () => { dead = true }
  }, [])

  const tile = (key, label, value, sub, color, onClick) => (
    <button className="hm-tile" key={key} onClick={onClick}>
      <span className="hm-lab">{label}</span>
      <b className="hm-num" style={{ color: value > 0 && color ? color : 'var(--ink)' }}>{value == null ? '—' : value}</b>
      <span className="hm-sub">{sub}</span>
    </button>
  )

  const tiles = []
  if (perm.defect !== 'none') tiles.push(tile('p', '待處理缺陷', d.pending, d.processing != null ? `處理中 ${d.processing}` : ' ', '#c62828', () => go('defect', { status: 'pending' })))
  if (perm.boh !== 'none') {
    tiles.push(tile('l', '需補貨', d.low, '清潔劑低於最低庫存', '#c62828', () => go('boh', { fk: 'low' })))
    tiles.push(tile('e', '臨期批次', d.exp, '30 日內到期或已過期', '#e69500', () => go('boh', { fk: 'exp' })))
  }
  if (perm.quality !== 'none') {
    tiles.push(tile('t', '今日查房', d.today, d.issues7 != null ? `近 7 日：⚠ ${d.issues7}　⭐ ${d.good7}` : ' ', null, () => go('findings')))
  }
  if (!tiles.length) return null
  return (
    <div className="hm">
      <h2 className="hm-h">今日概覽</h2>
      <div className="hm-grid">{tiles}</div>
      {perm.quality !== 'none' && d.top && (
        <button className="hm-wide" onClick={() => go('findings')}>
          <span className="hm-lab">近 7 日最常見問題</span>
          <b>{d.top.name}</b>
          <span className="hm-sub">共 {d.top.n} 次，點進去查看查房記錄</span>
        </button>
      )}
    </div>
  )
}
