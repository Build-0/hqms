import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import Icon from '../components/Icon'
import { ToolBar, ExportBtn } from '../components/ui'
import { ReportModal, ListReport } from '../components/Reports'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { useBack } from '../lib/nav'
import { itemLevel } from '../lib/accounts'
import Confirm from '../components/Confirm'

// 深度清潔記錄：先揀樓層（每層一張卡），再揀大清項目，最後睇每間房嘅完成日期（可按年份分開）
// 資料由各份 Excel 記錄表匯入。mode：grid ＝ 客房（每層 82 間）；list ＝ 只有部分房／區域有記錄
// only(f)：該樓層有幾多間房屬於這個項目（3 樓 38–82 號房冇地毯；3 樓唔打蠟）
const G = { floor: '地板與地毯', top: '天花與窗簾', bed: '床上用品', x: '其他' }
const ITEMS = [
  { id: 'carpet', g: 'floor', label: '地毯清洗', icon: 'drop', color: '#4a6fa5', mode: 'grid', only: f => (f === 3 ? 37 : 82) },
  { id: 'tilewash', g: 'floor', label: '磁磚清洗', icon: 'drop', color: '#2f8f9d', mode: 'grid' },
  { id: 'tilewax', g: 'floor', label: '磁磚打蠟', icon: 'star', color: '#8a6d3b', mode: 'grid', only: f => (f === 3 ? 0 : 82) },
  { id: 'sofavac', g: 'floor', label: '沙發底地毯吸塵', icon: 'clean', color: '#b5603a', mode: 'grid' },
  { id: 'deep', g: 'floor', label: '深層清潔（非機器）', icon: 'focus', color: '#1f7a6d', mode: 'grid' },
  { id: 'ceiling', g: 'top', label: '天花槽吸塵', icon: 'clean', color: '#54808c', mode: 'grid' },
  { id: 'curtain', g: 'top', label: '厚簾／窗簾清洗', icon: 'hotel', color: '#8f7ac9', mode: 'grid' },
  { id: 'mattress', g: 'bed', label: '床褥前後反轉', icon: 'bed', color: '#3a8fb5', mode: 'grid' },
  { id: 'bedframe', g: 'bed', label: '床架防霉清潔', icon: 'bed', color: '#c0564f', mode: 'grid' },
  { id: 'quilt', g: 'bed', label: '被芯更換', icon: 'bed', color: '#d07a2c', mode: 'grid' },
  { id: 'pillowhard', g: 'bed', label: '硬枕芯更換', icon: 'bed', color: '#7a6a4f', mode: 'grid' },
  { id: 'pillowsoft', g: 'bed', label: '軟枕芯更換', icon: 'bed', color: '#5a8f6a', mode: 'grid' },
  { id: 'pillowinner', g: 'bed', label: '內枕袋更換', icon: 'bed', color: '#4a6fa5', mode: 'grid' },
  { id: 'balcony', g: 'x', label: '露台清洗', icon: 'sun', color: '#2f8f9d', mode: 'list' },
  { id: 'stain', g: 'x', label: '南翼地毯起漬', icon: 'drop', color: '#c0564f', mode: 'list' },
  { id: 'ninegrid', g: 'x', label: '九宮格清潔', icon: 'calendar', color: '#8a6d3b', mode: 'list' },
  { id: 'fog', g: 'x', label: '天花滅蟲焗霧', icon: 'search', color: '#54808c', mode: 'list' },
  { id: 'pubarea', g: 'x', label: '公共走廊', icon: 'people', color: '#8a6d3b', mode: 'list' },
]
const FLOORS = Array.from({ length: 10 }, (_, i) => i + 3)
const nOf = (it, f) => (it.only ? it.only(f) : 82)
const ROOMS = (n, k) => Array.from({ length: k }, (_, i) => String(n * 100 + i + 1))
const T = 'deep_clean_records'
const shortD = d => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '')
const longD = d => (d ? `${d.slice(0, 4)}-${d.slice(5, 7)}-${d.slice(8, 10)}` : '')
const YEARS = ['2025', '2026']
let cache = null   // 只讀一次，換頁返嚟唔使重新載入

