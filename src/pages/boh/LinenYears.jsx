import { Ordered } from '../../lib/cardOrder'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Icon from '../../components/Icon'
import { ToolBar } from '../../components/ui'

const hk = n => (n == null || n === '' ? '—' : 'HKD ' + Number(n).toLocaleString())
const nmOf = i => [i.name, i.size].filter(Boolean).join(' ') || '（未命名）'
// 品名 + 細字尺碼
const NameSz = ({ i }) => (i ? <>{i.name || '（未命名）'}{i.size ? <small style={{ display: 'block', fontSize: '.62em', fontWeight: 500, opacity: .65, marginTop: 2 }}>{i.size}</small> : null}</> : '（已刪除品項）')
const emptyRec = (year) => ({ id: null, item_id: '', year, purchase_qty: '', unit_price: '', supplier: '', condemned_qty: '', lost_qty: '', note: '' })

// 布草入口：現有庫存 + 每個年份一張卡
export function LinenHome({ items, yrs, edit, onPick, onAdd }) {
  const years = [...new Set(yrs.map(r => r.year))].sort((a, b) => b - a)
  const stat = y => {
    const rs = yrs.filter(r => r.year === y)
    const q = rs.reduce((a, r) => a + (r.purchase_qty || 0), 0)
    const sup = [...new Set(rs.filter(r => r.purchase_qty).map(r => r.supplier).filter(Boolean))].join('、')
    return { q, sup }
  }
  const cards = [
    ['stock', '各款現有數量', 'bed', '#3a8fb5', `${items.length} 款`],
    ...years.map(y => { const t = stat(y); return [y, y + ' 年', 'calendar', '#8a5fa8', t.q ? `入貨 ${t.q.toLocaleString()} 件${t.sup ? ' · ' + t.sup : ''}` : '盤點／報廢紀錄'] }),
  ]
  const sum = k => yrs.reduce((a, r) => a + (r[k] || 0), 0)
  const money = yrs.reduce((a, r) => a + (r.purchase_qty || 0) * (Number(r.unit_price) || 0), 0)
  const tiles = [['總入貨', sum('purchase_qty').toLocaleString() + ' 件', 'HKD ' + Math.round(money).toLocaleString()], ['總報廢', sum('condemned_qty').toLocaleString() + ' 件', ''], ['盤點遺失', sum('lost_qty').toLocaleString() + ' 件', years.length ? years[years.length - 1] + '–' + years[0] + ' 年' : '']]
  return (
    <>
      <div className="lin-sum">
        {tiles.map(([t, v, sub]) => <div className="lin-sum-t" key={t}><span>{t}</span><b>{v}</b>{sub ? <small>{sub}</small> : null}</div>)}
      </div>
      <Ordered okey="linen" items={cards} idOf={x => String(x[0])} labelOf={x => x[1]}>{list => (
        <div className="home-grid lin-grid">
          {list.map(([k, t, ic, co, sub]) => (
            <button className="home-item" key={k} onClick={() => onPick(k)}>
              <span className="hi-circle" style={{ background: co + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={co} width={2.2} /></span>
              <span className="hi-label">{t}</span>
              <span className="hi-sub">{sub}</span>
            </button>
          ))}
        </div>
      )}</Ordered>
      {edit && (
        <button className="btn ghost sm-quiet" style={{ margin: '14px 4px' }} onClick={() => {
          const y = Number(window.prompt('新增年份（例如 2027）', String(new Date().getFullYear() + 1)))
          if (y > 1990 && y < 2100) onAdd(y)
        }}>＋ 新增年份</button>
      )}
    </>
  )
}

// 某一年嘅布草紀錄：入貨數量、當時單價、供應商、報廢、盤點遺失
export function LinenYear({ year, items, yrs, edit, ys, setYs, reload }) {
  const rs = yrs.filter(r => r.year === year)
  const byId = Object.fromEntries(items.map(i => [i.id, i]))
  const tq = rs.reduce((a, r) => a + (r.purchase_qty || 0), 0)
  const tc = rs.reduce((a, r) => a + (r.purchase_qty || 0) * (Number(r.unit_price) || 0), 0)
  const td = rs.reduce((a, r) => a + (r.condemned_qty || 0), 0)
  const n = v => (v === '' || v == null ? null : Number(v))
  async function save() {
    const e = ys
    if (!e.item_id) return toast('請揀品項')
    const row = { item_id: e.item_id, year, purchase_qty: n(e.purchase_qty), unit_price: n(e.unit_price), currency: 'HKD', supplier: (e.supplier || '').trim(), condemned_qty: n(e.condemned_qty), lost_qty: n(e.lost_qty), note: (e.note || '').trim() }
    try {
      if (e.id) await api.dbUpdate('uni_linen_yr', e.id, row); else await api.dbUpsert('uni_linen_yr', row, 'item_id,year')
      toast('已儲存'); setYs(null); reload()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function del() { try { await api.dbDelete('uni_linen_yr', ys.id); toast('已刪除'); setYs(null); reload() } catch (ex) { toast(ex.message) } }
  const F = (k, label) => (
    <div className="f-row" style={{ flex: '1 1 40%' }}><label>{label}</label>
      <input inputMode="decimal" value={ys[k] ?? ''} onChange={e => setYs({ ...ys, [k]: e.target.value })} /></div>
  )
  const sorted = [...rs].sort((a, b) => (byId[a.item_id]?.sort_order || 0) - (byId[b.item_id]?.sort_order || 0))
  return (
    <>
      <ToolBar label={`${year} 年 · 布草紀錄`} />
      <p className="pa-stat">入貨 {tq.toLocaleString()} 件　·　當時金額 {hk(Math.round(tc))}　·　報廢 {td.toLocaleString()} 件</p>
      {rs.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>呢一年未有紀錄。{edit ? '撳右下角「＋」新增。' : ''}</p>}
      <Ordered okey="linen_items" items={sorted} idOf={r => r.item_id} labelOf={r => byId[r.item_id]?.name || '（已刪除品項）'}>{ord => (
      <div className="pa-grid pa-grid-an">
        {ord.map(r => (
          <div className="pa-sq pa-an" key={r.id} role="button" tabIndex={0} onClick={() => edit && setYs({ ...r })} style={edit ? undefined : { cursor: 'default' }}>
            <span className="pa-sq-top"><em>{r.supplier || (edit ? '＋ 填供應商' : '未填供應商')}</em></span>
            <b className="pa-sq-name"><NameSz i={byId[r.item_id]} /></b>
            <span className="pa-sq-post">
              {r.purchase_qty ? <span className="st-qty">{r.purchase_qty.toLocaleString()}<small> 件入貨</small></span> : null}
              {r.unit_price != null && <span className="pa-sub">單價 {hk(r.unit_price)}{r.purchase_qty ? ' · 共 ' + hk(Math.round(r.purchase_qty * r.unit_price)) : ''}</span>}
              {r.condemned_qty != null && <span className="pa-hrs">報廢 {r.condemned_qty.toLocaleString()} 件</span>}
              {r.lost_qty != null && <span className="pa-hrs">盤點遺失 {r.lost_qty.toLocaleString()} 件</span>}
              {r.note && <span className="pa-sq-area">{r.note}</span>}
            </span>
          </div>
        ))}
      </div>
      )}</Ordered>
      {edit && <button className="fab" onClick={() => setYs(emptyRec(year))}>＋</button>}
      {ys && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setYs(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{year} 年紀錄</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setYs(null)}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
            <div className="f-row"><label>品項</label>
              <select value={ys.item_id} disabled={!!ys.id} onChange={e => setYs({ ...ys, item_id: e.target.value })}>
                <option value="">揀品項…</option>
                {items.map(i => <option key={i.id} value={i.id}>{nmOf(i)}</option>)}
              </select></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {F('purchase_qty', '入貨數量')}{F('unit_price', '當時單價（HKD）')}
              <div className="f-row" style={{ flex: '1 1 100%' }}><label>供應商</label>
                <input list="lin-sup" placeholder="自己打供應商名" value={ys.supplier || ''} onChange={e => setYs({ ...ys, supplier: e.target.value })} />
                <datalist id="lin-sup">{[...new Set(yrs.map(r => r.supplier).filter(Boolean))].map(x => <option key={x} value={x} />)}</datalist></div>
              {F('condemned_qty', '報廢數量')}{F('lost_qty', '盤點遺失數量')}
            </div>
            <div className="f-row"><label>備註</label><input value={ys.note || ''} onChange={e => setYs({ ...ys, note: e.target.value })} /></div>
            {ys.id && <button className="btn danger sm-quiet" onClick={del}>刪除呢條紀錄</button>}
          </div>
        </div>
      )}
    </>
  )
}

export { emptyRec }
