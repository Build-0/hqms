import { useBack } from '../../lib/nav'
import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Confirm from '../../components/Confirm'
import { ReportModal, ListReport } from '../../components/Reports'
import { Thumb, ImageField, useImages, setCachedImage, ListManager, num, today } from './shared'

const EMPTY = { name: '', category: '', unit: '件', stock: 0, min_stock: 0, status: '啟用', supplier: '', notes: '', image: '' }
const KIND = { in: ['入貨', '#2e7d32'], out: ['領用', '#c62828'], adj: ['盤點／調整', '#7a6a4f'] }
const money = v => (v === '' || v == null ? null : parseFloat(v) || 0)
const fmtMoney = v => (v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }))

// 客房物資消耗品：入貨（日期、數量、供應商、單價、單號）、領用、盤點；庫存由異動記錄自動計算
export default function Supplies({ d, edit, reload, reg, who }) {
  const [sub, setSub] = useState('list')            // list／log（全部異動記錄）
  const [q, setQ] = useState('')
  const [fk, setFk] = useState('all')               // all／low／off
  const [ck, setCk] = useState('')
  const [pv, setPv] = useState(null)                // 開緊邊個物資嘅詳情
  const [form, setForm] = useState(null)
  const [orig, setOrig] = useState('')
  const [rec, setRec] = useState(null)              // 入貨／領用／盤點視窗
  const [mv, setMv] = useState(null)                // 全部異動記錄
  const [delMv, setDelMv] = useState(null)
  const [delS, setDelS] = useState(null)
  const [mgr, setMgr] = useState(false)
  const [lq, setLq] = useState('')
  const [lk, setLk] = useState('in')                // 記錄頁篩選：in／out／all
  const list = d.supplies
  const img = useImages('supplies', list.map(s => s.id))
  const loadMv = () => api.dbSelect('supply_moves', { order: 'happened_on', asc: false }).then(setMv).catch(ex => { toast('讀取記錄失敗：' + ex.message); setMv(prev => prev || []) })
  useEffect(() => { loadMv() }, [])
  useBack(sub === 'log', () => setSub('list'), 2)

  const active = s => s.status !== '停用'
  const low = s => active(s) && num(s.min_stock) > 0 && num(s.stock) < num(s.min_stock)
  const movesOf = id => (mv || []).filter(m => m.supply_id === id)
  const lastIn = id => movesOf(id).find(m => m.kind === 'in')
  const nameOf = id => (list.find(s => s.id === id) || {}).name || `#${id}`
  const lowN = list.filter(low).length, offN = list.filter(s => !active(s)).length

  const shown = list.filter(s => {
    if (fk === 'low' && !low(s)) return false
    if (fk === 'off' ? active(s) : (fk !== 'low' && !active(s))) return false
    if (ck && s.category !== ck) return false
    const t = q.trim().toLowerCase()
    return !t || [s.name, s.category, s.supplier, s.notes].join(' ').toLowerCase().includes(t)
  })
  const catNames = [...d.supplyCats.map(c => c.name), ...new Set(list.map(s => s.category).filter(c => c && !d.supplyCats.some(x => x.name === c)))]
  const groups = catNames.map(c => ({ c, items: shown.filter(s => s.category === c) })).filter(g => g.items.length)
  const noCat = shown.filter(s => !s.category || !catNames.includes(s.category))
  if (noCat.length) groups.push({ c: '（未分類）', items: noCat })

  function open(s) {
    const image = s ? img(s.id) || '' : ''
    setOrig(image)
    setForm(s ? { ...s, image } : { ...EMPTY, category: d.supplyCats[0]?.name || '' })
  }
  async function save() {
    if (!form.name.trim()) { toast('請填物資名稱'); return }
    const row = { name: form.name.trim(), category: form.category || '其他', unit: (form.unit || '').trim() || '件', min_stock: num(form.min_stock), status: form.status, supplier: (form.supplier || '').trim(), notes: (form.notes || '').trim() }
    try {
      if (form.image !== orig) row.image = form.image || null
      if (form.id) { await api.dbUpdate('supplies', form.id, row); if (form.image !== orig) setCachedImage('supplies', form.id, form.image) }
      else {
        const r = await api.dbInsert('supplies', { ...row, sort_order: list.length + 1, image: form.image || null })
        setCachedImage('supplies', r.id, form.image)
        if (num(form.stock) > 0) await api.dbInsert('supply_moves', { supply_id: r.id, kind: 'adj', qty: num(form.stock), happened_on: today(), note: '期初庫存', by_name: who || '' })
      }
      toast('已儲存'); setForm(null); reload(); loadMv()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function removeSupply(s) {
    try { await api.dbDelete('supplies', s.id); toast('已刪除'); setDelS(null); setForm(null); setPv(null); reload(); loadMv() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }
  async function doRec() {
    const r = rec, s = r.s, qty = num(r.qty)
    try {
      if (r.kind === 'count') {
        if (r.qty === '' || qty < 0) { toast('請填實際剩餘數量'); return }
        const delta = qty - num(s.stock)
        if (delta === 0) { toast('同系統庫存一樣，冇需要調整'); return }
        await api.dbInsert('supply_moves', { supply_id: s.id, kind: 'adj', qty: delta, happened_on: r.date || today(), note: ['盤點', r.note].filter(Boolean).join('：'), by_name: who || '' })
      } else {
        if (qty <= 0) { toast('請填數量'); return }
        if (r.kind === 'out' && qty > num(s.stock)) { toast(`庫存得 ${s.stock}，唔夠領用 ${qty}`); return }
        await api.dbInsert('supply_moves', { supply_id: s.id, kind: r.kind, qty, happened_on: r.date || today(), supplier: r.kind === 'in' ? (r.supplier || '').trim() : '', unit_price: r.kind === 'in' ? money(r.price) : null, invoice_no: r.kind === 'in' ? (r.invoice || '').trim() : '', note: (r.note || '').trim(), by_name: who || '' })
      }
      toast(r.kind === 'in' ? '已入貨' : r.kind === 'out' ? '已記錄領用' : '已盤點'); setRec(null); reload(); loadMv()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function removeMove(m) {
    try { await api.dbDelete('supply_moves', m.id); toast('已刪除記錄，庫存已重算'); setDelMv(null); reload(); loadMv() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }

  const logRows = (mv || []).filter(m => {
    if (lk !== 'all' && m.kind !== lk) return false
    const t = lq.trim().toLowerCase()
    return !t || [nameOf(m.supply_id), m.supplier, m.invoice_no, m.note].join(' ').toLowerCase().includes(t)
  })
  const logReport = () => ({
    title: lk === 'in' ? '入貨記錄' : lk === 'out' ? '領用記錄' : '全部異動記錄',
    filterText: lq.trim() ? `搜尋「${lq.trim()}」` : '全部',
    cols: ['日期', '物資', '類別', '數量', '供應商', '單價', '單號／備註'],
    groups: [{ name: lk === 'in' ? '入貨' : lk === 'out' ? '領用' : '異動', rows: logRows.map(m => ({ cells: [m.happened_on, nameOf(m.supply_id), (list.find(s => s.id === m.supply_id) || {}).category || '—', (m.kind === 'out' ? '−' : m.kind === 'adj' && m.qty > 0 ? '+' : '') + m.qty, m.supplier || '—', fmtMoney(m.unit_price), [m.invoice_no, m.note].filter(Boolean).join('　') || '—'], cls: ['', '', '', '', '', '', ''] })) }],
  })
  if (reg) reg.current = () => sub === 'log' ? logReport() : ({
    title: '客房物資消耗品',
    filterText: [fk === 'low' ? '需補貨' : fk === 'off' ? '停用' : '', ck, q.trim() && `搜尋「${q.trim()}」`].filter(Boolean).join(' · ') || '全部（啟用中）',
    cols: ['名稱', '庫存', '最低', '最近入貨', '供應商'],
    groups: groups.map(g => ({ name: g.c, rows: g.items.map(s => { const li = lastIn(s.id); return { photo: img(s.id), cells: [s.name, `${s.stock} ${s.unit}`, num(s.min_stock) || '—', li ? `${li.happened_on}（${li.qty}）` : '—', (li && li.supplier) || s.supplier || '—'], cls: ['', low(s) ? 'rpt-red' : '', '', '', ''] } }) })),
  })
  const pvS = pv ? list.find(x => x.id === pv) : null

  if (sub === 'log') {
    return (
      <>
        <div className="fstk">
          <div className="srch-row"><input className="search-inp" placeholder="🔍 搜尋物資、供應商、單號" value={lq} onChange={e => setLq(e.target.value)} /></div>
          <div className="chips" style={{ marginBottom: 6 }}>{[['in', '入貨'], ['out', '領用'], ['all', '全部']].map(([k, t]) => <button key={k} className={`chip ${lk === k ? 'on' : ''}`} onClick={() => setLk(k)}>{t}</button>)}</div>
        </div>
        {!mv && <div className="note">載入中…</div>}
        {mv && logRows.length === 0 && <div className="note">未有符合嘅記錄</div>}
        <div className="bh-batches" style={{ marginTop: 4 }}>
          {logRows.slice(0, 300).map(m => (
            <div key={m.id} className="bh-b" style={{ alignItems: 'flex-start', gap: 8 }}>
              <i className="bh-dot" style={{ background: KIND[m.kind][1], marginTop: 6 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{nameOf(m.supply_id)}</b>　<small style={{ color: 'var(--sub)' }}>{m.happened_on}</small>
                <small style={{ display: 'block', color: 'var(--sub)' }}>{[KIND[m.kind][0], m.supplier, m.unit_price != null && `單價 ${fmtMoney(m.unit_price)}`, m.invoice_no && `單號 ${m.invoice_no}`, m.note, m.by_name].filter(Boolean).join('　·　')}</small>
              </span>
              <b style={{ color: KIND[m.kind][1] }}>{m.kind === 'out' ? '−' : m.kind === 'adj' && m.qty > 0 ? '+' : ''}{m.qty}</b>
              {edit && <button className="linky" style={{ color: 'var(--red)' }} onClick={() => setDelMv(m)}>✕</button>}
            </div>
          ))}
        </div>
        {delMv && <Confirm text={`會刪除呢筆${KIND[delMv.kind][0]}記錄（${nameOf(delMv.supply_id)}，${delMv.qty}），庫存會自動重算。`} onConfirm={() => removeMove(delMv)} onCancel={() => setDelMv(null)} />}
      </>
    )
  }

  return (
    <>
      <div className="fstk">
        <div className="srch-row">
          <input className="search-inp" placeholder="🔍 搜尋物資、供應商" value={q} onChange={e => setQ(e.target.value)} />
          <button className="tb-btn sq" title="入貨／領用記錄" onClick={() => setSub('log')}>📋</button>
          {edit && <button className="tb-btn sq" title="管理分類" onClick={() => setMgr(true)}>⚙</button>}
        </div>
        <div className="df-grid" style={{ marginBottom: 6 }}>
          <select className="df-sel" value={fk} onChange={e => setFk(e.target.value)}>
            <option value="all">{`全部 ${list.filter(active).length}`}</option>
            {lowN > 0 && <option value="low">{`🛒 補貨 ${lowN}`}</option>}
            {offN > 0 && <option value="off">{`停用 ${offN}`}</option>}
          </select>
          <select className="df-sel" value={ck} onChange={e => setCk(e.target.value)}>
            <option value="">所有分類</option>
            {catNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {groups.length === 0 && <div className="note">{list.length ? '沒有符合的物資' : edit ? '未有物資，撳右下角「＋」新增' : '未有物資'}</div>}
      {groups.map(g => (
        <div key={g.c}>
          <div className="bh-grp">{g.c}<span>{g.items.length}</span></div>
          <div className="sq-grid sq-eq">
            {g.items.map(s => (
              <button className={`sq-card ${!active(s) ? 'off' : ''}`} key={s.id} onClick={() => setPv(s.id)}>
                <Thumb src={img(s.id)} fallback="🧴" size={64} />
                <span className="sq-name">{s.name}</span>
                <span className={`sq-n ${low(s) ? 'low' : ''}`}>{s.stock}<small>{!active(s) ? '停用' : low(s) ? `需補貨 · ${s.unit}` : `庫存 · ${s.unit}`}</small></span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {edit && <button className="fab" onClick={() => open(null)}>＋</button>}

      {pvS && (() => {
        const s = pvS, ms = movesOf(s.id), li = lastIn(s.id)
        return (
          <div className="modal" onClick={e => { if (e.target === e.currentTarget) setPv(null) }}>
            <div className="sheet" style={{ padding: 12 }}>
              <div className="c-item bh-card" style={!active(s) ? { opacity: .6 } : undefined}>
                <div className="bh-item" style={{ cursor: 'default' }}>
                  <Thumb src={img(s.id)} fallback="🧴" size={72} />
                  <div className="bh-main">
                    <div className="bh-name">{s.name}{!active(s) && <span className="badge b-gray">停用</span>}</div>
                    <div className="bh-sub">{s.category} · 單位：{s.unit}</div>
                  </div>
                  <div className="bh-stock">
                    <div className={`bh-sn ${low(s) ? 'low' : ''}`}>{s.stock}</div>
                    <div className="bh-sl">{low(s) ? '需補貨' : '庫存'}</div>
                    {num(s.min_stock) > 0 && <div className="bh-sl">最低 {s.min_stock}</div>}
                  </div>
                </div>
                <div className="bh-info">
                  <div><span>常用供應商</span><b>{s.supplier || '—'}</b></div>
                  <div><span>最近入貨</span><b>{li ? `${li.happened_on}　${li.qty} ${s.unit}${li.supplier ? '　' + li.supplier : ''}` : '未有入貨記錄'}</b></div>
                  {s.notes && <div><span>備註</span><b>{s.notes}</b></div>}
                </div>
                <div className="bh-batches">
                  <div className="bh-bt">入貨／領用記錄{mv ? `（${ms.length}）` : ''}</div>
                  {!mv && <div className="note">載入中…</div>}
                  {mv && ms.length === 0 && <div className="note" style={{ margin: '4px 0' }}>未有記錄</div>}
                  {ms.slice(0, 30).map(m => (
                    <div key={m.id} className="bh-b" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <i className="bh-dot" style={{ background: KIND[m.kind][1], marginTop: 6 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {m.happened_on}　<small style={{ color: 'var(--sub)' }}>{KIND[m.kind][0]}</small>
                        {(m.supplier || m.unit_price != null || m.invoice_no || m.note) && <small style={{ display: 'block', color: 'var(--sub)' }}>{[m.supplier, m.unit_price != null && `單價 ${fmtMoney(m.unit_price)}`, m.invoice_no && `單號 ${m.invoice_no}`, m.note].filter(Boolean).join('　·　')}</small>}
                      </span>
                      <b style={{ color: KIND[m.kind][1] }}>{m.kind === 'out' ? '−' : m.kind === 'adj' && m.qty > 0 ? '+' : ''}{m.qty}</b>
                      {edit && <button className="linky" style={{ color: 'var(--red)' }} onClick={() => setDelMv(m)}>✕</button>}
                    </div>
                  ))}
                  {ms.length > 30 && <div className="note" style={{ margin: '4px 0' }}>只顯示最近 30 筆，其餘喺右上角 📋 記錄頁查看</div>}
                </div>
                {edit && (
                  <div className="bh-acts">
                    <button className="btn ghost" onClick={() => setRec({ s, kind: 'in', qty: '', date: today(), supplier: s.supplier || '', price: '', invoice: '', note: '' })}>＋ 入貨</button>
                    <button className="btn ghost" onClick={() => setRec({ s, kind: 'out', qty: '', date: today(), note: '' })}>領用</button>
                    <button className="btn ghost" onClick={() => setRec({ s, kind: 'count', qty: '', date: today(), note: '' })}>盤點</button>
                    <button className="btn ghost" onClick={() => open(s)}>編輯</button>
                  </div>
                )}
              </div>
              <button className="btn ghost" onClick={() => setPv(null)}>關閉</button>
            </div>
          </div>
        )
      })()}

      {rec && (
        <div className="modal" style={{ zIndex: 55 }} onClick={e => { if (e.target === e.currentTarget) setRec(null) }}>
          <div className="sheet">
            <h2>{rec.kind === 'in' ? '入貨' : rec.kind === 'out' ? '領用' : '盤點'}：{rec.s.name}</h2>
            {rec.kind === 'count' && <p className="src-note">系統庫存 {rec.s.stock} {rec.s.unit}。填實際剩餘數量，系統會記錄差額並自動調整庫存。</p>}
            <div className="bh-row2">
              <div className="f-row"><label>{rec.kind === 'count' ? '實際剩餘 *' : `數量（${rec.s.unit}）*`}</label><input type="number" inputMode="numeric" value={rec.qty} onChange={e => setRec({ ...rec, qty: e.target.value })} autoFocus /></div>
              <div className="f-row"><label>{rec.kind === 'in' ? '入貨日期' : rec.kind === 'out' ? '領用日期' : '盤點日期'}</label><input type="date" value={rec.date} onChange={e => setRec({ ...rec, date: e.target.value })} /></div>
            </div>
            {rec.kind === 'in' && (
              <>
                <div className="f-row"><label>供應商</label><input value={rec.supplier} onChange={e => setRec({ ...rec, supplier: e.target.value })} list="sp-suppliers" /></div>
                <datalist id="sp-suppliers">{[...new Set([...list.map(s => s.supplier), ...(mv || []).map(m => m.supplier)].filter(Boolean))].map(x => <option key={x} value={x} />)}</datalist>
                <div className="bh-row2">
                  <div className="f-row"><label>單價（可留空）</label><input type="number" inputMode="decimal" value={rec.price} onChange={e => setRec({ ...rec, price: e.target.value })} /></div>
                  <div className="f-row"><label>單號／發票號</label><input value={rec.invoice} onChange={e => setRec({ ...rec, invoice: e.target.value })} /></div>
                </div>
              </>
            )}
            <div className="f-row"><label>備註</label><input value={rec.note} onChange={e => setRec({ ...rec, note: e.target.value })} /></div>
            <button className="btn" onClick={doRec}>確認</button>
            <button className="btn ghost" onClick={() => setRec(null)}>取消</button>
          </div>
        </div>
      )}

      {form && (
        <div className="modal" style={{ zIndex: 55 }} onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯物資' : '新增物資'}</h2>
            <div className="f-row"><label>名稱 *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="f-row"><label>分類</label>
              <select className="df-sel" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">（未分類）</option>{catNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="bh-row3">
              <div className="f-row"><label>單位</label><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="件／箱／包" /></div>
              <div className="f-row"><label>{form.id ? '庫存' : '期初庫存'}</label><input type="number" inputMode="numeric" value={form.stock} disabled={!!form.id} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
              <div className="f-row"><label>最低庫存</label><input type="number" inputMode="numeric" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
            </div>
            {form.id && <p className="src-note">庫存只可用「入貨」「領用」「盤點」更改。</p>}
            <div className="f-row"><label>常用供應商</label><input value={form.supplier || ''} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
            <div className="f-row"><label>狀態</label>
              <select className="df-sel" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>啟用</option><option>停用</option></select>
            </div>
            <div className="f-row"><label>備註</label><input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <ImageField value={form.image} onChange={v => setForm({ ...form, image: v })} fallback="🧴" />
            <button className="btn" onClick={save}>儲存</button>
            {form.id && <button className="btn danger" onClick={() => setDelS(form)}>刪除</button>}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}
      {delS && <Confirm text={`會刪除物資「${delS.name}」及其全部入貨、領用記錄。`} onConfirm={() => removeSupply(delS)} onCancel={() => setDelS(null)} />}
      {delMv && <Confirm text={`會刪除呢筆${KIND[delMv.kind][0]}記錄（${nameOf(delMv.supply_id)}，${delMv.qty}），庫存會自動重算。`} onConfirm={() => removeMove(delMv)} onCancel={() => setDelMv(null)} />}
      {mgr && <ListManager title="物資分類" table="supply_categories" rows={d.supplyCats} onClose={() => setMgr(false)} onChanged={reload}
        usedBy={async (a, b) => { for (const s of list.filter(x => x.category === a)) await api.dbUpdate('supplies', s.id, { category: b }) }} />}
    </>
  )
}
