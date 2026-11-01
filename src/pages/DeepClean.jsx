import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import Icon from '../components/Icon'
import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
import { ReportModal, ListReport } from '../components/Reports'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { useBack } from '../lib/nav'
import { itemLevel } from '../lib/accounts'
import Confirm from '../components/Confirm'

// 深度清潔記錄：先揀樓層（每層一張卡），再揀大清項目，最後睇每間房嘅完成日期（可按年份分開）
// 資料由各份 Excel 記錄表匯入。mode：grid ＝ 客房（每層 82 間）；list ＝ 只有部分房／區域有記錄
// only(f)：該樓層有幾多間房屬於這個項目（3 樓 38–82 號房冇地毯；3 樓唔打蠟）
// 有梳化床嘅房（每層 28 間：21 間標準大床房＋套房 02/33/77/79/81＋轉角房 37/69）
const SOFA = [1, 2, 3, 5, 6, 8, 11, 13, 18, 20, 30, 33, 35, 36, 37, 46, 48, 52, 63, 65, 66, 67, 68, 69, 75, 77, 79, 81]
const G = { floor: '地板與地毯', top: '天花與窗簾', bed: '床上用品', x: '其他' }
const ITEMS = [
  { id: 'carpet', g: 'floor', label: '地毯清洗', icon: 'drop', color: '#4a6fa5', mode: 'grid', only: f => (f === 3 ? 37 : 82) },
  { id: 'tilewash', g: 'floor', label: '磁磚清洗', icon: 'drop', color: '#2f8f9d', mode: 'grid' },
  { id: 'tilewax', g: 'floor', label: '磁磚打蠟', icon: 'star', color: '#8a6d3b', mode: 'grid', cycle: 2, only: f => (f === 3 ? 0 : 82) },
  { id: 'sofavac', g: 'floor', label: '沙發底地毯吸塵', icon: 'clean', color: '#b5603a', mode: 'grid', set: SOFA },   // 只有大床房同套房有梳化（每層 28 間）
  { id: 'deep', g: 'floor', label: '深層清潔（非機器）', icon: 'focus', color: '#1f7a6d', mode: 'grid' },
  { id: 'ceiling', g: 'top', label: '天花槽吸塵', icon: 'clean', color: '#54808c', mode: 'grid' },
  { id: 'curtain', g: 'top', label: '厚簾／窗簾清洗', icon: 'hotel', color: '#8f7ac9', mode: 'grid', cycle: 3 },
  { id: 'mattress', g: 'bed', label: '床褥前後反轉', icon: 'bed', color: '#3a8fb5', mode: 'grid' },
  { id: 'bedframe', g: 'bed', label: '抹床架', icon: 'bed', color: '#c0564f', mode: 'grid' },
  { id: 'quilt', g: 'bed', label: '被芯更換', icon: 'bed', color: '#d07a2c', mode: 'grid' },
  { id: 'pillowhard', g: 'bed', label: '硬枕芯更換', icon: 'bed', color: '#7a6a4f', mode: 'grid' },
  { id: 'pillowsoft', g: 'bed', label: '軟枕芯更換', icon: 'bed', color: '#5a8f6a', mode: 'grid' },
  { id: 'pillowinner', g: 'bed', label: '內枕袋更換', icon: 'bed', color: '#4a6fa5', mode: 'grid' },
  { id: 'balcony', g: 'x', label: '露台清洗', icon: 'sun', color: '#2f8f9d', mode: 'list' },
  { id: 'stain', g: 'x', label: '南翼地毯起漬', icon: 'drop', color: '#c0564f', mode: 'list' },
  { id: 'ninegrid', g: 'x', label: '九宮格清潔', icon: 'calendar', color: '#8a6d3b', mode: 'list' },
  { id: 'pubarea', g: 'x', label: '公共走廊', icon: 'people', color: '#8a6d3b', mode: 'list' },
]
const FLOORS = Array.from({ length: 10 }, (_, i) => i + 3)
const nOf = (it, f) => (it.set ? it.set.length : it.only ? it.only(f) : 82)
const ROOMS = (n, k, set) => (set ? set.map(x => String(n * 100 + x)) : Array.from({ length: k }, (_, i) => String(n * 100 + i + 1)))
const T = 'deep_clean_records'
const shortD = d => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '')
const longD = d => (d ? `${d.slice(0, 4)}-${d.slice(5, 7)}-${d.slice(8, 10)}` : '')
const YR = String(new Date().getFullYear())   // 今年先係工作年度；之前年份只作參考（自動跟年份更新）
// 圓環進度（中間顯示百分比）
function Ring({ pct, color = 'var(--accent)', size = 46 }) {
  const r = 18, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct))
  return (
    <span className="dcx-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" width={size} height={size}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="4.5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={p >= 100 ? '#2e9b6a' : color} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 22 22)" />
      </svg>
      <b style={{ fontSize: size > 52 ? 16 : 11.5 }}>{p >= 100 ? '✓' : Math.round(p) + '%'}</b>
    </span>
  )
}
const BASE = '2026-11-01'   // Excel 基準匯入日期
const LS = 'dc_rows_v2'
let cache = null   // 只讀一次，換頁返嚟唔使重新載入
try { const raw = localStorage.getItem(LS); if (raw) cache = JSON.parse(raw) } catch { /* 冇本機快取就照常載入 */ }