export default function DeepClean({ session }) {
  const lvl = itemLevel(session, 'deepclean')
  const canAdd = lvl === 'add' || lvl === 'edit', canEdit = lvl === 'edit'
  const [rows, setRows] = useState(cache)
  const [err, setErr] = useState('')
  const [fl, setFl] = useState(0)            // 0 ＝ 樓層卡；否則該樓層嘅項目
  const [item, setItem] = useState(null)     // 揀咗項目 ＝ 該層該項目嘅房間格
  const [yr, setYr] = useState('')           // '' ＝ 全部年份
  const [todo, setTodo] = useState(false)    // 只睇未有記錄
  const [sheet, setSheet] = useState(null)   // { room }
  const [form, setForm] = useState(null)     // 新增記錄
  const [report, setReport] = useState(false)
  const [delRow, setDelRow] = useState(null)
  useBack(!!fl, () => { if (item) { setItem(null); setTodo(false) } else setFl(0) })
  const load = () => api.dbSelectAll(T, 'id,item,room,floor,done_on,note,by_name').then(r => { cache = r; setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { load() }, [])

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

  const inYr = r => !yr || (r.done_on || '').startsWith(yr)
  const recsOf = (it, f, room) => ((idx[it.id] && idx[it.id][f] && idx[it.id][f].get(room)) || []).filter(inYr)
  const roomsOf = (it, f) => (it.mode === 'grid' ? ROOMS(f, nOf(it, f)) : [...((idx[it.id] && idx[it.id][f]) || new Map()).keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  const stat = (it, f) => {
    const rs = roomsOf(it, f); let n = 0, last = ''
    for (const r of rs) { const e = recsOf(it, f, r); if (e.length) { n++; if (e[0].done_on && e[0].done_on > last) last = e[0].done_on } }
    return { n, t: rs.length, last }
  }
  const itemsOf = f => ITEMS.filter(it => (it.mode === 'grid' ? nOf(it, f) > 0 : roomsOf(it, f).length > 0))

  // ── 樓層卡 ──
  if (!fl) {
    return (
      <>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        <div className="dc-flgrid">
          {FLOORS.map(f => {
            const its = itemsOf(f), gs = its.filter(it => it.mode === 'grid')
            const done = gs.reduce((a, it) => a + stat(it, f).n, 0), tot = gs.reduce((a, it) => a + stat(it, f).t, 0)
            return (
              <button className="dc-flc" key={f} onClick={() => { setFl(f); setItem(null) }}>
                <b>{f}<small>樓</small></b>
                <span>{its.length} 個大清項目</span>
                <span className="dc-bar"><i style={{ width: Math.round(done / Math.max(1, tot) * 100) + '%' }} /></span>
              </button>
            )
          })}
        </div>
        <p className="src-note" style={{ margin: '4px 4px 0' }}>揀樓層，再揀大清項目；每間房記錄完成日期，可按 2025／2026 年分開睇。</p>
      </>
    )
  }

  const Years = () => (
    <div className="fstk"><div className="dc-chips">
      <button className={'chip' + (!yr ? ' on' : '')} onClick={() => setYr('')}>全部年份</button>
      {YEARS.map(y => <button key={y} className={'chip' + (yr === y ? ' on' : '')} onClick={() => setYr(y)}>{y} 年</button>)}
      {item && item.mode === 'grid' && <button className={'chip' + (todo ? ' on' : '')} onClick={() => setTodo(!todo)}>未有記錄（{stat(item, fl).t - stat(item, fl).n}）</button>}
    </div></div>
  )

  // ── 該層項目清單 ──
  if (!item) {
    return (
      <>
        <ToolBar sticky label={`${fl} 樓 · 深度清潔`} />
        <Years />
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {Object.entries(G).map(([g, gl]) => {
          const its = itemsOf(fl).filter(it => it.g === g)
          if (!its.length) return null
          return (
            <div key={g}>
              <div className="bh-grp">{gl}</div>
              <div className="dc-menu">
                {its.map(it => {
                  const st = stat(it, fl)
                  return (
                    <button className="dc-item" key={it.id} onClick={() => { setItem(it); setTodo(false) }}>
                      <span className="dc-ico" style={{ background: it.color + '26' }}><Icon name={it.icon} size={22} color={it.color} width={2.2} /></span>
                      <span className="dc-txt"><b>{it.label}</b><small>{it.mode === 'grid' ? `${st.n} / ${st.t} 房` : `${st.t} 項`}{st.last ? ` · 最近 ${yr ? shortD(st.last) : longD(st.last)}` : ''}</small></span>
                      <span className="dc-go">›</span>
                      {it.mode === 'grid' && <span className="dc-bar"><i style={{ width: Math.round(st.n / Math.max(1, st.t) * 100) + '%', background: it.color }} /></span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  // ── 該層該項目：房間格 ──
  const grid = item.mode === 'grid'
  const st = stat(item, fl)
  const list = roomsOf(item, fl).filter(r => !todo || !recsOf(item, fl, r).length)
  const reportData = () => ({
    filterText: [`${fl} 樓`, item.label, yr ? yr + ' 年' : '全部年份', todo ? '未有記錄' : ''].filter(Boolean).join('、'),
    cols: ['房號／區域', '最近日期', '次數', '全部日期'],
    groups: [{ name: `${fl} 樓 · ${item.label}`, rows: list.map(r => { const e = recsOf(item, fl, r); return { cells: [r, e.length ? (longD(e[0].done_on) || e[0].note || '有記錄') : '未有', e.length, e.length ? e.map(z => longD(z.done_on) || z.note).join('、') : '—'] } }) }],
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
  const sheetRecs = sheet ? ((idx[item.id] && idx[item.id][fl] && idx[item.id][fl].get(sheet.room)) || []) : []   // 彈窗睇晒所有年份

  return (
    <>
      <ToolBar sticky label={`${fl} 樓 · ${item.label}${grid ? ` · ${st.n} / ${st.t}` : ''}`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <Years />
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {!list.length && <p className="src-note" style={{ margin: '14px 4px' }}>{todo ? '全部都有記錄 👍' : '暫時未有記錄。'}</p>}
      <div className={'dc-grid' + (grid ? '' : ' wide')}>
        {list.map(r => {
          const l = recsOf(item, fl, r)[0]
          return (
            <button key={r} className={'dc-tile' + (l ? (l.done_on ? ' ok' : ' nt') : '')} onClick={() => setSheet({ room: r })}>
              <b>{r}</b>
              <span>{l ? (shortD(l.done_on) || '備註') : '—'}</span>
              {l && l.done_on && <small>{l.done_on.slice(0, 4)}</small>}
            </button>
          )
        })}
      </div>
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
                {!sheetRecs.length && <p className="src-note" style={{ margin: '10px 2px' }}>未有記錄。</p>}
                {YEARS.concat(['']).map(y => {
                  const rs = sheetRecs.filter(r => (y ? (r.done_on || '').startsWith(y) : !r.done_on || !YEARS.includes((r.done_on || '').slice(0, 4))))
                  if (!rs.length) return null
                  return (
                    <div key={y || 'o'}>
                      <div className="bh-grp">{y ? y + ' 年' : '其他'}</div>
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
                {canAdd && <button className="btn" style={{ marginTop: 12 }} onClick={() => setForm({ date: todayStr(), by: '', note: '' })}>＋ 新增完成記錄</button>}
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
