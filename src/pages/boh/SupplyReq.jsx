import { useEffect, useMemo, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Confirm from '../../components/Confirm'
import { num, today } from './shared'

// 客房物資領用單：每層一張清單，預填常用物品，只需填數量，提交後一次過扣庫存。
// 整張單用同一個 batch_id 記錄，可以喺「領用記錄」整張撤銷（庫存自動還原）。
const FLOORS = ['3樓', '4樓', '5樓', '6樓', '7樓', '8樓', '9樓', '10樓', '11樓', '12樓', '公共區域', '其他']
const newBatch = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'b' + Date.now() + Math.random().toString(36).slice(2, 8))
const fmtTime = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export default function SupplyReq({ who, canEdit, canSubmit }) {
  const [view, setView] = useState('form')            // form／hist
  const [sup, setSup] = useState(null)
  const [tpl, setTpl] = useState([])
  const [hist, setHist] = useState(null)
  const [floor, setFloor] = useState('')
  const [qty, setQty] = useState({})                  // supply_id → 數量字串
  const [extra, setExtra] = useState([])              // 今次額外加入（唔入清單）嘅物品 id
  const [tplEdit, setTplEdit] = useState(false)
  const [pick, setPick] = useState(false)
  const [pq, setPq] = useState('')
  const [note, setNote] = useState('')
  const [prev, setPrev] = useState(false)             // 提交前預覽
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null)              // 展開嘅記錄 batch_id
  const [undo, setUndo] = useState(null)

  const loadSup = () => api.dbSelect('supplies', { cols: 'id,name,category,unit,stock,status', order: 'sort_order' }).then(setSup).catch(ex => { toast('讀取物資失敗：' + ex.message); setSup(p => p || []) })
  const loadTpl = () => api.dbSelect('supply_req_tpl', { order: 'sort_order' }).then(setTpl).catch(ex => { toast('讀取清單失敗：' + ex.message); setTpl(p => p || []) })
  const loadHist = () => api.dbSelectBatches().then(setHist).catch(ex => { toast('讀取記錄失敗：' + ex.message); setHist(p => p || []) })
  useEffect(() => { loadSup(); loadTpl() }, [])
  useEffect(() => { if (view === 'hist') loadHist() }, [view])

  const byId = useMemo(() => Object.fromEntries((sup || []).map(s => [s.id, s])), [sup])
  const floors = [...FLOORS, ...new Set(tpl.map(t => t.floor).filter(f => !FLOORS.includes(f)))]
  const tplIds = tpl.filter(t => t.floor === floor).sort((a, b) => a.sort_order - b.sort_order).map(t => t.supply_id).filter(id => byId[id])
  const rowIds = [...tplIds, ...extra.filter(id => !tplIds.includes(id))]
  const chosen = rowIds.filter(id => num(qty[id]) > 0)

  function selectFloor(f) { setFloor(f); setQty({}); setExtra([]); setTplEdit(false); setNote('') }

  async function addPick(id) {
    if (tplEdit) {
      try { await api.dbInsertMany('supply_req_tpl', [{ floor, supply_id: id, sort_order: tpl.filter(t => t.floor === floor).length + 1 }]); await loadTpl() } catch (ex) { toast('加入失敗：' + ex.message) }
    } else if (!rowIds.includes(id)) setExtra([...extra, id])
    setPick(false); setPq('')
  }
  async function removeTpl(id) {
    const row = tpl.find(t => t.floor === floor && t.supply_id === id)
    if (!row) { setExtra(extra.filter(x => x !== id)); return }
    try { await api.dbDelete('supply_req_tpl', row.id); await loadTpl() } catch (ex) { toast('移除失敗：' + ex.message) }
  }
  async function copyFrom(src) {
    if (!src) return
    const ids = tpl.filter(t => t.floor === src).sort((a, b) => a.sort_order - b.sort_order).map(t => t.supply_id).filter(id => !tplIds.includes(id))
    if (!ids.length) { toast('嗰層冇清單可複製'); return }
    try { await api.dbInsertMany('supply_req_tpl', ids.map((id, i) => ({ floor, supply_id: id, sort_order: tplIds.length + i + 1 }))); await loadTpl(); toast(`已複製 ${ids.length} 項`) } catch (ex) { toast('複製失敗：' + ex.message) }
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      const batch = newBatch()
      await api.dbInsertMany('supply_moves', chosen.map(id => ({ supply_id: id, kind: 'out', qty: num(qty[id]), happened_on: today(), note: ['領用單 ' + floor, note.trim()].filter(Boolean).join('：'), by_name: who || '', batch_id: batch })))
      toast(`已提交，扣咗 ${chosen.length} 項庫存`)
      setPrev(false); setQty({}); setExtra([]); setNote(''); loadSup()
    } catch (ex) { toast('提交失敗：' + ex.message) }
    setBusy(false)
  }
  async function doUndo(b) {
    try { await api.dbDeleteBatch(b); toast('已撤銷整張單，庫存已還原'); setUndo(null); setOpen(null); loadHist(); loadSup() } catch (ex) { toast('撤銷失敗：' + ex.message) }
  }

  const batches = useMemo(() => {
    const m = new Map()
    for (const r of hist || []) { if (!m.has(r.batch_id)) m.set(r.batch_id, []); m.get(r.batch_id).push(r) }
    return [...m.entries()].map(([id, rows]) => ({ id, rows, head: rows[0] }))
  }, [hist])

  if (!sup) return <div className="note">載入中…</div>
  const pickList = sup.filter(s => s.status !== '停用' && !rowIds.includes(s.id) && (!pq.trim() || [s.name, s.category].join(' ').toLowerCase().includes(pq.trim().toLowerCase())))

  return (
    <>
      <div className="chips" style={{ margin: '4px 0 8px' }}>
        <button className={`chip ${view === 'form' ? 'on' : ''}`} onClick={() => setView('form')}>填領用單</button>
        {canEdit && <button className={`chip ${view === 'hist' ? 'on' : ''}`} onClick={() => setView('hist')}>領用記錄</button>}
      </div>

      {view === 'form' && (
        <>
          {!canSubmit && <p className="note" style={{ textAlign: 'left' }}>目前帳號只可查看，不能提交領用單</p>}
          <div className="bh-grp">樓層／部門</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {floors.map(f => <button key={f} className={`chip ${floor === f ? 'on' : ''}`} onClick={() => selectFloor(f)}>{f}{tpl.some(t => t.floor === f) ? '' : ' ·'}</button>)}
          </div>
          {!floor && <div className="note">先揀樓層</div>}

          {floor && (
            <>
              <div className="bh-grp">{floor} 領用清單<span>{rowIds.length}</span></div>
              {rowIds.length === 0 && <div className="note">{canEdit ? '呢層未有清單，撳下面「⚙ 編輯清單」加入常用物品，或者複製其他樓層' : '呢層未有清單，請聯絡倉管'}</div>}
              <div className="bh-batches" style={{ marginTop: 4 }}>
                {rowIds.map(id => {
                  const s = byId[id], q = num(qty[id]), after = num(s.stock) - q
                  return (
                    <div key={id} className="bh-b" style={{ alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b>{s.name}</b>
                        <small style={{ display: 'block', color: after < 0 && q > 0 ? 'var(--red)' : 'var(--sub)' }}>{s.category} · 庫存 {s.stock} {s.unit}{q > 0 ? ` → ${after}` : ''}</small>
                      </span>
                      {tplEdit
                        ? <button className="linky" style={{ color: 'var(--red)' }} onClick={() => removeTpl(id)}>✕ 移除</button>
                        : <input type="number" inputMode="numeric" min="0" placeholder="0" value={qty[id] ?? ''} disabled={!canSubmit} onChange={e => setQty({ ...qty, [id]: e.target.value })} style={{ width: 76, padding: '8px 10px', fontSize: 17, textAlign: 'center', border: '1px solid var(--line)', borderRadius: 10 }} />}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                {(canSubmit || tplEdit) && <button className="btn ghost" style={{ margin: 0 }} onClick={() => setPick(true)}>＋ {tplEdit ? '加入清單' : '加其他物品'}</button>}
                {canEdit && <button className="btn ghost" style={{ margin: 0 }} onClick={() => setTplEdit(!tplEdit)}>{tplEdit ? '完成編輯' : '⚙ 編輯清單'}</button>}
                {canEdit && tplEdit && (
                  <select className="df-sel" value="" onChange={e => copyFrom(e.target.value)} style={{ maxWidth: 170 }}>
                    <option value="">複製其他樓層清單…</option>
                    {floors.filter(f => f !== floor && tpl.some(t => t.floor === f)).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
              </div>
              {!tplEdit && canSubmit && (
                <>
                  <div className="f-row"><label>備註（可留空）</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="例如：領用人、房號" /></div>
                  <button className="btn" disabled={!chosen.length} onClick={() => setPrev(true)}>提交領用單{chosen.length ? `（${chosen.length} 項）` : ''}</button>
                </>
              )}
            </>
          )}
        </>
      )}

      {view === 'hist' && (
        <>
          {!hist && <div className="note">載入中…</div>}
          {hist && batches.length === 0 && <div className="note">未有領用單記錄</div>}
          <div className="bh-batches" style={{ marginTop: 4 }}>
            {batches.map(b => (
              <div key={b.id}>
                <div className="bh-b" style={{ alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setOpen(open === b.id ? null : b.id)}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{(b.head.note || '').replace(/^領用單 /, '').split('：')[0] || '領用單'}</b>　<small style={{ color: 'var(--sub)' }}>{fmtTime(b.head.created_at)}　{b.head.by_name}</small>
                    <small style={{ display: 'block', color: 'var(--sub)' }}>{b.rows.length} 項　{open === b.id ? '▲' : '▼'}</small>
                  </span>
                  <button className="linky" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); setUndo(b.id) }}>撤銷整張</button>
                </div>
                {open === b.id && b.rows.map(r => (
                  <div key={r.id} className="bh-b" style={{ paddingLeft: 22 }}>
                    <span style={{ flex: 1 }}>{(byId[r.supply_id] || {}).name || `#${r.supply_id}`}</span><b style={{ color: '#c62828' }}>−{r.qty}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {pick && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setPick(false) }}>
          <div className="sheet">
            <h2>{tplEdit ? `加入 ${floor} 清單` : '加其他物品'}</h2>
            <input className="search-inp" placeholder="🔍 搜尋物資" value={pq} onChange={e => setPq(e.target.value)} autoFocus />
            <div style={{ maxHeight: '50vh', overflow: 'auto', marginTop: 8 }}>
              {pickList.slice(0, 80).map(s => <button key={s.id} className="btn ghost" style={{ display: 'block', width: '100%', textAlign: 'left', margin: '0 0 6px' }} onClick={() => addPick(s.id)}>{s.name}<small style={{ color: 'var(--sub)' }}>　{s.category} · 庫存 {s.stock}</small></button>)}
              {pickList.length === 0 && <div className="note">搵唔到</div>}
            </div>
            <button className="btn ghost" onClick={() => setPick(false)}>取消</button>
          </div>
        </div>
      )}

      {prev && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget && !busy) setPrev(false) }}>
          <div className="sheet">
            <h2>確認領用單：{floor}</h2>
            <p className="src-note">提交後會即時扣除庫存。如果填錯，倉管可以喺「領用記錄」整張撤銷。</p>
            <div className="bh-batches">
              {chosen.map(id => {
                const s = byId[id], after = num(s.stock) - num(qty[id])
                return (
                  <div key={id} className="bh-b" style={{ alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{s.name}</b><small style={{ display: 'block', color: after < 0 ? 'var(--red)' : 'var(--sub)' }}>庫存 {s.stock} → {after}{after < 0 ? '（庫存唔夠，會變負數）' : ''}</small></span>
                    <b style={{ color: '#c62828' }}>−{num(qty[id])}</b>
                  </div>
                )
              })}
            </div>
            <button className="btn" onClick={submit} disabled={busy}>{busy ? '提交中…' : `確認，扣 ${chosen.length} 項庫存`}</button>
            <button className="btn ghost" onClick={() => setPrev(false)} disabled={busy}>返回修改</button>
          </div>
        </div>
      )}
      {undo && <Confirm text="會撤銷整張領用單，所有項目嘅庫存會還原。" onConfirm={() => doUndo(undo)} onCancel={() => setUndo(null)} />}
    </>
  )
}
