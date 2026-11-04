import { useRef, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { useBack } from '../../lib/nav'
import { Thumb, useImages, num } from './shared'

const KIND = { use: '使用中', store: '倉', off: '停用' }
const FLOORS = ['GF', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F', '11F', '12F']
const fno = f => { const i = FLOORS.indexOf(f); return i < 0 ? 99 : i }

// 垃圾桶分佈：每款垃圾桶 × 每個位置 = 數量（唯一數據來源）。位置分三類：使用中、倉（倉庫庫存、機械倉等）、停用。
// tools.in_use／tools.stock 由本頁自動同步（在用＝使用中位置加總；庫存＝倉位置加總）。
export default function Bins({ d, edit, reload, reg, onClose, onEditTool }) {
  const all = d.tools.filter(t => t.category === '垃圾桶')
  const areas = [...d.binAreas].sort((a, b) => fno(a.floor) - fno(b.floor) || (a.sort_order || 0) - (b.sort_order || 0))
  const img = useImages('tools', all.map(t => t.id))
  const [rows, setRows] = useState(d.binCounts)
  const [view, setView] = useState('area')          // area 按位置／model 按款式
  const [sel, setSel] = useState(null)              // { k: 'area'|'model', id }
  const [mgr, setMgr] = useState(false)
  const [extra, setExtra] = useState(() => new Set())   // 明細頁：數量為 0 但剛加入（或剛減到 0）嘅項目，離開頁面前保留喺列表
  const openSel = v => { setExtra(new Set()); setSel(v) }
  const [openRow, setOpenRow] = useState(null)       // 管理位置：展開咗邊個位置
  const [mk, setMk] = useState('all')                // 管理位置：篩選 all／use／store／off
  const [nf, setNf] = useState({ floor: '', name: '', kind: 'use' })
  const rowsRef = useRef(rows); rowsRef.current = rows
  const chain = useRef(Promise.resolve())
  useBack(!!sel, () => setSel(null), 3)
  useBack(true, () => { onClose() }, 2)

  const kindOf = id => (d.binAreas.find(a => a.id === id) || {}).kind || 'use'
  const qty = (t, a) => (rows.find(r => r.tool_id === t && r.area_id === a) || {}).qty || 0
  const areaTot = a => rows.filter(r => r.area_id === a).reduce((n, r) => n + r.qty, 0)
  const modelUse = t => rows.filter(r => r.tool_id === t && kindOf(r.area_id) === 'use').reduce((n, r) => n + r.qty, 0)
  const modelOf = (t, k) => rows.filter(r => r.tool_id === t && kindOf(r.area_id) === k).reduce((n, r) => n + r.qty, 0)
  const modelStore = t => modelOf(t, 'store')
  const modelOff = t => modelOf(t, 'off')
  const modelAll = t => modelUse(t) + modelStore(t) + modelOff(t)
  const bins = all.filter(t => t.status !== '停用' || modelAll(t.id) > 0)
  const inUse = all.reduce((n, t) => n + modelUse(t.id), 0)
  const storeN = all.reduce((n, t) => n + modelStore(t.id), 0)
  const offN = all.reduce((n, t) => n + modelOff(t.id), 0)
  const useAreas = areas.filter(a => a.kind === 'use'), storeAreas = areas.filter(a => a.kind === 'store'), offAreas = areas.filter(a => a.kind === 'off')
  const aName = a => (a.floor ? a.floor + ' ' : '') + a.name
  const sums = (t, list, over) => ({ in_use: list.filter(r => r.tool_id === t && (over && r.area_id === over.id ? over.kind : kindOf(r.area_id)) === 'use').reduce((n, r) => n + r.qty, 0), stock: list.filter(r => r.tool_id === t && (over && r.area_id === over.id ? over.kind : kindOf(r.area_id)) === 'store').reduce((n, r) => n + r.qty, 0) })

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
        await api.dbUpdate('tools', t, sums(t, rowsRef.current))
      } catch (ex) { toast('儲存失敗：' + ex.message) }
    })
  }
  async function addArea() {
    const floor = nf.floor.trim(), name = nf.name.trim()
    if (!name) { toast('請填位置名稱'); return }
    try { await api.dbInsert('bin_areas', { floor, name, kind: nf.kind, sort_order: (areas.length ? Math.max(...areas.map(a => a.sort_order || 0)) : 0) + 1 }); setNf({ ...nf, name: '' }); reload() } catch (ex) { toast('新增失敗：' + ex.message) }
  }
  async function setKind(a, kind) {
    try { await api.dbUpdate('bin_areas', a.id, { kind }); const t = new Set(rows.filter(r => r.area_id === a.id).map(r => r.tool_id)); reload()
      // 同步各款「在用」同「庫存」
      for (const id of t) await api.dbUpdate('tools', id, sums(id, rows, { id: a.id, kind }))
      toast('已更改類型')
    } catch (ex) { toast('更改失敗：' + ex.message) }
  }
  async function delArea(a) {
    if (!window.confirm(`刪除位置「${aName(a)}」同佢嘅垃圾桶數量記錄？`)) return
    try { await api.dbDelete('bin_areas', a.id); setRows(p => p.filter(r => r.area_id !== a.id)); reload() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }

  if (reg) reg.current = () => ({
    title: '垃圾桶分佈',
    filterText: `使用中 ${inUse} ・ 倉 ${storeN} ・ 停用 ${offN}　合共 ${inUse + storeN + offN}`,
    cols: ['款式', '數量'],
    groups: [
      ...useAreas.map(a => ({ name: `${aName(a)}（共 ${areaTot(a.id)}）`, rows: bins.filter(t => qty(t.id, a.id) > 0).map(t => ({ photo: img(t.id), cells: [t.name, qty(t.id, a.id)], cls: ['', ''] })) })),
      ...[...storeAreas, ...offAreas].map(a => ({ name: `【${KIND[a.kind]}】${aName(a)}（共 ${areaTot(a.id)}）`, rows: bins.filter(t => qty(t.id, a.id) > 0).map(t => ({ photo: img(t.id), cells: [t.name, qty(t.id, a.id)], cls: ['', ''] })) })),
      { name: `各款合計`, rows: bins.map(t => ({ photo: img(t.id), cells: [t.name, `使用中 ${modelUse(t.id)}　倉 ${modelStore(t.id)}　停用 ${modelOff(t.id)}　合共 ${modelAll(t.id)}`], cls: ['', ''] })) },
    ].filter(g => g.rows.length),
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

  // ── 明細頁：某位置（逐款）或某款式（逐位置）──
  if (sel) {
    const isArea = sel.k === 'area'
    const a = isArea ? areas.find(x => x.id === sel.id) : null
    const m = isArea ? null : all.find(x => x.id === sel.id)
    if (!a && !m) return null
    const cand = isArea ? bins.filter(t => t.status !== '停用') : areas
    const has = x => (isArea ? qty(x.id, a.id) : qty(m.id, x.id)) > 0 || extra.has(x.id)
    const list = cand.filter(has)
    const rest = cand.filter(x => !has(x))
    return (
      <>
        <div className="bn-hd">
          {m && <Thumb src={img(m.id)} fallback="🗑" size={44} />}
          <div><b>{isArea ? aName(a) : m.name}</b>
            <small>{isArea ? `${KIND[a.kind]}${a.kind === 'use' ? '' : '（唔計入使用中）'} ・ 共 ${areaTot(a.id)} 個` : `使用中 ${modelUse(m.id)} ・ 倉 ${modelStore(m.id)} ・ 停用 ${modelOff(m.id)} ・ 合共 ${modelAll(m.id)}`}</small></div>
        </div>
        <div className="bn-list">
          {list.map(x => (
            <div className="bn-row" key={x.id}>
              {isArea && <Thumb src={img(x.id)} fallback="🗑" size={40} />}
              <span className="bn-nm">{isArea ? x.name : aName(x)}{!isArea && x.kind !== 'use' && <em className="bn-tag">{KIND[x.kind]}</em>}</span>
              {stepper(isArea ? x.id : m.id, isArea ? a.id : x.id)}
            </div>
          ))}
        </div>
        {list.length === 0 && <div className="note">{isArea ? '呢個位置暫時冇垃圾桶' : '呢款暫時冇放喺任何位置'}</div>}
        {edit && rest.length > 0 && (
          <select className="df-sel" style={{ marginTop: 10, width: '100%' }} value="" onChange={e => { const id = Number(e.target.value); if (!id) return; setExtra(p => new Set([...p, id])); const x = cand.find(c => c.id === id); if (x) setQty(isArea ? x.id : m.id, isArea ? a.id : x.id, qty(isArea ? x.id : m.id, isArea ? a.id : x.id) || 1) }}>
            <option value="">{isArea ? '＋ 加入款式…' : '＋ 加入位置…'}</option>
            {rest.map(x => <option key={x.id} value={x.id}>{isArea ? x.name : aName(x) + (x.kind !== 'use' ? '（' + KIND[x.kind] + '）' : '')}</option>)}
          </select>
        )}
        {edit && m && onEditTool && <button className="mini-btn" style={{ marginTop: 14, width: '100%' }} onClick={() => onEditTool(m)}>✎ 編輯款式（改名、換相、最低庫存）</button>}
        {!edit && <p className="note">目前帳號只可查看</p>}
      </>
    )
  }

  const byFloor = FLOORS.concat([...new Set(useAreas.map(a => a.floor).filter(f => !FLOORS.includes(f)))]).map(f => ({ f, items: useAreas.filter(a => a.floor === f) })).filter(g => g.items.length)
  // 位置卡縮圖：該位置所放垃圾桶嘅相（數量多嘅排前；最多 4 張拼貼）
  const areaPics = a => rows.filter(r => r.area_id === a.id && r.qty > 0).sort((x, y) => y.qty - x.qty).map(r => img(r.tool_id)).filter(Boolean).slice(0, 4)
  const areaThumb = a => {
    const p = areaPics(a)
    if (p.length === 0) return <span className="bn-ico">{a.kind === 'use' ? '🗑' : a.kind === 'store' ? '📦' : '🚫'}</span>
    if (p.length === 1) return <Thumb src={p[0]} fallback="🗑" size={64} />
    return <span className={'bn-mosaic m' + p.length}>{p.map((x, i) => <img key={i} src={x} alt="" loading="lazy" />)}</span>
  }
  const areaCard = a => (
    <button className={'sq-card' + (a.kind !== 'use' ? ' off' : '')} key={a.id} onClick={() => openSel({ k: 'area', id: a.id })}>
      {areaThumb(a)}
      <span className="sq-name">{a.name}</span>
      <span className="sq-n">{areaTot(a.id)}<small>{a.kind === 'use' ? '個' : `個・${KIND[a.kind]}`}</small></span>
    </button>
  )

  return (
    <>
      <div className="bn-kpis">
        <div><b>{inUse}</b><small>使用中</small></div>
        <div><b>{storeN}</b><small>倉</small></div>
        <div><b>{offN}</b><small>停用</small></div>
      </div>
      <div className="bn-total">合共 {inUse + storeN + offN} 個</div>
      <div className="bn-tabs">
        <button className={view === 'area' ? 'on' : ''} onClick={() => setView('area')}>按位置（{areas.length}）</button>
        <button className={view === 'model' ? 'on' : ''} onClick={() => setView('model')}>按款式（{bins.length}）</button>
        {edit && view === 'area' && <button className="bn-gear" title="管理位置" onClick={() => setMgr(true)}>⚙</button>}
      </div>
      {view === 'area' ? (
        <>
          {byFloor.map(g => (
            <div key={g.f}>
              <div className="bh-grp">{g.f}<span>{g.items.reduce((n, a) => n + areaTot(a.id), 0)} 個</span></div>
              <div className="sq-grid sq-eq">{g.items.map(areaCard)}</div>
            </div>
          ))}
          {storeAreas.length > 0 && (
            <div>
              <div className="bh-grp" style={{ borderColor: 'var(--sub)' }}>倉<span>{storeN} 個</span></div>
              <div className="sq-grid sq-eq">{storeAreas.map(areaCard)}</div>
            </div>
          )}
          {offAreas.length > 0 && (
            <div>
              <div className="bh-grp" style={{ borderColor: 'var(--sub)' }}>停用<span>{offN} 個</span></div>
              <div className="sq-grid sq-eq">{offAreas.map(areaCard)}</div>
            </div>
          )}
        </>
      ) : (
        <div className="sq-grid sq-eq">
          {bins.map(t => (
            <button className={'sq-card' + (t.status === '停用' ? ' off' : '')} key={t.id} onClick={() => openSel({ k: 'model', id: t.id })}>
              <Thumb src={img(t.id)} fallback="🗑" size={64} />
              <span className="sq-name">{t.name}</span>
              <span className="sq-n">{modelUse(t.id)}<small>使用中</small><small>倉 {modelStore(t.id)} ・ 停 {modelOff(t.id)}</small></span>
            </button>
          ))}
        </div>
      )}
      {mgr && (
        <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setMgr(false) }}>
          <div className="sheet">
            <h2>管理位置</h2>
            <div className="bn-box">
              <div className="bn-cap">新增位置</div>
              <div className="bn-add2">
                <input className="df-sel" style={{ width: 92 }} placeholder="樓層" value={nf.floor} onChange={e => setNf({ ...nf, floor: e.target.value })} />
                <input className="df-sel" placeholder="位置名稱" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') addArea() }} />
              </div>
              <div className="bn-cap" style={{ marginTop: 10 }}>呢個位置嘅類型</div>
              <div className="bn-seg">{Object.entries(KIND).map(([k, v]) => <button key={k} type="button" className={nf.kind === k ? 'on' : ''} onClick={() => setNf({ ...nf, kind: k })}>{v}</button>)}</div>
              <button className="btn" style={{ marginTop: 12 }} onClick={addArea}>＋ 新增位置</button>
            </div>
            <div className="bn-cap" style={{ margin: '14px 2px 6px' }}>現有位置（撳一下可更改類型或刪除）</div>
            <div className="bn-tabs">
              {[['all', '全部'], ['use', '使用中'], ['store', '倉'], ['off', '停用']].map(([k, t]) => (
                <button key={k} className={mk === k ? 'on' : ''} onClick={() => setMk(k)}>{t}（{k === 'all' ? areas.length : areas.filter(a => a.kind === k).length}）</button>
              ))}
            </div>
            <div style={{ maxHeight: '38vh', overflow: 'auto' }}>
              {areas.filter(a => mk === 'all' || a.kind === mk).map(a => (
                <div key={a.id} className="bn-mrow2">
                  <button type="button" className="bn-mhead" onClick={() => setOpenRow(openRow === a.id ? null : a.id)}>
                    <span className="bn-mn">{aName(a)}</span><span className="bn-mc">{areaTot(a.id)} 個</span><em className={'bn-tag k-' + a.kind}>{KIND[a.kind]}</em>
                  </button>
                  {openRow === a.id && (
                    <div className="bn-mopen">
                      <div className="bn-seg">{Object.entries(KIND).map(([k, v]) => <button key={k} type="button" className={a.kind === k ? 'on' : ''} onClick={() => a.kind !== k && setKind(a, k)}>{v}</button>)}</div>
                      <button type="button" className="btn danger" style={{ marginTop: 8 }} onClick={() => delArea(a)}>刪除呢個位置</button>
                    </div>
                  )}
                </div>
              ))}
              {areas.filter(a => mk === 'all' || a.kind === mk).length === 0 && <div className="note">冇符合嘅位置</div>}
            </div>
            <button className="btn ghost" onClick={() => setMgr(false)}>完成</button>
          </div>
        </div>
      )}
    </>
  )
}
