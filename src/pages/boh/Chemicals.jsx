import { useEffect, useMemo, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Confirm from '../../components/Confirm'
import { Thumb, ImageField, useImages, setCachedImage, num, today, daysUntil } from './shared'

const EMPTY = { category_id: '', name_zh: '', name_en: '', applicable_zh: '', dilution_zh: '', rinse: 'no', min_stock: 0, status: '啟用', image: '' }

export default function Chemicals({ d, edit, reload, init, reg }) {
  const [sub, setSub] = useState('list')       // list / report
  const [q, setQ] = useState('')
  const [fk, setFk] = useState(init?.fk || 'all')
  const [form, setForm] = useState(null)
  const [orig, setOrig] = useState('')
  const [recv, setRecv] = useState(null)
  const [count, setCount] = useState(null)
  const [be, setBe] = useState(null)           // 編輯批次
  const [del, setDel] = useState(null)
  const [cm, setCm] = useState(false)
  const [delp, setDelp] = useState(null)
  const img = useImages('products', d.products.map(p => p.id))

  const active = p => p.status !== '停用'
  const batchesOf = id => d.batches.filter(b => b.product_id === id).sort((a, b) => String(a.expiry_date || '9999').localeCompare(String(b.expiry_date || '9999')))
  const low = p => active(p) && num(p.min_stock) > 0 && num(p.stock) < num(p.min_stock)
  const expSet = useMemo(() => {
    const s = new Set()
    d.batches.forEach(b => { const p = d.products.find(x => x.id === b.product_id); if (p && active(p) && b.expiry_date && num(b.qty_remaining) > 0 && daysUntil(b.expiry_date) <= 30) s.add(b.product_id) })
    return s
  }, [d.batches, d.products])
  const lowN = d.products.filter(low).length, offN = d.products.filter(p => !active(p)).length

  const shown = d.products.filter(p => {
    if (fk === 'low' && !low(p)) return false
    if (fk === 'exp' && !expSet.has(p.id)) return false
    if (fk === 'off' ? active(p) : (fk !== 'low' && fk !== 'exp' && !active(p))) return false
    if (!['all', 'low', 'exp', 'off'].includes(fk) && String(p.category_id) !== String(fk)) return false
    const s = q.trim().toLowerCase()
    return !s || [p.name_zh, p.name_en, p.applicable_zh].join(' ').toLowerCase().includes(s)
  })
  const groups = d.cats.map(c => ({ c, items: shown.filter(p => p.category_id === c.id) })).filter(g => g.items.length)
  const other = shown.filter(p => !d.cats.some(c => c.id === p.category_id))
  if (other.length) groups.push({ c: { id: 0, icon: '📦', name_zh: '未分類', color: '#7a8894' }, items: other })

  function open(p) {
    const image = p ? img(p.id) || '' : ''
    setOrig(image)
    setForm(p ? { ...p, image, rinse: p.rinse_zh === '需要' ? 'yes' : 'no' } : { ...EMPTY, category_id: d.cats[0]?.id || '' })
  }
  async function save() {
    if (!form.name_zh.trim()) { toast('請填產品名稱'); return }
    const row = { category_id: form.category_id ? Number(form.category_id) : null, name_zh: form.name_zh.trim(), name_en: form.name_en || '', alt: form.name_zh.trim(), applicable_zh: form.applicable_zh || '', dilution_zh: form.dilution_zh || '', rinse_zh: form.rinse === 'yes' ? '需要' : '不需要', rinse_en: form.rinse === 'yes' ? 'Required' : 'Not required', min_stock: num(form.min_stock), status: form.status }
    try {
      if (form.image !== orig) row.image = form.image || null
      if (form.id) { await api.dbUpdate('products', form.id, row); if (form.image !== orig) setCachedImage('products', form.id, form.image) }
      else { const r = await api.dbInsert('products', { ...row, stock: 0, sort_order: d.products.length + 1, image: form.image || null }); setCachedImage('products', r.id, form.image) }
      toast('已儲存'); setForm(null); reload()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function toggle(p) {
    try { await api.dbUpdate('products', p.id, { status: active(p) ? '停用' : '啟用' }); reload() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  async function removeProduct(p) {
    try { await api.dbDelete('products', p.id); toast('已刪除產品'); setDelp(null); setForm(null); reload() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }
  async function doRecv() {
    if (num(recv.qty) <= 0) { toast('請填進貨數量'); return }
    try { await api.dbRpc('receive_batch', { p_product_id: recv.p.id, p_qty: num(recv.qty), p_expiry: recv.expiry || null, p_received: recv.date || today(), p_note: recv.note || null }); toast('已進貨'); setRecv(null); reload() } catch (ex) { toast('進貨失敗：' + ex.message) }
  }
  async function doCount() {
    if (count.actual === '' || num(count.actual) < 0) { toast('請填實際剩餘數量'); return }
    try { await api.dbRpc('stock_count', { p_product_id: count.p.id, p_actual: num(count.actual), p_date: today(), p_note: count.note || null }); toast('已盤點'); setCount(null); reload() } catch (ex) { toast('盤點失敗：' + ex.message) }
  }
  async function saveBatch() {
    try { await api.dbRpc('update_batch', { p_batch_id: be.id, p_qty_remaining: num(be.qty_remaining), p_expiry: be.expiry_date || null, p_received: be.received_date || null, p_note: be.note || null }); toast('已更新'); setBe(null); reload() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  async function delBatch(b) {
    try { await api.dbRpc('delete_batch', { p_batch_id: b.id }); toast('已刪除批次'); setDel(null); reload() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }

  if (reg) reg.current = () => ({
    title: '清潔劑',
    filterText: [fk === 'all' ? '' : fk === 'low' ? '需補貨' : fk === 'exp' ? '臨期' : fk === 'off' ? '停用' : (d.cats.find(c => String(c.id) === String(fk)) || {}).name_zh, q.trim() && `搜尋「${q.trim()}」`].filter(Boolean).join(' · ') || '全部（啟用中）',
    cols: ['名稱', '庫存', '最低', '最近到期', '狀態'],
    groups: groups.map(g => ({
      name: `${g.c.icon || ''} ${g.c.name_zh}`,
      rows: g.items.map(p => {
        const b = batchesOf(p.id).find(x => num(x.qty_remaining) > 0 && x.expiry_date)
        return { photo: img(p.id), cells: [p.name_zh, p.stock, num(p.min_stock) || '—', b ? b.expiry_date : '—', active(p) ? '啟用' : '停用'], cls: ['', low(p) ? 'rpt-red' : '', '', b && daysUntil(b.expiry_date) <= 30 ? 'rpt-red' : '', ''] }
      }),
    })),
  })
  const chip = (k, t) => <button key={k} className={`chip ${fk === k ? 'on' : ''}`} onClick={() => setFk(k)}>{t}</button>
  return (
    <>
      {sub === 'report' && <button className="linky" style={{ fontSize: 13.5, margin: '0 0 8px', padding: 0 }} onClick={() => setSub('list')}>‹ 返回產品</button>}
      {sub === 'report' ? <UsageReport d={d} /> : (
        <>
          <div className="srch-row">
            <input className="search-inp" placeholder="🔍 搜尋名稱、適用範圍" value={q} onChange={e => setQ(e.target.value)} />
            <button className="tb-btn sq" title="用量報表" onClick={() => setSub('report')}>📊</button>
            {edit && <button className="tb-btn sq" title="管理分類" onClick={() => setCm(true)}>⚙</button>}
          </div>
          <div className="chips">
            {chip('all', `全部 ${d.products.filter(active).length}`)}
            {lowN > 0 && chip('low', `🛒 補貨 ${lowN}`)}
            {expSet.size > 0 && chip('exp', `⚠ 臨期 ${expSet.size}`)}
            {offN > 0 && chip('off', `停用 ${offN}`)}
            {d.cats.map(c => chip(String(c.id), `${c.icon || ''} ${c.name_zh}`))}
          </div>
          {groups.length === 0 && <div className="note">沒有符合的產品</div>}
          {groups.map(g => (
            <div key={g.c.id}>
              <div className="bh-grp" style={{ borderColor: g.c.color }}>{g.c.icon} {g.c.name_zh}<span>{g.items.length}</span></div>
              {g.items.map(p => {
                const bs = batchesOf(p.id)
                return (
                  <div className="c-item bh-card" key={p.id} style={!active(p) ? { opacity: .6 } : undefined}>
                    <div className="bh-item" style={{ cursor: 'default' }}>
                      <Thumb src={img(p.id)} fallback="🧴" size={72} />
                      <div className="bh-main">
                        <div className="bh-name">{p.name_zh}{!active(p) && <span className="badge b-gray">停用</span>}</div>
                        {p.name_en && <div className="bh-sub">{p.name_en}</div>}
                      </div>
                      <div className="bh-stock">
                        <div className={`bh-sn ${low(p) ? 'low' : ''}`}>{p.stock}</div>
                        <div className="bh-sl">{low(p) ? '需補貨' : '庫存'}</div>
                        {num(p.min_stock) > 0 && <div className="bh-sl">最低 {p.min_stock}</div>}
                      </div>
                    </div>
                    <div className="bh-info">
                      {p.applicable_zh && <div><span>適用範圍</span><b>{p.applicable_zh}</b></div>}
                      {p.dilution_zh && <div><span>兌水比例</span><b>{p.dilution_zh}</b></div>}
                      {p.rinse_zh && <div><span>需要過水</span><b>{p.rinse_zh}</b></div>}
                    </div>
                    {bs.length > 0 && (
                      <div className="bh-batches">
                        <div className="bh-bt">效期批次</div>
                        {bs.map(b => {
                          const dd = daysUntil(b.expiry_date)
                          const cls = dd === null ? 'none' : dd < 0 ? 'past' : dd <= 30 ? 'soon' : 'ok'
                          return (
                            <div key={b.id} className="bh-b">
                              <i className={`bh-dot ${cls}`} />
                              <span style={{ flex: 1 }}>{b.expiry_date || '未設效期'}{dd !== null && dd < 0 ? '（已過期）' : dd !== null && dd <= 30 ? `（剩${dd}天）` : ''}</span>
                              <b>{b.qty_remaining}</b>
                              {edit && <button className="linky" onClick={() => setBe({ ...b })}>✎</button>}
                              {edit && <button className="linky" style={{ color: 'var(--red)' }} onClick={() => setDel(b)}>✕</button>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {edit && (
                      <div className="bh-acts">
                        <button className="btn ghost" onClick={() => setRecv({ p, qty: '', expiry: '', date: today(), note: '' })}>＋ 進貨</button>
                        <button className="btn ghost" onClick={() => setCount({ p, actual: '', note: '' })}>盤點</button>
                        <button className="btn ghost" onClick={() => open(p)}>編輯</button>
                        <button className="btn ghost" onClick={() => toggle(p)}>{active(p) ? '停用' : '啟用'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {edit && <button className="fab" onClick={() => open(null)}>＋</button>}
        </>
      )}

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯產品' : '新增產品'}</h2>
            <div className="f-row"><label>類別</label>
              <select className="df-sel" value={form.category_id || ''} onChange={e => setForm({ ...form, category_id: e.target.value })}>{d.cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name_zh}</option>)}</select>
            </div>
            <div className="bh-row2">
              <div className="f-row"><label>名稱（中）*</label><input value={form.name_zh} onChange={e => setForm({ ...form, name_zh: e.target.value })} /></div>
              <div className="f-row"><label>名稱（英）</label><input value={form.name_en || ''} onChange={e => setForm({ ...form, name_en: e.target.value })} /></div>
            </div>
            <ImageField value={form.image} onChange={v => setForm({ ...form, image: v })} fallback="🧴" />
            <div className="f-row"><label>適用範圍</label><input value={form.applicable_zh || ''} onChange={e => setForm({ ...form, applicable_zh: e.target.value })} /></div>
            <div className="bh-row2">
              <div className="f-row"><label>兌水比例</label><input value={form.dilution_zh || ''} onChange={e => setForm({ ...form, dilution_zh: e.target.value })} /></div>
              <div className="f-row"><label>需要過水</label>
                <select className="df-sel" value={form.rinse} onChange={e => setForm({ ...form, rinse: e.target.value })}><option value="no">不需要</option><option value="yes">需要</option></select>
              </div>
            </div>
            <div className="f-row"><label>最低庫存（低於就提醒補貨，0＝不提醒）</label><input type="number" inputMode="numeric" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
            {form.id && <p className="src-note">庫存目前 {form.stock}，只可用「進貨」與「盤點」更改。</p>}
            <button className="btn" onClick={save}>儲存</button>
            {form.id && <button className="btn danger" onClick={() => setDelp(form)}>刪除產品</button>}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}
      {delp && <Confirm text={`會刪除產品「${delp.name_zh}」及其全部批次與庫存異動記錄。`} onConfirm={() => removeProduct(delp)} onCancel={() => setDelp(null)} />}

      {recv && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setRecv(null) }}>
          <div className="sheet">
            <h2>進貨：{recv.p.name_zh}</h2>
            <div className="f-row"><label>數量 *</label><input type="number" inputMode="numeric" value={recv.qty} onChange={e => setRecv({ ...recv, qty: e.target.value })} autoFocus /></div>
            <div className="bh-row2">
              <div className="f-row"><label>到期日</label><input type="date" value={recv.expiry} onChange={e => setRecv({ ...recv, expiry: e.target.value })} /></div>
              <div className="f-row"><label>進貨日期</label><input type="date" value={recv.date} onChange={e => setRecv({ ...recv, date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註</label><input value={recv.note} onChange={e => setRecv({ ...recv, note: e.target.value })} /></div>
            <button className="btn" onClick={doRecv}>確認進貨</button>
            <button className="btn ghost" onClick={() => setRecv(null)}>取消</button>
          </div>
        </div>
      )}

      {count && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setCount(null) }}>
          <div className="sheet">
            <h2>盤點：{count.p.name_zh}</h2>
            <p className="src-note">系統庫存 {count.p.stock}。填實際剩餘數量，系統會把差額當用量，並由最早到期批次扣除。</p>
            <div className="f-row"><label>實際剩餘 *</label><input type="number" inputMode="numeric" value={count.actual} onChange={e => setCount({ ...count, actual: e.target.value })} autoFocus /></div>
            <div className="f-row"><label>備註</label><input value={count.note} onChange={e => setCount({ ...count, note: e.target.value })} /></div>
            <button className="btn" onClick={doCount}>確認盤點</button>
            <button className="btn ghost" onClick={() => setCount(null)}>取消</button>
          </div>
        </div>
      )}

      {be && (
        <div className="modal" style={{ zIndex: 55 }} onClick={e => { if (e.target === e.currentTarget) setBe(null) }}>
          <div className="sheet">
            <h2>編輯批次</h2>
            <div className="bh-row2">
              <div className="f-row"><label>剩餘數量</label><input type="number" inputMode="numeric" value={be.qty_remaining} onChange={e => setBe({ ...be, qty_remaining: e.target.value })} /></div>
              <div className="f-row"><label>到期日</label><input type="date" value={be.expiry_date || ''} onChange={e => setBe({ ...be, expiry_date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註</label><input value={be.note || ''} onChange={e => setBe({ ...be, note: e.target.value })} /></div>
            <button className="btn" onClick={saveBatch}>儲存</button>
            <button className="btn ghost" onClick={() => setBe(null)}>取消</button>
          </div>
        </div>
      )}
      {del && <Confirm text={`會刪除這個批次（到期日 ${del.expiry_date || '未設'}，剩餘 ${del.qty_remaining}）。`} onConfirm={() => delBatch(del)} onCancel={() => setDel(null)} />}
      {cm && <CatManager d={d} onClose={() => setCm(false)} reload={reload} />}
    </>
  )
}

function CatManager({ d, onClose, reload }) {
  const [nz, setNz] = useState('')
  async function upd(c, patch) { try { await api.dbUpdate('boh_categories', c.id, patch); reload() } catch (ex) { toast('更新失敗：' + ex.message) } }
  async function add() { if (!nz.trim()) return; try { await api.dbInsert('boh_categories', { icon: '📦', name_zh: nz.trim(), name_en: nz.trim(), color: '#1f7a6d', bg: '#e2f0ee', sort_order: d.cats.length + 1 }); setNz(''); reload() } catch (ex) { toast('新增失敗：' + ex.message) } }
  async function rm(c) { try { await api.dbDelete('boh_categories', c.id); reload() } catch (ex) { toast('刪除失敗：' + ex.message) } }
  return (
    <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <h2>清潔劑分類</h2>
        {d.cats.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="df-sel" style={{ flex: '0 0 56px', textAlign: 'center' }} defaultValue={c.icon} onBlur={e => e.target.value !== c.icon && upd(c, { icon: e.target.value })} />
            <input className="df-sel" defaultValue={c.name_zh} onBlur={e => e.target.value.trim() && e.target.value !== c.name_zh && upd(c, { name_zh: e.target.value.trim(), name_en: e.target.value.trim() })} />
            <button className="mini danger" onClick={() => rm(c)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="df-sel" placeholder="新增分類名稱" value={nz} onChange={e => setNz(e.target.value)} />
          <button className="btn" style={{ width: 'auto', padding: '0 18px', margin: 0 }} onClick={add}>新增</button>
        </div>
        <button className="btn ghost" onClick={onClose}>完成</button>
      </div>
    </div>
  )
}

function UsageReport({ d }) {
  const [mv, setMv] = useState(null)
  const [per, setPer] = useState('month')
  const [pick, setPick] = useState('')
  useEffect(() => { api.dbSelect('stock_movements', { cols: 'product_id,kind,qty,happened_on', order: 'happened_on' }).then(setMv).catch(ex => { toast('讀取失敗：' + ex.message); setMv([]) }) }, [])
  if (!mv) return <div className="note">載入中…</div>
  const keyOf = dt => { const y = dt.slice(0, 4), m = +dt.slice(5, 7); return per === 'year' ? y : per === 'quarter' ? `${y} Q${Math.ceil(m / 3)}` : dt.slice(0, 7) }
  const outs = mv.filter(r => r.kind === 'out' && r.happened_on)
  const totals = {}
  outs.forEach(r => { const k = keyOf(r.happened_on); totals[k] = (totals[k] || 0) + num(r.qty) })
  const keys = Object.keys(totals).sort().reverse()
  const cur = keys.includes(pick) ? pick : keys[0]
  const byProd = {}
  outs.filter(r => keyOf(r.happened_on) === cur).forEach(r => { byProd[r.product_id] = (byProd[r.product_id] || 0) + num(r.qty) })
  const rows = Object.entries(byProd).map(([id, n]) => ({ name: (d.products.find(p => p.id === +id) || {}).name_zh || `#${id}`, n })).sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map(r => r.n))
  return (
    <>
      <div className="chips">
        {[['month', '月'], ['quarter', '季'], ['year', '年']].map(([k, t]) => <button key={k} className={`chip ${per === k ? 'on' : ''}`} onClick={() => { setPer(k); setPick('') }}>{t}</button>)}
      </div>
      {keys.length === 0 ? <div className="note">未有用量記錄（盤點後會自動產生）</div> : (
        <>
          <div className="chips">{keys.slice(0, 12).map(k => <button key={k} className={`chip ${cur === k ? 'on' : ''}`} onClick={() => setPick(k)}>{k} · {totals[k]}</button>)}</div>
          <div className="card"><h2>{cur} 用量　共 {totals[cur]}</h2>
            {rows.map(r => (
              <div className="bar-row" key={r.name}><span className="name">{r.name}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${(r.n / max) * 100}%`, background: 'var(--accent)' }} /></div><span className="num">{r.n}</span></div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
