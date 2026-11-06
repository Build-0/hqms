import { Ordered } from '../../lib/cardOrder'
import { LinenHome, LinenRec, LinenPrice, LinenBase, LinenYear, emptyRec } from './LinenYears'
import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import { todayStr } from '../../lib/dates'
import { useBack } from '../../lib/nav'
import Icon from '../../components/Icon'
import { ToolBar, ExportBtn } from '../../components/ui'
import { ReportModal, ListReport } from '../../components/Reports'

// 制服與布草管理：只做庫存（領用／歸還由各部門自己嘅系統處理）
// 入口分「制服」「布草」「物資」三類（物資＝制服房嘅大桶、布草車、熨斗等器具），各有自己嘅品項；布草預設有酒店常用嘅床上用品、浴室布草、布草袋
const CATS = [['制服', 'shirt', '#8f7ac9'], ['布草', 'bed', '#3a8fb5'], ['物資', 'box', '#c98a3a']]
// 酒店房間基數：820 間房、10 層、每層 82 間（大床 26 + 小床 56，小床房每間兩張）
const FLOORS = 10
const baseTxt = i => (i.base_floor ? `基數 一層 ${i.base_floor.toLocaleString()} ／ ${FLOORS} 層 ${(i.base_floor * FLOORS).toLocaleString()}` : '')
const GRP_HINT = { 制服: ['上衣', '褲／裙', '外套', '其他'], 布草: ['床上用品', '浴室布草', '布草袋', '其他'], 物資: ['布草車／大桶', '熨斗／熨燙', '架／推車', '其他'] }