export default function DeepClean({ session }) {
  const lvl = itemLevel(session, 'deepclean')
  const canAdd = lvl === 'add' || lvl === 'edit', canEdit = lvl === 'edit'
  const [rows, setRows] = useState(cache)
  const [err, setErr] = useState('')
  const [fl, setFl] = useState(0)            // 0 ＝ 樓層卡；否則該樓層嘅項目
  const [item, setItem] = useState(null)     // 揀咗項目 ＝ 該層該項目嘅房間格
  const [yr, setYr] = useState(null)      // 入嚟先揀年份：今年（跟進）／過往年份（參考）
  const [pick, setPick] = useState(null)   // 批量登記：null ＝ 未開；否則 Set<房號>
  const [pickDate, setPickDate] = useState(todayStr())
  const [ord, setOrd] = useState([])           // 未完成項目嘅顯示次序（大家共用，存喺資料庫）
  const [sorting, setSorting] = useState(false)
  const [todo, setTodo] = useState(true)     // 只睇今年未做（預設）
  const [sheet, setSheet] = useState(null)   // { room }
  const [form, setForm] = useState(null)     // 新增記錄
  const [report, setReport] = useState(false)
  const [delRow, setDelRow] = useState(null)
  useBack(!!yr, () => { if (item) setItem(null); else if (fl) setFl(0); else setYr(null) })
  const load = () => api.dbSelectAll(T, 'id,item,room,floor,done_on,note,by_name,source,created_at').then(r => { cache = r; try { localStorage.setItem(LS, JSON.stringify(r)) } catch { /* 容量唔夠就唔存 */ } setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { load() }, [])
  useEffect(() => { api.dbSelect('deep_clean_prefs', { order: 'id' }).then(r => { const o = r.find(x => x.id === 'order'); if (o && Array.isArray(o.value)) setOrd(o.value) }).catch(() => {}) }, [])

  // item → floor → room → 記錄（新到舊）
  const idx = useMemo(() => {
    const m = {}
    for (const r of rows || []) {
      const a = m[r.item] || (m[r.item] = {}), b = a[r.floor] || (a[r.floor] = new Map())
      const e = b.get(r.room) || []
      e.push(r); b.set(r.room, e)
    }
    for (const a of Object.values(m)) for (const b of Object.values(a)) for (const e of b.values()) e.sort((p, q) => (q.done_on || '').localeCompare(p.done_on || ''))
    return m
  }, [rows])
  if (!rows) return <div className="note">載入中…</div>
  const lastSys = rows.reduce((a, r) => ((r.source || '').startsWith('系統登記') && (r.created_at || '') > a ? r.created_at : a), '')
  const asof = <p className="dcx-asof">資料更新日期：{BASE}（Excel 匯入）{lastSys ? ` · 系統最近登記：${lastSys.slice(0, 10)}` : ''}</p>
  if (!yr) {
    const ys = [YR, String(+YR - 1)]
    return (
      <>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        <div className="pa-grid dcx-g dcx-few">
          {ys.map(y => (
            <button className={'pa-sq dcx-card dcx-year' + (y === YR ? ' now' : '')} key={y} onClick={() => { setYr(y); setFl(0); setItem(null) }}>
              <span className="dcx-top"><span className="dcx-ico" style={{ background: y === YR ? 'var(--accent-soft)' : 'var(--bg)' }}><Icon name="calendar" size={24} color={y === YR ? 'var(--accent)' : 'var(--sub)'} width={2.2} /></span><em className={'dcx-pill' + (y === YR ? '' : ' mute')}>{y === YR ? '今年' : '參考'}</em></span>
              <b className="dcx-big">{y}</b>
              <span className="dcx-sub">{y === YR ? '跟進未做、登記完成' : '過往記錄'}</span>
            </button>
          ))}
        </div>
        {asof}
      </>
    )
  }

  const allOf = (it, f, room) => (idx[it.id] && idx[it.id][f] && idx[it.id][f].get(room)) || []
  const recsOf = (it, f, room) => allOf(it, f, room).filter(r => (r.done_on || '').startsWith(yr))
  const prevOf = (it, f, room) => allOf(it, f, room).find(r => r.done_on && r.done_on < yr + '-01-01')   // 今年之前最近一次（參考）
  const roomsOf = (it, f) => (it.mode === 'grid' ? ROOMS(f, nOf(it, f), it.set) : [...((idx[it.id] && idx[it.id][f]) || new Map()).keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  // 有週期嘅項目：週期內（例如 2 年一次＝去年）做過、而今年未做 → 今年跳過，唔計入未做
  const skipped = (it, f, room) => !!it.cycle && !recsOf(it, f, room).length && allOf(it, f, room).some(r => { const y = +(r.done_on || '').slice(0, 4); return y > +yr - it.cycle && y < +yr })
  const stat = (it, f) => {
    const rs = roomsOf(it, f).filter(r => !skipped(it, f, r)); let n = 0, last = ''
    for (const r of rs) { const e = recsOf(it, f, r); if (e.length) { n++; if (e[0].done_on && e[0].done_on > last) last = e[0].done_on } }
    return { n, t: rs.length, last }
  }
  const prevStat = (it, f) => { if (it.mode !== 'grid') return ''; const rs = roomsOf(it, f); const n = rs.filter(r => prevOf(it, f, r)).length; return n ? `${n}/${rs.length}` : '' }
  const itemsOf = f => ITEMS.filter(it => (it.mode === 'grid' ? nOf(it, f) > 0 : roomsOf(it, f).length > 0))

  // 該年未做：客房類項目，該層房數 − 該年有記錄房數
  const todoOf = f => itemsOf(f).filter(it => it.mode === 'grid').map(it => ({ it, ...stat(it, f) })).filter(x => x.n < x.t)

  // ── 樓層卡：今年邊層仲有幾多項未做 ──
  if (!fl) {
    const all = FLOORS.map(f => todoOf(f))
    const left = all.reduce((a, l) => a + l.reduce((p, x) => p + x.t - x.n, 0), 0)
    const allG = FLOORS.flatMap(fx => itemsOf(fx).filter(it => it.mode === 'grid').map(it => stat(it, fx))), allPct = allG.reduce((a, x) => a + x.n, 0) / Math.max(1, allG.reduce((a, x) => a + x.t, 0)) * 100
    return (
      <>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        <div className="dcx-hero">
          <Ring pct={allPct} size={68} />
          <span className="dcx-hero-t"><b>{left}</b><span>間次 {yr} 年未做</span><small>全部樓層 · {yr === YR ? '過往年份記錄只作參考' : '過往年份記錄（參考）'}</small></span>
        </div>
        <div className="pa-grid dcx-g">
          {FLOORS.map((fx, k) => {
            const l = all[k], n = l.reduce((p, x) => p + x.t - x.n, 0)
            const g = itemsOf(fx).filter(it => it.mode === 'grid').map(it => stat(it, fx)), dn = g.reduce((a, x) => a + x.n, 0), dt = g.reduce((a, x) => a + x.t, 0)
            return (
              <button className="pa-sq dcx-card" key={fx} onClick={() => { setFl(fx); setItem(null) }}>
                <span className="dcx-top"><b className="dcx-fl">{fx}<small>樓</small></b><Ring pct={dn / Math.max(1, dt) * 100} /></span>
                <span className="dcx-sub">{l.length ? `共 ${n} 間次未做` : '全部已完成'}</span>
                {l.length ? <em className="dcx-pill red">{l.length} 項未完成</em> : <em className="dcx-pill ok">✓ 全部完成</em>}
              </button>
            )
          })}
        </div>
        {asof}
        <div className="bh-grp">{yr} 年進度總覽<span>項目 × 樓層</span></div>
        <div className="dc-tw">
          <table className="dc-t">
            <thead><tr><th>項目</th>{FLOORS.map(f => <th key={f}>{f}F</th>)}<th>合計</th></tr></thead>
            <tbody>
              {ITEMS.filter(it => it.mode === 'grid').map(it => {
                const sts = FLOORS.map(f => (nOf(it, f) ? stat(it, f) : null))
                const n = sts.reduce((a, x) => a + (x ? x.n : 0), 0), t = sts.reduce((a, x) => a + (x ? x.t : 0), 0)
                return (
                  <tr key={it.id}>
                    <th>{it.label}</th>
                    {sts.map((x, k) => x
                      ? <td key={k} className={'dc-c ' + (x.n >= x.t ? 'full' : x.n ? 'part' : 'none')} onClick={() => { setFl(FLOORS[k]); setItem(it); setTodo(true) }}>{x.n >= x.t ? '✓' : Math.round(x.n / x.t * 100) + '%'}</td>
                      : <td key={k} className="dc-c na">—</td>)}
                    <td className="dc-tot"><b>{Math.round(n / Math.max(1, t) * 100)}%</b><small>{n}/{t}</small></td>
                  </tr>
                )
              })}
              <tr className="dc-sumrow">
                <th>整層</th>
                {FLOORS.map(f => { const g = itemsOf(f).filter(it => it.mode === 'grid').map(it => stat(it, f)); const n = g.reduce((a, x) => a + x.n, 0), t = g.reduce((a, x) => a + x.t, 0); return <td key={f} className="dc-c"><b>{Math.round(n / Math.max(1, t) * 100)}%</b></td> })}
                <td className="dc-tot" />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="src-note" style={{ margin: '6px 4px 0' }}>綠色＝全層完成，黃色＝做咗部分，紅色＝{yr} 年未開始；撳格仔直接睇該層該項目。</p>
      </>
    )
  }

  // ── 該層項目清單：未做嘅排最前，已完成嘅收埋 ──
  if (!item) {
    const rank = id => { const i = ord.indexOf(id); return i >= 0 ? i : 1000 + ITEMS.findIndex(x => x.id === id) }
    const open = todoOf(fl).sort((p, q) => rank(p.it.id) - rank(q.it.id))
    async function move(id, d) {   // 同相鄰嘅未完成項目交換位置，即時儲存
      const ids = open.map(x => x.it.id), i = ids.indexOf(id), j = i + d
      if (j < 0 || j >= ids.length) return
      const full = [...new Set([...ord.filter(x => ITEMS.some(y => y.id === x)), ...ITEMS.map(x => x.id)])]
      const a = full.indexOf(ids[i]), b = full.indexOf(ids[j]);[full[a], full[b]] = [full[b], full[a]]
      setOrd(full)
      try { await api.dbUpdate('deep_clean_prefs', 'order', { value: full, updated_at: new Date().toISOString() }) } catch (ex) { toast('儲存次序失敗：' + ex.message) }
    }
    const fin = itemsOf(fl).filter(it => it.mode === 'grid' && !open.some(x => x.it.id === it.id))
    const oth = itemsOf(fl).filter(it => it.mode === 'list')
    const skipN = it => roomsOf(it, fl).filter(r => skipped(it, fl, r)).length
    const row = (it, st, k) => {
      const mv = sorting && k === 'open', Tag = mv ? 'div' : 'button'
      return (
      <Tag className={'pa-sq dcx-card' + (mv ? ' mv' : '')} key={it.id} onClick={mv ? undefined : () => { setItem(it); setTodo(it.mode === 'grid') }}>
        <span className="dcx-top">
          <span className="dcx-ico" style={{ background: it.color + '26' }}><Icon name={it.icon} size={24} color={it.color} width={2.2} /></span>
          {k !== 'oth' && <Ring pct={st.n / Math.max(1, st.t) * 100} color={it.color} />}
        </span>
        <b className="dcx-name">{it.label}</b>
        <span className="dcx-sub">{k === 'oth' ? `${st.t} 項記錄` : `${yr} 年 ${st.n}/${st.t}${it.cycle ? ` · 每 ${it.cycle} 年一次${skipN(it) ? `（跳過 ${skipN(it)}）` : ''}` : prevStat(it, fl) ? ` · 之前 ${prevStat(it, fl)}` : ''}`}</span>
        {mv ? <span className="dcx-mv"><button onClick={() => move(it.id, -1)} aria-label="前移">‹ 前</button><button onClick={() => move(it.id, 1)} aria-label="後移">後 ›</button></span>
          : k === 'open' ? <em className="dcx-pill red">未做 {st.t - st.n}</em> : k === 'fin' ? <em className="dcx-pill ok">✓ 已完成</em> : <em className="dcx-pill mute">查看</em>}
      </Tag>
    )}
    return (
      <>
        {asof}
        <ToolBar sticky label={`${fl} 樓`} />
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {open.length ? <div className="pa-grid dcx-g"><div className="dcx-hd"><b>{yr} 年未完成<span>{open.length}</span></b>{canEdit && open.length > 1 && <button className={'dcx-sort' + (sorting ? ' on' : '')} onClick={() => setSorting(!sorting)}>{sorting ? '✓ 完成排序' : '↕ 調整次序'}</button>}</div>{sorting && <p className="dcx-hint">撳卡片下面嘅「前／後」調整次序，大家都會見到呢個次序。</p>}{open.map(x => row(x.it, x, 'open'))}</div> : <p className="src-note" style={{ margin: '8px 4px 14px' }}>{yr} 年全部項目都完成 👍</p>}
        {oth.length > 0 && <div className="pa-grid dcx-g"><div className="dcx-hd"><b>其他記錄</b></div>{oth.map(it => row(it, stat(it, fl), 'oth'))}</div>}
        {fin.length > 0 && <div className="pa-grid dcx-g"><div className="dcx-hd"><b>已完成<span>{fin.length}</span></b></div>{fin.map(it => row(it, stat(it, fl), 'fin'))}</div>}
      </>
    )
  }

  // ── 該層該項目：房間格 ──
  const grid = item.mode === 'grid'
  const st = stat(item, fl)
  const list = roomsOf(item, fl).filter(r => !todo || (!recsOf(item, fl, r).length && !skipped(item, fl, r)))
  const reportData = () => ({
    filterText: [`${fl} 樓`, item.label, yr + ' 年', todo ? '未做' : ''].filter(Boolean).join('、'),
    cols: ['房號／區域', yr + ' 年完成日期', '上次（參考）'],
    groups: [{ name: `${fl} 樓 · ${item.label}`, rows: list.map(r => { const e = recsOf(item, fl, r), p = prevOf(item, fl, r); return { cells: [r, e.length ? (longD(e[0].done_on) || e[0].note || '有記錄') : '未做', p ? longD(p.done_on) : '—'] } }) }],
  })
  async function save() {
    if (!form.date && !form.note.trim()) return toast('請填日期或備註')
    try {
      await api.dbInsert(T, { item: item.id, room: sheet.room, floor: fl, done_on: form.date || null, note: form.note.trim(), by_name: form.by.trim(), source: '系統登記' })
      toast('已新增'); setForm(null); await load()
    } catch (ex) { toast(/duplicate|unique/i.test(ex.message) ? '同一日已經有記錄' : '儲存失敗：' + ex.message) }
  }
  async function remove(r) { try { await api.dbDelete(T, r.id); toast('已刪除'); setDelRow(null); await load() } catch (ex) { toast(ex.message) } }
  const close = () => { setSheet(null); setForm(null) }
  async function quick(date) {   // 一撳記錄完成（預設今日）
    try { await api.dbInsert(T, { item: item.id, room: sheet.room, floor: fl, done_on: date, note: '', by_name: '', source: '系統登記' }); toast('已記錄 ' + sheet.room + ' 完成'); close(); await load() }
    catch (ex) { toast(/duplicate|unique/i.test(ex.message) ? '同一日已經有記錄' : '儲存失敗：' + ex.message) }
  }
  async function batch() {
    const rooms = [...pick]; if (!rooms.length) return toast('未揀房間')
    try { await api.dbInsertMany(T, rooms.map(r => ({ item: item.id, room: r, floor: fl, done_on: pickDate, note: '', by_name: '', source: '系統登記（批量）' }))); toast('已記錄 ' + rooms.length + ' 間完成'); setPick(null); await load() }
    catch (ex) { toast(/duplicate|unique/i.test(ex.message) ? '其中有房間同一日已經有記錄' : '儲存失敗：' + ex.message) }
  }
  const sheetRecs = sheet ? ((idx[item.id] && idx[item.id][fl] && idx[item.id][fl].get(sheet.room)) || []) : []   // 彈窗睇晒所有年份

  return (
    <>
      <ToolBar sticky label={`${fl} 樓 · ${item.label}${grid ? ` · ${yr} 年 ${st.n}/${st.t}` : ''}`}><ExportBtn onClick={() => setReport(true)} />{canAdd && grid && yr === YR && <ToolBtn onClick={() => { setPick(pick ? null : new Set()); setTodo(true) }}>{pick ? '取消批量' : '批量登記'}</ToolBtn>}</ToolBar>
      {grid && <div className="fstk"><div className="dc-yrs" style={{ margin: 0 }}>
        <button className={todo ? 'on' : ''} onClick={() => setTodo(true)}>{yr} 年未做 {st.t - st.n}</button><button className={!todo ? 'on' : ''} onClick={() => setTodo(false)}>全部房</button>
      </div></div>}
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {item.cycle && <p className="src-note" style={{ margin: '0 4px 8px' }}>{item.label}每 {item.cycle} 年做一次：{+yr - item.cycle + 1} 至 {+yr - 1} 年做過嘅房，{yr} 年會自動跳過。</p>}
      {!list.length && <p className="src-note" style={{ margin: '14px 4px' }}>{todo ? `${yr} 年全部房都做完 👍` : '暫時未有記錄。'}</p>}
      {pick && <p className="src-note" style={{ margin: '4px 4px 8px' }}>撳未做嘅房間揀選，再喺下面揀日期登記完成。</p>}
      <div className={'dc-grid' + (grid ? '' : ' wide')} style={pick ? { paddingBottom: 70 } : undefined}>
        {list.map(r => {
          const l = recsOf(item, fl, r)[0], p = !l && prevOf(item, fl, r), on = pick && pick.has(r), sk = !l && skipped(item, fl, r)
          return (
            <button key={r} className={'dc-tile' + (l ? (l.done_on ? ' ok' : ' nt') : sk ? ' skip' : '') + (on ? ' sel' : '')} onClick={() => { if (pick && sk) return; if (pick && !l) { const n = new Set(pick); n.has(r) ? n.delete(r) : n.add(r); setPick(n) } else if (!pick) setSheet({ room: r }) }}>
              <b>{r}</b>
              <span>{l ? (shortD(l.done_on) || '備註') : sk ? '跳過' : on ? '✓' : '未做'}</span>
              {l && l.done_on && <small>{l.done_on.slice(0, 4)}</small>}
              {p && <small className="dc-prev">上次 {p.done_on.slice(2, 4)}/{+p.done_on.slice(5, 7)}</small>}
            </button>
          )
        })}
      </div>
      {pick && (
        <div className="dc-batch">
          <input type="date" value={pickDate} onChange={ev => setPickDate(ev.target.value)} />
          <button className="btn" onClick={batch}>登記 {pick.size} 間完成</button>
        </div>
      )}
      {sheet && (
        <div className="modal" onClick={ev => { if (ev.target === ev.currentTarget) close() }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{sheet.room} · {item.label}</h2><span className="sheet-hd-acts"><button className="mini" onClick={close}>關閉</button>{form && <button className="mini pri" onClick={save}>儲存</button>}</span></div>
            {form ? (
              <>
                <div className="f-row"><label>完成日期</label><input type="date" value={form.date} onChange={ev => setForm({ ...form, date: ev.target.value })} /></div>
                <div className="f-row"><label>執行人（可不填）</label><input value={form.by} onChange={ev => setForm({ ...form, by: ev.target.value })} /></div>
                <div className="f-row"><label>備註（可不填）</label><input value={form.note} onChange={ev => setForm({ ...form, note: ev.target.value })} /></div>
              </>
            ) : (
              <>
                {canAdd && yr === YR && !recsOf(item, fl, sheet.room).length && grid && <button className="btn" style={{ marginBottom: 8 }} onClick={() => quick(todayStr())}>✓ 今日完成（{yr} 年未做）</button>}
                {!sheetRecs.length && <p className="src-note" style={{ margin: '10px 2px' }}>未有記錄。</p>}
                {[...new Set(sheetRecs.map(r => (r.done_on || '').slice(0, 4)))].sort().reverse().map(y => {
                  const rs = sheetRecs.filter(r => (r.done_on || '').slice(0, 4) === y)
                  if (!rs.length) return null
                  return (
                    <div key={y || 'o'}>
                      <div className="bh-grp">{y ? y + (y === yr ? ' 年（今年）' : ' 年（參考）') : '其他'}</div>
                      {rs.map(r => (
                        <div className="dc-rec" key={r.id}>
                          <b>{longD(r.done_on) || '（未有日期）'}</b>
                          <span>{[r.by_name, r.note].filter(Boolean).join(' · ')}</span>
                          {canEdit && <button className="mini" onClick={() => setDelRow(r)}>刪除</button>}
                        </div>
                      ))}
                    </div>
                  )
                })}
                {canAdd && <button className="mini-btn" style={{ marginTop: 12, width: '100%' }} onClick={() => setForm({ date: yr === YR ? todayStr() : yr + '-01-01', by: '', note: '' })}>其他日期／加執行人或備註</button>}
              </>
            )}
          </div>
        </div>
      )}
      {delRow && <Confirm confirmLabel="刪除" text={`會刪除 ${delRow.room} 嘅 ${longD(delRow.done_on) || '備註'} 記錄。`} onConfirm={() => remove(delRow)} onCancel={() => setDelRow(null)} />}
      {report && <ReportModal title={`深度清潔記錄 · ${fl} 樓 ${item.label}`} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
