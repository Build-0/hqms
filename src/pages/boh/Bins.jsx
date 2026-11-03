import { useRef, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { useBack } from '../../lib/nav'
import { Thumb, useImages, ListManager, num } from './shared'

// 垃圾桶分佈：每款垃圾桶 × 每個區域 = 使用中數量；倉存仍然記喺清潔工具（庫存）
export default function Bins({ d, edit, reload, reg, onClose }) {
  const bins = d.tools.filter(t => t.category === '垃圾桶' && t.status !== '停用')
  const areas = d.binAreas
  const img = useImages('tools', bins.map(t => t.id))
  const [rows, setRows] = useState(d.binCounts)
  const [view, setView] = useState('area')          // area 按區域／model 按款式
  const [sel, setSel] = useState(null)              // { k: 'area'|'model', id }
  const [mgr, setMgr] = useState(false)
  const rowsRef = useRef(rows); rowsRef.current = rows
  const chain = useRef(Promise.resolve())
  useBack(!!sel, () => setSel(null), 3)
  useBack(true, () => { onClose() }, 2)

  const qty = (t, a) => (rows.find(r => r.tool_id === t && r.area_id === a) || {}).qty || 0
  const areaTot = a => rows.filter(r => r.area_id === a && bins.some(t => t.id === r.tool_id)).reduce((n, r) => n + r.qty, 0)
  const modelTot = t => rows.filter(r => r.tool_id === t).reduce((n, r) => n + r.qty, 0)
  const inUse = bins.reduce((n, t) => n + modelTot(t.id), 0)
  const inStock = bins.reduce((n, t) => n + num(t.stock), 0)

  // 即時更新畫面，背景逐項依次寫入（避免連按時重複新增）
  function setQty(t, a, v) {
    v = Math.max(0, Math.min(9999, num(v)))
    setRows(prev => {
      const has = prev.some(r => r.tool_id === t && r.area_id === a)
      const next = has ? prev.map(r => (r.tool_id === t && r.area_id === a ? { ...r, qty: v } : r)) : [...prev, { id: null, tool_id: t, area_id: a, qty: v }]
      rowsRef.current = next
      return next
    })
    chain.current = chain.current.then(async () => {
      try {
        const cur = rowsRef.current.find(r => r.tool_id === t && r.area_id === a)
        if (cur && cur.id) await api.dbUpdate('bin_counts', cur.id, { qty: cur.qty, updated_at: new Date().toISOString() })
        else if (cur) { const r = await api.dbInsert('bin_counts', { tool_id: t, area_id: a, qty: cur.qty }); setRows(p => { const n = p.map(x => (x.tool_id === t && x.area_id === a ? { ...x, id: r.id } : x)); rowsRef.current = n; return n }) }
        await api.dbUpdate('tools', t, { in_use: rowsRef.current.filter(r => r.tool_id === t).reduce((n, r) => n + r.qty, 0) })
      } catch (ex) { toast('儲存失敗：' + ex.message) }
    })
  }

  if (reg) reg.current = () => ({
    title: '垃圾桶分佈',
    filterText: `使用中 ${inUse} ・ 倉存 ${inStock}`,
    cols: ['款式', '數量'],
    groups: [
      ...areas.map(a => ({ name: `${a.name}（共 ${areaTot(a.id)}）`, rows: bins.filter(t => qty(t.id, a.id) > 0).map(t => ({ photo: img(t.id), cells: [t.name, qty(t.id, a.id)], cls: ['', ''] })) })).filter(g => g.rows.length),
      { name: `各款合計（使用中 ${inUse}・倉存 ${inStock}）`, rows: bins.map(t => ({ photo: img(t.id), cells: [t.name, `使用 ${modelTot(t.id)}　倉 ${num(t.stock)}`], cls: ['', ''] })) },
    ],
  })

  const stepper = (t, a) => {
    const n = qty(t, a)
    return (
      <div className="bn-step">
        <button disabled={!edit || n <= 0} onClick={() => setQty(t, a, n - 1)}>−</button>
        <input type="number" inputMode="numeric" value={n || ''} placeholder="0" disabled={!edit} onChange={e => setQty(t, a, e.target.value)} onFocus={e => e.target.select()} />
        <button disabled={!edit} onClick={() => setQty(t, a, n + 1)}>＋</button>
      </div>
    )
  }

  // ── 明細頁：某區域（逐款）或某款式（逐區域）──
  if (sel) {
    const isArea = sel.k === 'area'
    const a = isArea ? areas.find(x => x.id === sel.id) : null
    const m = isArea ? null : bins.find(x => x.id === sel.id)
    if (!a && !m) return null
    const list = isArea ? [...bins].sort((x, y) => (qty(y.id, a.id) > 0) - (qty(x.id, a.id) > 0)) : areas
    return (
      <>
        <div className="bn-hd">
          {m && <Thumb src={img(m.id)} fallback="🗑" size={44} />}
          <div><b>{isArea ? a.name : m.name}</b><small>{isArea ? `使用中 ${areaTot(a.id)} 個` : `使用中 ${modelTot(m.id)} ・ 倉存 ${num(m.stock)}`}</small></div>
        </div>
        <div className="bn-list">
          {list.map(x => (
            <div className="bn-row" key={x.id}>
              {isArea && <Thumb src={img(x.id)} fallback="🗑" size={40} />}
              <span className="bn-nm">{x.name}</span>
              {stepper(isArea ? x.id : m.id, isArea ? a.id : x.id)}
            </div>
          ))}
        </div>
        {!edit && <p className="note">目前帳號只可查看</p>}
      </>
    )
  }

  return (
    <>
      <div className="bn-kpis">
        <div><b>{inUse}</b><small>使用中</small></div>
        <div><b>{inStock}</b><small>倉存</small></div>
        <div><b>{inUse + inStock}</b><small>合共</small></div>
      </div>
      <div className="bn-tabs">
        <button className={view === 'area' ? 'on' : ''} onClick={() => setView('area')}>按區域（{areas.length}）</button>
        <button className={view === 'model' ? 'on' : ''} onClick={() => setView('model')}>按款式（{bins.length}）</button>
        {edit && view === 'area' && <button className="bn-gear" title="管理區域" onClick={() => setMgr(true)}>⚙</button>}
      </div>
      {view === 'area' ? (
        <div className="sq-grid">
          {areas.map(a => (
            <button className="sq-card" key={a.id} onClick={() => setSel({ k: 'area', id: a.id })}>
              <span className="bn-ico">🗑</span>
              <span className="sq-name">{a.name}</span>
              <span className="sq-n">{areaTot(a.id)}<small>個</small></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sq-grid">
          {bins.map(t => (
            <button className="sq-card" key={t.id} onClick={() => setSel({ k: 'model', id: t.id })}>
              <Thumb src={img(t.id)} fallback="🗑" size={64} />
              <span className="sq-name">{t.name}</span>
              <span className="sq-n">{modelTot(t.id)}<small>使用 ・ 倉 {num(t.stock)}</small></span>
            </button>
          ))}
        </div>
      )}
      {mgr && <ListManager title="垃圾桶區域" table="bin_areas" rows={areas} onClose={() => setMgr(false)} onChanged={reload} />}
    </>
  )
}
