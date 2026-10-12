import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { addDaysStr, todayStr } from '../lib/dates'
import { PERMS, SUP_FLOORS } from '../lib/accounts'

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
          const all = await api.dbSelect('defect_records', { cols: 'id,status,room,floor,type,severity,created_by,register_date,created_at' })
          // 樓層主管：只計自己負責樓層（未設定樓層就計自己登記的）
          const fl = session && session.role === 'supervisor' ? SUP_FLOORS[session.id || session.key] : null
          const rows = session && session.role === 'supervisor'
            ? all.filter(x => (fl && fl.length ? fl.includes(String(x.floor)) : String(x.created_by) === String(session.id || session.name)))
            : all
          r.pending = rows.filter(x => x.status === 'pending').length
          r.processing = rows.filter(x => x.status === 'processing').length
          if (session && session.role === 'supervisor') {
            r.floors = fl && fl.length ? fl : null
            r.mineOpen = rows.filter(x => x.status !== 'done')
              .sort((a, b) => String(a.register_date || a.created_at).localeCompare(String(b.register_date || b.created_at)))
            r.new7 = rows.filter(x => String(x.register_date || x.created_at).slice(0, 10) >= addDaysStr(-6)).length
          }
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
  const isSup = !!session && session.role === 'supervisor'
  const SEV = { high: ['嚴重', 'b-red'], medium: ['中度', 'b-amber'], low: ['輕微', 'b-teal'] }
  const ago = x => Math.max(0, Math.round((new Date(todayStr() + 'T00:00:00') - new Date(String(x.register_date || x.created_at).slice(0, 10) + 'T00:00:00')) / 86400000))
  if (perm.defect !== 'none' && !isSup) tiles.push(tile('p', '待處理缺陷', d.pending, d.processing != null ? `處理中 ${d.processing}` : ' ', '#c62828', () => go('defect', { status: 'pending' })))
  if (perm.boh !== 'none') {
    tiles.push(tile('l', '需補貨', d.low, '清潔劑低於最低庫存', '#c62828', () => go('boh', { fk: 'low' })))
    tiles.push(tile('e', '臨期批次', d.exp, '30 日內到期或已過期', '#e69500', () => go('boh', { fk: 'exp' })))
  }
  if (perm.quality !== 'none') {
    tiles.push(tile('t', '今日查房', d.today, d.issues7 != null ? `近 7 日：⚠ ${d.issues7}　⭐ ${d.good7}` : ' ', null, () => go('findings')))
  }
  if (!tiles.length && !isSup) return null
  return (
    <div className="hm">
      <h2 className="hm-h">今日概覽</h2>
      <div className="hm-grid">{tiles}</div>
      {isSup && d.mineOpen && (
        <div className="hm-mine">
          <div className="hm-mine-h"><b>{d.floors ? `我負責 ${d.floors.join('、')} 樓` : '我登記的缺陷'}</b><span>缺陷總覽</span></div>
          <div className="hm-mine-n">
            <button onClick={() => go('defect', { status: 'pending' })}><b style={{ color: d.pending ? '#c62828' : undefined }}>{d.pending}</b><span>待處理</span></button>
            <button onClick={() => go('defect', { status: 'processing' })}><b style={{ color: d.processing ? '#e69500' : undefined }}>{d.processing}</b><span>處理中</span></button>
            <button onClick={() => go('defect')}><b>{d.new7}</b><span>近 7 日新增</span></button>
          </div>
          {d.mineOpen.length === 0 && <p className="hm-mine-empty">目前沒有未處理的缺陷 👍</p>}
          {d.mineOpen.slice(0, 5).map(x => (
            <button className="hm-row" key={x.id} onClick={() => go('defect', { status: x.status })}>
              <b>{x.room}</b><span className="hm-row-t">{x.type}</span>
              <span className={`badge ${(SEV[x.severity] || [])[1] || 'b-gray'}`}>{(SEV[x.severity] || [x.severity])[0]}</span>
              <span className="hm-row-d">{ago(x)} 日</span>
            </button>
          ))}
          {d.mineOpen.length > 5 && <button className="linky" style={{ fontSize: 13, margin: '6px 0 0' }} onClick={() => go('defect')}>查看全部 {d.mineOpen.length} 筆 ›</button>}
        </div>
      )}
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
