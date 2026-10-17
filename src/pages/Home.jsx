import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { addDaysStr, todayStr } from '../lib/dates'
import { PERMS, SUP_FLOORS } from '../lib/accounts'
import { SOFA_ROOMS, SOFA_TYPE } from '../data/sofaRooms'

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
            // 大床梳化：自己樓層仍未檢查的房間數
            try {
              const sc = await api.dbSelect('sofa_checks')
              const okSet = new Set(sc.map(x => x.room))
              const withDef = new Set(all.filter(x => SOFA_TYPE.test(x.type || '')).map(x => x.room))
              const myRooms = SOFA_ROOMS.filter(x => (fl && fl.length ? fl.map(String).includes(String(x.floor)) : true))
              r.sofaTodo = myRooms.filter(x => !okSet.has(x.room) && !withDef.has(x.room)).length
              r.sofaAll = myRooms.length
            } catch { /* 資料表未建立前不顯示 */ }
            const open = rows.filter(x => x.status !== 'done')
            r.mineOpenN = open.length
            const days = x => Math.round((new Date(todayStr() + 'T00:00:00') - new Date(String(x.register_date || x.created_at).slice(0, 10) + 'T00:00:00')) / 86400000)
            r.aged = { m3: open.filter(x => days(x) >= 90).length, m6: open.filter(x => days(x) >= 180).length, y1: open.filter(x => days(x) >= 365).length }
            const by = {}
            open.forEach(x => { const k = String(x.type || '其他').replace(/^\d+\.\s*/, ''); const o = (by[k] = by[k] || { type: x.type, name: k, n: 0, high: 0 }); o.n++; if (x.severity === 'high') o.high++ })
            r.byType = Object.values(by).sort((a, b) => b.n - a.n)
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
      {isSup && d.byType && (
        <div className="hm-mine">
          <div className="hm-mine-h"><b>{d.floors ? `歡迎，${d.floors.join('、')} 樓主管` : '歡迎，樓層主管'}</b><span>缺陷總覽</span></div>
          <div className="hm-mine-n">
            <button onClick={() => go('defect', { status: 'pending', floor: d.floors && d.floors.length === 1 ? d.floors[0] : '' })}><b style={{ color: d.pending ? '#c62828' : undefined }}>{d.pending}</b><span>待處理</span></button>
            <button onClick={() => go('defect', { status: 'processing', floor: d.floors && d.floors.length === 1 ? d.floors[0] : '' })}><b style={{ color: d.processing ? '#e69500' : undefined }}>{d.processing}</b><span>處理中</span></button>
            <button onClick={() => go('defect', { floor: d.floors && d.floors.length === 1 ? d.floors[0] : '' })}><b>{d.new7}</b><span>近 7 日新增</span></button>
          </div>
          {d.sofaTodo != null && d.sofaAll > 0 && (
            <button className="hm-sofa" onClick={() => go('defect', { view: 'sofa' })}>
              <span>🛋 大床梳化檢查</span>
              <b>{d.sofaTodo > 0 ? `尚有 ${d.sofaTodo} 間待確認` : '全部已確認 ✓'}</b>
              <i>›</i>
            </button>
          )}
          {d.aged && d.aged.m3 > 0 && (
            <div className="hm-aged">
              <span>未完成已拖延</span>
              <b className="a3">≥ 3 個月 {d.aged.m3}</b>
              <b className="a6">≥ 半年 {d.aged.m6}</b>
              <b className="a12">≥ 1 年 {d.aged.y1}</b>
            </div>
          )}
          {d.byType.length === 0 && <p className="hm-mine-empty">目前沒有未處理的缺陷 👍</p>}
          {d.byType.length > 0 && <div className="hm-ty-h">按缺陷類型</div>}
          {d.byType.slice(0, 6).map(t => (
            <button className="hm-ty" key={t.name} onClick={() => go('defect', { type: t.type, floor: d.floors && d.floors.length === 1 ? d.floors[0] : '' })}>
              <span className="hm-ty-n">{t.name}</span>
              <span className="hm-ty-bar"><i style={{ width: Math.max(8, Math.round(t.n / d.byType[0].n * 100)) + '%' }} /></span>
              <b>{t.n}</b>
            </button>
          ))}
          {d.byType.length > 6 && <button className="linky" style={{ fontSize: 13, margin: '6px 0 0' }} onClick={() => go('defect')}>另有 {d.byType.length - 6} 種類型 ›</button>}
        </div>
      )}
    </div>
  )
}
