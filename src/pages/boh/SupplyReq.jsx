import { useEffect, useMemo, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Confirm from '../../components/Confirm'
import { num, today } from './shared'

// 客房物資領用單：跟紙單一樣——每個品牌一張清單（歐舒丹／LINE FRIENDS／葡京人），再揀樓層。
// 數量按紙單單位（箱／盒／捆…）填，系統按規格乘返件數扣庫存。整張單同一個 batch_id，可整張撤銷。
const SHEETS = ['歐舒丹', 'LINE FRIENDS', '葡京人']
const FLOORS = ['3樓', '4樓', '5樓', '6樓', '7樓', '8樓', '9樓', '10樓', '11樓', '12樓', '公共區域', '其他']
const SEP = '｜'
const newBatch = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'b' + Date.now() + Math.random().toString(36).slice(2, 8))
const fmtTime = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const fmt = n => Number(n).toLocaleString('en-US')

export default function SupplyReq({ who, canEdit, canSubmit }) {
  const [view, setView] = useState('form')            // form／hist
  const [sup, setSup] = useState(null)
  const [tpl, setTpl] = useState([])
  const [hist, setHist] = useState(null)
  const [sheet, setSheet] = useState('')
  const [floor, setFloor] = useState('')
  const [qty, setQty] = useState({})                  // 行 key → 數量（箱／盒…）字串
  const [extra, setExtra] = useState([])              // 今次額外加入（唔入清單）嘅物品 id
  const [tplEdit, setTplEdit] = useState(false)
  const [pick, setPick] = useState(false)
  const [pq, setPq] = useState('')
  const [cfg, setCfg] = useState(null)                // 加入／修改清單項目：{ supply, tplId, pack, unit }
  const [rq, setRq] = useState('')                  // 搜尋清單
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
  const sheets = [...SHEETS, ...new Set(tpl.map(t => t.sheet).filter(f => !SHEETS.includes(f)))]
  const tplRows = tpl.filter(t => t.sheet === sheet && byId[t.supply_id]).sort((a, b) => a.sort_order - b.sort_order)
    .map(t => ({ key: 't' + t.id, tplId: t.id, sid: t.supply_id, pack: t.pack || 1, unit: t.unit_label || byId[t.supply_id].unit, spec: t.spec }))
  const extraRows = extra.filter(id => !tplRows.some(r => r.sid === id) && byId[id]).map(id => ({ key: 'x' + id, sid: id, pack: 1, unit: byId[id].unit, spec: '' }))
  const rows = [...tplRows, ...extraRows]
  const chosen = rows.filter(r => num(qty[r.key]) > 0)
  const rqt = rq.trim().toLowerCase()
  const shown = rqt ? rows.filter(r => [byId[r.sid].name, byId[r.sid].category, r.spec].join(' ').toLowerCase().includes(rqt)) : rows
  const pieces = r => num(qty[r.key]) * r.pack

  function selectSheet(s) { setSheet(s); setQty({}); setExtra([]); setTplEdit(false); setRq('') }

  async function saveCfg() {
    const pack = Math.max(1, num(cfg.pack)), unit = (cfg.unit || '').trim() || '件'
    try {
      if (cfg.tplId) await api.dbUpdate('supply_req_tpl', cfg.tplId, { pack, unit_label: unit, spec: `${pack}pcs/${unit}` })
      else await api.dbInsertMany('supply_req_tpl', [{ sheet, supply_id: cfg.supply.id, sort_order: tpl.filter(t => t.sheet === sheet).length + 1, pack, unit_label: unit, spec: `${pack}pcs/${unit}` }])
      setCfg(null); await loadTpl()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  function addPick(s) {
    setPick(false); setPq('')
    if (tplEdit) setCfg({ supply: s, tplId: null, pack: 1, unit: s.unit })
    else if (!rows.some(r => r.sid === s.id)) setExtra([...extra, s.id])
  }
  async function removeTpl(r) {
    if (!r.tplId) { setExtra(extra.filter(x => x !== r.sid)); return }
    try { await api.dbDelete('supply_req_tpl', r.tplId); await loadTpl() } catch (ex) { toast('移除失敗：' + ex.message) }
  }
  async function copyFrom(src) {
    if (!src) return
    const items = tpl.filter(t => t.sheet === src).sort((a, b) => a.sort_order - b.sort_order).filter(t => !tplRows.some(r => r.sid === t.supply_id))
    if (!items.length) { toast('嗰張單冇清單可複製'); return }
    try { await api.dbInsertMany('supply_req_tpl', items.map((t, i) => ({ sheet, supply_id: t.supply_id, sort_order: tplRows.length + i + 1, pack: t.pack, unit_label: t.unit_label, spec: t.spec }))); await loadTpl(); toast(`已複製 ${items.length} 項`) } catch (ex) { toast('複製失敗：' + ex.message) }
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      const batch = newBatch()
      await api.dbInsertMany('supply_moves', chosen.map(r => ({ supply_id: r.sid, kind: 'out', qty: pieces(r), happened_on: today(), note: ['領用單', sheet, floor, r.pack > 1 ? `${num(qty[r.key])}${r.unit}×${r.pack}` : '', note.trim()].join(SEP), by_name: who || '', batch_id: batch })))
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
    return [...m.entries()].map(([id, rs]) => ({ id, rows: rs, head: rs[0], parts: (rs[0].note || '').split(SEP) }))
  }, [hist])

  if (!sup) return <div className="note">載入中…</div>
  const pickList = sup.filter(s => s.status !== '停用' && !rows.some(r => r.sid === s.id) && (!pq.trim() || [s.name, s.category].join(' ').toLowerCase().includes(pq.trim().toLowerCase())))
  const ready = sheet && floor

  return (
    <>
      <div className="chips" style={{ margin: '4px 0 8px' }}>
        <button className={`chip ${view === 'form' ? 'on' : ''}`} onClick={() => setView('form')}>填領用單</button>
        {canEdit && <button className={`chip ${view === 'hist' ? 'on' : ''}`} onClick={() => setView('hist')}>領用記錄</button>}
      </div>

      {view === 'form' && (
        <>
          {!canSubmit && <p className="note" style={{ textAlign: 'left' }}>目前帳號只可查看，不能提交領用單</p>}
          <div className="bh-grp">配貨清單</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {sheets.map(f => <button key={f} className={`chip ${sheet === f ? 'on' : ''}`} onClick={() => selectSheet(f)}>{f}</button>)}
          </div>
          <div className="bh-grp">樓層</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {FLOORS.map(f => <button key={f} className={`chip ${floor === f ? 'on' : ''}`} onClick={() => setFloor(f)}>{f}</button>)}
          </div>
          {!sheet && <div className="note">先揀配貨清單（歐舒丹／LINE FRIENDS／葡京人）</div>}

          {sheet && (
            <>
              <div className="bh-grp">{sheet} 配貨清單<span>{rows.length}</span></div>
              {rows.length === 0 && <div className="note">{canEdit ? '呢張單未有清單，撳下面「⚙ 編輯清單」加入物品，或者複製其他清單' : '呢張單未有清單，請聯絡倉管'}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 8px' }}>
                {(canSubmit || tplEdit) && <button className="btn ghost" style={{ margin: 0 }} onClick={() => setPick(true)}>＋ {tplEdit ? '加入清單' : '加其他物品'}</button>}
                {canEdit && <button className="btn ghost" style={{ margin: 0 }} onClick={() => setTplEdit(!tplEdit)}>{tplEdit ? '完成編輯' : '⚙ 編輯清單'}</button>}
                {canEdit && tplEdit && (
                  <select className="df-sel" value="" onChange={e => copyFrom(e.target.value)} style={{ maxWidth: 170 }}>
                    <option value="">複製其他清單…</option>
                    {sheets.filter(f => f !== sheet && tpl.some(t => t.sheet === f)).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
              </div>
              <div className="srch-row"><input className="search-inp" placeholder="🔍 搜尋物品" value={rq} onChange={e => setRq(e.target.value)} /></div>
              {rqt && shown.length === 0 && <div className="note">搵唔到「{rq.trim()}」，可以撳下面「＋ 加其他物品」</div>}
              {rqt && chosen.length > 0 && <p className="note" style={{ textAlign: 'left', margin: '2px 0' }}>已填 {chosen.length} 項（搜尋時未顯示嘅都會一齊提交）</p>}
              <div className="bh-batches" style={{ marginTop: 4 }}>
                {shown.map(r => {
                  const s = byId[r.sid], q = num(qty[r.key]), after = num(s.stock) - pieces(r)
                  return (
                    <div key={r.key} className="bh-b" style={{ alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b>{s.name}</b>
                        <small style={{ display: 'block', color: after < 0 && q > 0 ? 'var(--red)' : 'var(--sub)' }}>
                          {r.spec ? `${r.spec} · ` : ''}庫存 {fmt(s.stock)} {s.unit}{q > 0 ? ` → ${fmt(after)}（扣 ${fmt(pieces(r))}）` : ''}
                        </small>
                      </span>
                      {tplEdit
                        ? <span style={{ display: 'flex', gap: 10 }}>
                            {r.tplId && <button className="linky" onClick={() => setCfg({ supply: s, tplId: r.tplId, pack: r.pack, unit: r.unit })}>改規格</button>}
                            <button className="linky" style={{ color: 'var(--red)' }} onClick={() => removeTpl(r)}>✕</button>
                          </span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="number" inputMode="numeric" min="0" placeholder="0" value={qty[r.key] ?? ''} disabled={!canSubmit} onChange={e => setQty({ ...qty, [r.key]: e.target.value })} style={{ width: 68, padding: '8px 8px', fontSize: 17, textAlign: 'center', border: '1px solid var(--line)', borderRadius: 10 }} />
                            <small style={{ color: 'var(--sub)', minWidth: 18 }}>{r.unit}</small>
                          </span>}
                    </div>
                  )
                })}
              </div>
              {!tplEdit && canSubmit && (
                <>
                  <div className="f-row"><label>備註（可留空）</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="例如：領用人、工號" /></div>
                  {!floor && chosen.length > 0 && <p className="note" style={{ textAlign: 'left', color: 'var(--red)' }}>請先揀樓層</p>}
                  <button className="btn" disabled={!chosen.length || !ready} onClick={() => setPrev(true)}>提交領用單{chosen.length ? `（${chosen.length} 項）` : ''}</button>
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
                    <b>{b.parts[2] || '領用單'}　{b.parts[1] || ''}</b>　<small style={{ color: 'var(--sub)' }}>{fmtTime(b.head.created_at)}　{b.head.by_name}</small>
                    <small style={{ display: 'block', color: 'var(--sub)' }}>{b.rows.length} 項　{open === b.id ? '▲' : '▼'}</small>
                  </span>
                  <button className="linky" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); setUndo(b.id) }}>撤銷整張</button>
                </div>
                {open === b.id && b.rows.map(r => {
                  const p = (r.note || '').split(SEP)
                  return (
                    <div key={r.id} className="bh-b" style={{ paddingLeft: 22 }}>
                      <span style={{ flex: 1 }}>{(byId[r.supply_id] || {}).name || `#${r.supply_id}`}{p[3] && <small style={{ color: 'var(--sub)' }}>　{p[3]}</small>}</span><b style={{ color: '#c62828' }}>−{fmt(r.qty)}</b>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {pick && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setPick(false) }}>
          <div className="sheet">
            <h2>{tplEdit ? `加入 ${sheet} 清單` : '加其他物品'}</h2>
            <input className="search-inp" placeholder="🔍 搜尋物資" value={pq} onChange={e => setPq(e.target.value)} autoFocus />
            <div style={{ maxHeight: '50vh', overflow: 'auto', marginTop: 8 }}>
              {pickList.slice(0, 80).map(s => <button key={s.id} className="btn ghost" style={{ display: 'block', width: '100%', textAlign: 'left', margin: '0 0 6px' }} onClick={() => addPick(s)}>{s.name}<small style={{ color: 'var(--sub)' }}>　{s.category} · 庫存 {fmt(s.stock)}</small></button>)}
              {pickList.length === 0 && <div className="note">搵唔到</div>}
            </div>
            <button className="btn ghost" onClick={() => setPick(false)}>取消</button>
          </div>
        </div>
      )}

      {cfg && (
        <div className="modal" style={{ zIndex: 55 }} onClick={e => { if (e.target === e.currentTarget) setCfg(null) }}>
          <div className="sheet">
            <h2>{cfg.supply.name}</h2>
            <p className="src-note">紙單上嘅單位同規格。例如「231pcs/箱」：單位填「箱」，每單位件數填 231。填數量時就係填幾多箱，系統自動扣 231 × 箱數。</p>
            <div className="bh-row2">
              <div className="f-row"><label>單位（箱／盒／捆…）</label><input value={cfg.unit} onChange={e => setCfg({ ...cfg, unit: e.target.value })} /></div>
              <div className="f-row"><label>每單位件數</label><input type="number" inputMode="numeric" value={cfg.pack} onChange={e => setCfg({ ...cfg, pack: e.target.value })} /></div>
            </div>
            <button className="btn" onClick={saveCfg}>儲存</button>
            <button className="btn ghost" onClick={() => setCfg(null)}>取消</button>
          </div>
        </div>
      )}

      {prev && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget && !busy) setPrev(false) }}>
          <div className="sheet">
            <h2>確認領用單：{sheet}　{floor}</h2>
            <p className="src-note">提交後會即時扣除庫存。如果填錯，倉管可以喺「領用記錄」整張撤銷。</p>
            <div className="bh-batches">
              {chosen.map(r => {
                const s = byId[r.sid], after = num(s.stock) - pieces(r)
                return (
                  <div key={r.key} className="bh-b" style={{ alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{s.name}</b>
                      <small style={{ display: 'block', color: after < 0 ? 'var(--red)' : 'var(--sub)' }}>{num(qty[r.key])} {r.unit}{r.pack > 1 ? ` × ${r.pack}` : ''}　庫存 {fmt(s.stock)} → {fmt(after)}{after < 0 ? '（庫存唔夠，會變負數）' : ''}</small>
                    </span>
                    <b style={{ color: '#c62828' }}>−{fmt(pieces(r))}</b>
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
