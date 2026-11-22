import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { today } from './shared'

// 清潔劑：供應商＋item code 清單，同每次落單紀錄（上次落單日期／數量／供應商／item code）
const money = n => (n == null || n === '' ? '' : Number(n).toLocaleString())
const dTxt = d => (d ? String(d).slice(0, 10).replace(/-/g, '/') : '—')
const copy = async t => { try { await navigator.clipboard.writeText(t); toast('已複製 ' + t) } catch { toast('複製失敗，請手動抄：' + t) } }

export default function ChemOrders({ product, edit }) {
  const pid = product.id
  const [sup, setSup] = useState(null)
  const [ord, setOrd] = useState(null)
  const [fs, setFs] = useState(null)     // 供應商表單
  const [fo, setFo] = useState(null)     // 落單表單
  const [all, setAll] = useState(false)
  const load = () => {
    api.dbSelect('product_suppliers', { eq: { product_id: pid }, order: 'sort_order' }).then(setSup).catch(() => setSup([]))
    api.dbSelect('product_orders', { eq: { product_id: pid }, order: 'order_date', asc: false }).then(setOrd).catch(() => setOrd([]))
  }
  useEffect(() => { setSup(null); setOrd(null); setAll(false); load() }, [pid])
  if (!sup || !ord) return <div className="bh-batches"><div className="bh-bt">🛒 供應商／落單</div><p className="src-note">載入中…</p></div>

  const last = [...ord].sort((a, b) => String(b.order_date).localeCompare(String(a.order_date)) || String(b.created_at).localeCompare(String(a.created_at)))[0]
  const lastTxt = last ? `${dTxt(last.order_date)} ｜ ${last.qty != null ? money(last.qty) + (last.unit ? ' ' + last.unit : '') : '—'} ｜ ${last.supplier || '未記供應商'}${last.item_code ? ' ｜ ' + last.item_code : ''}${last.po_no ? ' ｜ ' + last.po_no : ''}` : null

  async function saveSup() {
    if (!fs.supplier.trim()) return toast('請填供應商')
    const row = { product_id: pid, supplier: fs.supplier.trim(), item_code: fs.item_code.trim(), unit: fs.unit.trim(), price: fs.price === '' ? null : Number(fs.price), notes: fs.notes.trim() }
    if (row.price != null && Number.isNaN(row.price)) return toast('單價要係數字')
    try {
      if (fs.id) await api.dbUpdate('product_suppliers', fs.id, row); else await api.dbInsert('product_suppliers', { ...row, sort_order: sup.length + 1 })
      toast('已儲存'); setFs(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delSup() {
    if (!window.confirm('刪除呢個供應商？（已記低嘅落單紀錄唔受影響）')) return
    try { await api.dbDelete('product_suppliers', fs.id); toast('已刪除'); setFs(null); load() } catch (ex) { toast(ex.message) }
  }
  async function saveOrd() {
    if (!fo.order_date) return toast('請填落單日期')
    const row = { product_id: pid, order_date: fo.order_date, qty: fo.qty === '' ? null : Number(fo.qty), unit: fo.unit.trim(), supplier: fo.supplier.trim(), item_code: fo.item_code.trim(), po_no: fo.po_no.trim(), price: fo.price === '' ? null : Number(fo.price), notes: fo.notes.trim() }
    if ((row.qty != null && Number.isNaN(row.qty)) || (row.price != null && Number.isNaN(row.price))) return toast('數量同單價要係數字')
    try {
      if (fo.id) await api.dbUpdate('product_orders', fo.id, row); else await api.dbInsert('product_orders', row)
      toast('已儲存'); setFo(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delOrd() {
    if (!window.confirm('刪除呢條落單紀錄？')) return
    try { await api.dbDelete('product_orders', fo.id); toast('已刪除'); setFo(null); load() } catch (ex) { toast(ex.message) }
  }
  const newOrd = () => {
    const s = last && sup.find(x => x.supplier === last.supplier) || sup[0]
    setFo({ id: null, order_date: today(), qty: '', unit: s?.unit || last?.unit || '', supplier: s?.supplier || last?.supplier || '', item_code: s?.item_code || last?.item_code || '', po_no: '', price: s?.price ?? '', notes: '' })
  }
  const pickSup = name => {
    const s = sup.find(x => x.supplier === name)
    setFo(f => ({ ...f, supplier: name, ...(s ? { item_code: s.item_code || '', unit: s.unit || f.unit, price: s.price ?? f.price } : {}) }))
  }
  const shown = all ? ord : ord.slice(0, 5)

  const kv = (k, v) => <div className="co-kv"><span>{k}</span><b>{v || '—'}</b></div>
  return (
    <div className="co-box">
      <div className="co-hd">🛒 供應商／落單</div>
      <div className={'co-last' + (last ? '' : ' none')}>
        <div className="co-sec">上次落單</div>
        {last ? (
          <div className="co-grid">
            {kv('日期', dTxt(last.order_date))}
            {kv('數量', last.qty != null ? money(last.qty) + (last.unit ? ' ' + last.unit : '') : '')}
            {kv('供應商', last.supplier || '未記供應商')}
            {kv('Item code', last.item_code)}
            {last.po_no ? kv('PO', last.po_no) : null}
          </div>
        ) : <div className="co-empty">未有落單紀錄</div>}
      </div>

      <div className="co-sec">供應商／item code</div>
      {sup.length === 0 && <div className="co-empty">未有供應商</div>}
      {sup.map(s => (
        <div key={s.id} className="co-row">
          <div className="co-main">
            <b>{s.supplier}</b>
            <small>{[s.unit, s.price != null ? 'HKD ' + money(s.price) : '', s.notes].filter(Boolean).join(' · ') || ' '}</small>
          </div>
          {s.item_code ? <button className="co-code" onClick={() => copy(s.item_code)} title="撳一下複製">{s.item_code}<i>複製</i></button> : <span className="co-nocode">未填 code</span>}
          {edit && <button className="co-edit" onClick={() => setFs({ ...s, price: s.price ?? '' })} aria-label="修改">✎</button>}
        </div>
      ))}

      {ord.length > 0 && <div className="co-sec">落單紀錄（{ord.length}）</div>}
      {shown.map(o => (
        <div key={o.id} className="co-row">
          <div className="co-date">{dTxt(o.order_date)}</div>
          <div className="co-main">
            <b>{o.qty != null ? money(o.qty) + (o.unit ? ' ' + o.unit : '') : '—'} · {o.supplier || '未記供應商'}</b>
            <small>{[o.item_code, o.po_no, o.price != null ? 'HKD ' + money(o.price) : '', o.notes].filter(Boolean).join(' · ') || ' '}</small>
          </div>
          {edit && <button className="co-edit" onClick={() => setFo({ ...o, qty: o.qty ?? '', price: o.price ?? '' })} aria-label="修改">✎</button>}
        </div>
      ))}
      {ord.length > 5 && <button className="co-more" onClick={() => setAll(!all)}>{all ? '收起' : `睇晒全部 ${ord.length} 條`}</button>}
      {edit && (
        <div className="co-acts">
          <button className="co-btn" onClick={() => setFs({ id: null, supplier: '', item_code: '', unit: '', price: '', notes: '' })}>＋ 供應商／code</button>
          <button className="co-btn pri" onClick={newOrd}>＋ 記錄落單</button>
        </div>
      )}

      {fs && (
        <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setFs(null) }}>
          <div className="sheet">
            <h2>{fs.id ? '修改供應商' : '加供應商'}</h2>
            <div className="f-row"><label>供應商 *</label><input list="co-sup" value={fs.supplier} onChange={e => setFs({ ...fs, supplier: e.target.value })} placeholder="例：Ecolab / 藝康有限公司" autoFocus />
              <datalist id="co-sup">{[...new Set([...sup.map(x => x.supplier), ...ord.map(x => x.supplier)].filter(Boolean))].map(x => <option key={x} value={x} />)}</datalist></div>
            <div className="f-row"><label>Item code</label><input value={fs.item_code} onChange={e => setFs({ ...fs, item_code: e.target.value })} placeholder="例：5010200193" /></div>
            <div className="bh-row2">
              <div className="f-row"><label>包裝單位</label><input value={fs.unit} onChange={e => setFs({ ...fs, unit: e.target.value })} placeholder="例：CASE／箱／桶" /></div>
              <div className="f-row"><label>單價（HKD）</label><input inputMode="decimal" value={fs.price} onChange={e => setFs({ ...fs, price: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註</label><input value={fs.notes} onChange={e => setFs({ ...fs, notes: e.target.value })} placeholder="例：2 x 2 公升裝／聯絡人" /></div>
            <button className="btn" onClick={saveSup}>儲存</button>
            {fs.id && <button className="btn danger sm-quiet" onClick={delSup}>刪除呢個供應商</button>}
            <button className="btn ghost" onClick={() => setFs(null)}>取消</button>
          </div>
        </div>
      )}
      {fo && (
        <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setFo(null) }}>
          <div className="sheet">
            <h2>{fo.id ? '修改落單紀錄' : '記錄落單'}：{product.name_zh}</h2>
            <div className="bh-row2">
              <div className="f-row"><label>落單日期 *</label><input type="date" value={fo.order_date} onChange={e => setFo({ ...fo, order_date: e.target.value })} /></div>
              <div className="f-row"><label>數量</label><input inputMode="decimal" value={fo.qty} onChange={e => setFo({ ...fo, qty: e.target.value })} autoFocus /></div>
            </div>
            <div className="f-row"><label>供應商</label><input list="co-sup2" value={fo.supplier} onChange={e => pickSup(e.target.value)} placeholder="揀或者自己打" />
              <datalist id="co-sup2">{[...new Set([...sup.map(x => x.supplier), ...ord.map(x => x.supplier)].filter(Boolean))].map(x => <option key={x} value={x} />)}</datalist></div>
            <div className="bh-row2">
              <div className="f-row"><label>Item code</label><input value={fo.item_code} onChange={e => setFo({ ...fo, item_code: e.target.value })} /></div>
              <div className="f-row"><label>單位</label><input value={fo.unit} onChange={e => setFo({ ...fo, unit: e.target.value })} placeholder="CASE／箱" /></div>
            </div>
            <div className="bh-row2">
              <div className="f-row"><label>PO 編號</label><input value={fo.po_no} onChange={e => setFo({ ...fo, po_no: e.target.value })} placeholder="例：PO25012997" /></div>
              <div className="f-row"><label>單價（HKD）</label><input inputMode="decimal" value={fo.price} onChange={e => setFo({ ...fo, price: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註</label><input value={fo.notes} onChange={e => setFo({ ...fo, notes: e.target.value })} /></div>
            <button className="btn" onClick={saveOrd}>儲存</button>
            {fo.id && <button className="btn danger sm-quiet" onClick={delOrd}>刪除呢條紀錄</button>}
            <button className="btn ghost" onClick={() => setFo(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