export default function Uniform({ edit }) {
  const [items, setItems] = useState(null)
  const [cat, setCat] = useState(null)           // null：兩張入口卡；否則顯示該類庫存
  const [f, setF] = useState({ low: false, q: '' })
  const [sheet, setSheet] = useState(null)
  const [report, setReport] = useState(false)
  const [view, setView] = useState(null)       // 唯讀查看（冇編輯權限）
  const [upBusy, setUpBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sub, setSub] = useState(null)       // 布草入面：null＝入口卡；'stock'＝現有庫存；數字＝該年紀錄
  const [yrs, setYrs] = useState([])
  const [ys, setYs] = useState(null)
  useBack(!!cat, () => { setCat(null); setSub(null) })
  useBack(cat === '布草' && sub != null, () => setSub(typeof sub === 'number' ? 'rec' : null))
  const load = () => api.dbSelect('uni_items', { order: 'sort_order' }).then(r => { setItems(r); setErr('') }).catch(ex => { setErr(ex.message); setItems(prev => prev || []) })
  const loadYrs = () => api.dbSelect('uni_linen_yr', { order: 'year' }).then(setYrs).catch(() => setYrs([]))
  useEffect(() => { load(); loadYrs() }, [])
  if (!items) return <div className="note">載入中…</div>
  const nm = i => [i.name, i.size].filter(Boolean).join(' ') || '（未命名）'
  const low = i => i.min_qty > 0 && i.qty <= i.min_qty
  const ofCat = c => items.filter(i => (i.cat || '制服') === c)

  if (!cat) {
    return (
      <>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        <Ordered okey="uniform" items={CATS} idOf={x => x[0]} labelOf={x => x[0]}>{list => (
          <div className="home-grid">
            {list.map(([c, ic, co]) => (
              <button className="home-item" key={c} onClick={() => { setCat(c); setF({ low: false, q: '' }) }}>
                <span className="hi-circle" style={{ background: co + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={co} width={2.2} /></span>
                <span className="hi-label">{c}</span>
                <span className="hi-sub">{ofCat(c).length} 款{ofCat(c).filter(low).length ? ` · ${ofCat(c).filter(low).length} 項存量低` : ''}</span>
              </button>
            ))}
          </div>
        )}</Ordered>
      </>
    )
  }

  if (cat === '布草' && sub == null) return <LinenHome items={ofCat('布草')} yrs={yrs} onPick={setSub} />
  if (cat === '布草' && sub === 'base') return <LinenBase items={ofCat('布草')} edit={edit} onSaved={load} />
  if (cat === '布草' && sub === 'price') return <LinenPrice items={ofCat('布草')} yrs={yrs} />
  if (cat === '布草' && sub === 'rec') return <LinenRec yrs={yrs} edit={edit} onPick={setSub} onAdd={y => { setSub(y); setYs(emptyRec(y)) }} />
  if (cat === '布草' && typeof sub === 'number') return <LinenYear year={sub} items={ofCat('布草')} yrs={yrs} edit={edit} ys={ys} setYs={setYs} reload={loadYrs} />

  const all = ofCat(cat)
  const list = all.filter(i => (!f.low || low(i)) && (!f.q.trim() || (nm(i) + (i.location || '') + (i.grp || '')).toLowerCase().includes(f.q.trim().toLowerCase())))
  const total = all.reduce((a, i) => a + (Number(i.qty) || 0), 0)
  const lowN = all.filter(low).length
  const groups = []
  list.forEach(i => { const g = i.grp || '未分類'; const x = groups.find(y => y.g === g); if (x) x.items.push(i); else groups.push({ g, items: [i] }) })
  const hasGroups = groups.some(g => g.g !== '未分類')
  const regroup = arr => { const out = []; arr.forEach(i => { const g = i.grp || '未分類'; const x = out.find(y => y.g === g); if (x) x.items.push(i); else out.push({ g, items: [i] }) }); return out }
  // 布草：所有品項次序可自訂（⚙設定 → 自訂卡片排序），全帳號共用
  const renderWith = fn => (cat === '布草'
    ? <Ordered okey="linen_items" items={list} idOf={i => i.id} labelOf={i => i.name || '（未命名）'}>{ord => fn(regroup(ord))}</Ordered>
    : fn(groups))

  async function save() {
    const e = sheet
    const row = { cat, grp: e.grp.trim(), name: e.name.trim(), size: e.size.trim(), qty: Number(e.qty) || 0, base_floor: e.base_floor === '' || e.base_floor == null ? null : Number(e.base_floor), init_qty: e.init_qty === '' || e.init_qty == null ? null : Number(e.init_qty), min_qty: Number(e.min_qty) || 0, location: e.location.trim(), notes: e.notes.trim(), attachments: e.attachments || [] }
    try {
      if (e.id) await api.dbUpdate('uni_items', e.id, row); else await api.dbInsert('uni_items', { ...row, sort_order: items.length + 1 })
      toast('已儲存'); setSheet(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function addFiles(files) {
    setUpBusy(true)
    try {
      const got = []
      for (const file of files) got.push(await api.uploadAttachment(file))
      setSheet(p => ({ ...p, attachments: [...(p.attachments || []), ...got] }))
    } catch (ex) { toast('上傳失敗：' + ex.message) }
    setUpBusy(false)
  }
  async function del() { try { await api.dbDelete('uni_items', sheet.id); toast('已刪除'); setSheet(null); load() } catch (ex) { toast(ex.message) } }
  async function adjust(i, d) {
    try { await api.dbUpdate('uni_items', i.id, { qty: Math.max(0, i.qty + d) }); load() } catch (ex) { toast(ex.message) }
  }
  const reportData = () => ({
    filterText: [cat, f.low ? '存量低' : ''].filter(Boolean).join('、'),
    cols: ['分類', '品項', '現有', '初次入貨', '一層基數', '全酒店基數', '最低存量', '位置', '備註'],
    groups: groups.map(g => ({ name: g.g, rows: g.items.map(i => ({ cells: [i.grp || '—', nm(i), i.qty, i.init_qty ?? '—', i.base_floor ?? '—', i.base_floor ? i.base_floor * FLOORS : '—', i.min_qty || '—', i.location || '—', i.notes || '—'], cls: low(i) ? { 2: 'rpt-red' } : undefined })) })),
  })

  return (
    <>
      <ToolBar label={`${cat} · ${all.length} 款 · 共 ${total} 件`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="fstk">
        <div className="df-grid3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
          <input className="search-inp" placeholder="搜尋品項／分類／位置" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          <button className={'chip' + (f.low ? ' on' : '')} onClick={() => setF({ ...f, low: !f.low })}>存量低（{lowN}）</button>
        </div>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {list.length === 0 && !err && <p className="src-note" style={{ margin: '14px 4px' }}>{all.length ? '冇符合嘅品項。' : '暫時未有品項。'}{edit && !all.length ? '撳右下角「＋」新增。' : ''}</p>}
      {renderWith(gs => gs.map(g => (
        <div key={g.g}>
          {hasGroups && <div className="bh-grp">{g.g}<span>{g.items.length}</span></div>}
          <div className="pa-grid pa-grid-an">
            {g.items.map(i => (
              <div className="pa-sq pa-an" key={i.id} role="button" tabIndex={0} onClick={() => edit ? setSheet({ ...i, attachments: i.attachments || [] }) : setView(i)}>
                <span className="pa-sq-top"><em>{i.location || '未設位置'}</em>{low(i) && <small className="pa-flag">存量低</small>}</span>
                <b className="pa-sq-name">{i.name || '（未命名）'}{i.size ? <small style={{ display: 'block', fontSize: '.62em', fontWeight: 500, opacity: .65, marginTop: 2 }}>{i.size}</small> : null}</b>
                <span className="pa-sq-post">
                  <span className={'st-qty' + (low(i) ? ' low' : '')}>{i.qty}<small> 件{i.min_qty ? ` ／ 最低 ${i.min_qty}` : ''}</small></span>
                  {i.base_floor ? <span className="pa-sq-area">{baseTxt(i)}</span> : null}
                  {(i.attachments || []).length > 0 && <span className="pa-sq-area">📎 {i.attachments.length} 個附件</span>}
                  {i.init_qty != null && <span className="pa-sq-area">初次入貨 {i.init_qty}</span>}
                  {i.notes && <span className="pa-sq-area">{i.notes}</span>}
                </span>
                {edit && (
                  <div className="uni-adj" onClick={e => e.stopPropagation()}>
                    <button className="mini" onClick={() => adjust(i, -1)}>－ 1</button>
                    <button className="mini" onClick={() => adjust(i, 1)}>＋ 1</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )))}
      {edit && <button className="fab" onClick={() => setSheet({ id: null, grp: '', name: '', size: '', qty: '', init_qty: '', base_floor: '', min_qty: '', location: '', notes: '', attachments: [] })}>＋</button>}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.id ? nm(sheet) : `新增${cat}品項`}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
            <div className="f-row"><label>品項名稱</label><input value={sheet.name} onChange={e => setSheet({ ...sheet, name: e.target.value })} placeholder={cat === '布草' ? '例：床單、洗被袋、大被袋' : cat === '物資' ? '例：布草大桶、熨斗、布草車' : '例：房務員上衣'} /></div>
            <div className="f-row"><label>分類</label>
              <input list="uni-grp" value={sheet.grp} onChange={e => setSheet({ ...sheet, grp: e.target.value })} placeholder="例：床上用品" />
              <datalist id="uni-grp">{[...new Set([...GRP_HINT[cat], ...all.map(i => i.grp).filter(Boolean)])].map(x => <option key={x} value={x} />)}</datalist></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="f-row" style={{ flex: '1 1 40%' }}><label>尺碼／規格</label><input value={sheet.size} onChange={e => setSheet({ ...sheet, size: e.target.value })} placeholder="S／M／L／大床" /></div>
              <div className="f-row" style={{ flex: '1 1 40%' }}><label>現有數量</label><input inputMode="numeric" value={sheet.qty} onChange={e => setSheet({ ...sheet, qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: '1 1 40%' }}><label>初次入貨數量</label><input inputMode="numeric" value={sheet.init_qty ?? ''} onChange={e => setSheet({ ...sheet, init_qty: e.target.value })} /></div>
              <div className="f-row" style={{ flex: '1 1 40%' }}><label>一層基數{sheet.base_floor ? `（${FLOORS} 層 = ${(Number(sheet.base_floor) * FLOORS).toLocaleString()}）` : ''}</label><input inputMode="numeric" value={sheet.base_floor ?? ''} onChange={e => setSheet({ ...sheet, base_floor: e.target.value })} /></div>
              <div className="f-row" style={{ flex: '1 1 40%' }}><label>最低存量</label><input inputMode="numeric" value={sheet.min_qty} onChange={e => setSheet({ ...sheet, min_qty: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>存放位置</label><input value={sheet.location} onChange={e => setSheet({ ...sheet, location: e.target.value })} /></div>
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
            <div className="f-row"><label>附件（舊資料、單據、相片、PDF／Excel 都得）</label>
              <AttList list={sheet.attachments || []} onDel={k => setSheet(p => ({ ...p, attachments: p.attachments.filter((_, n) => n !== k) }))} />
              <label className="btn ghost sm-quiet" style={{ display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>{upBusy ? '上傳緊…' : '＋ 加附件'}<input type="file" multiple hidden disabled={upBusy} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addFiles(fl) }} /></label>
            </div>
            {sheet.id && <button className="btn danger sm-quiet" onClick={del}>刪除這項</button>}
          </div>
        </div>
      )}
      {view && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{nm(view)}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setView(null)}>關閉</button></span></div>
            <p className="src-note">現有 {view.qty} 件{view.init_qty != null ? ` · 初次入貨 ${view.init_qty}` : ''}{view.min_qty ? ` · 最低 ${view.min_qty}` : ''}{view.location ? ` · ${view.location}` : ''}{view.notes ? ` · ${view.notes}` : ''}</p>
            {(view.attachments || []).length ? <AttList list={view.attachments} /> : <p className="src-note">未有附件。</p>}
          </div>
        </div>
      )}
      {report && <ReportModal title={`制服與布草管理 · ${cat}`} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}

// 附件清單：相片顯示縮圖（撳開大圖），其他檔案顯示檔名連結
function AttList({ list, onDel }) {
  if (!list.length) return null
  return (
    <div style={{ display: 'grid', gap: 8, margin: '6px 0' }}>
      {list.map((a, k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
            {a.type === 'image' ? <img src={a.url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flex: 'none' }} /> : <span style={{ fontSize: 28, flex: 'none' }}>📄</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || '附件'}</span>
          </a>
          {onDel && <button type="button" className="mini" onClick={() => onDel(k)}>移除</button>}
        </div>
      ))}
    </div>
  )
}
