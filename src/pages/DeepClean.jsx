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

// 深度清潔記錄：每個項目 × 每間房嘅完成日期（由各份 Excel 記錄表匯入）
// mode：grid ＝ 客房（每層 82 間）；list ＝ 只有部分房／區域有記錄
// only(f)：該樓層有幾多間房屬於這個項目（3 樓 38–82 號房冇地毯；3 樓唔打蠟）
const G = { floor: '地板與地毯', top: '天花與窗簾', bed: '床上用品', x3: '3 樓專項與其他' }
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
  { id: 'balcony', g: 'x3', label: '3 樓露台清洗', icon: 'sun', color: '#2f8f9d', mode: 'list' },
  { id: 'stain', g: 'x3', label: '3 樓南翼地毯起漬', icon: 'drop', color: '#c0564f', mode: 'list' },
  { id: 'ninegrid', g: 'x3', label: '3 樓九宮格清潔', icon: 'calendar', color: '#8a6d3b', mode: 'list' },
  { id: 'fog', g: 'x3', label: '天花滅蟲焗霧', icon: 'search', color: '#54808c', mode: 'list' },
  { id: 'pubarea', g: 'x3', label: '樓層公共走廊', icon: 'people', color: '#8a6d3b', mode: 'list' },
]
const FLOORS = Array.from({ length: 10 }, (_, i) => i + 3)
const nOf = (it, f) => (it.only ? it.only(f) : 82)
const totalOf = it => FLOORS.reduce((a, f) => a + nOf(it, f), 0)
const ROOMS = (n, k) => Array.from({ length: k }, (_, i) => String(n * 100 + i + 1))
const T = 'deep_clean_records'
const shortD = d => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '')
const longD = d => (d ? `${d.slice(0, 4)}-${d.slice(5, 7)}-${d.slice(8, 10)}` : '')
let cache = null   // 只讀一次，換頁返嚟唔使重新載入

export default function DeepClean({ session }) {
  const lvl = itemLevel(session, 'deepclean')
  const canAdd = lvl === 'add' || lvl === 'edit', canEdit = lvl === 'edit'
  const [rows, setRows] = useState(cache)
  const [err, setErr] = useState('')
  const [item, setItem] = useState(null)
  const [fl, setFl] = useState(0)            // 0 ＝ 樓層摘要；否則該樓層房間格
  const [todo, setTodo] = useState(false)    // 只睇未有記錄
  const [sheet, setSheet] = useState(null)   // { room, floor }
  const [form, setForm] = useState(null)     // 新增記錄
  const [report, setReport] = useState(false)
  const [delRow, setDelRow] = useState(null)
  useBack(!!item, () => { if (fl) { setFl(0); setTodo(false) } else setItem(null) })
  const load = () => api.dbSelectAll(T, 'id,item,room,floor,done_on,note,by_name').then(r => { cache = r; setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { load() }, [])

  const byItem = useMemo(() => {
    const m = {}
    for (const r of rows || []) {
      const x = m[r.item] || (m[r.item] = { rooms: new Map(), last: '' })
      const e = x.rooms.get(r.room) || { room: r.room, floor: r.floor, recs: [] }
      e.recs.push(r); x.rooms.set(r.room, e)
      if (r.done_on && r.done_on > x.last) x.last = r.done_on
    }
    for (const x of Object.values(m)) for (const e of x.rooms.values()) e.recs.sort((a, b) => (b.done_on || '').localeCompare(a.done_on || ''))
    return m
  }, [rows])
  if (!rows) return <div className="note">載入中…</div>

  if (!item) {
    return (
      <>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {Object.entries(G).map(([g, gl]) => (
          <div key={g}>
            <div className="bh-grp">{gl}</div>
            <div className="dc-menu">
              {ITEMS.filter(it => it.g === g).map(it => {
                const x = byItem[it.id]
                const t = it.mode === 'grid' ? totalOf(it) : 0
                const n = x ? x.rooms.size : 0
                return (
                  <button className="dc-item" key={it.id} onClick={() => { setItem(it); setFl(0); setTodo(false) }}>
                    <span className="dc-ico" style={{ background: it.color + '26' }}><Icon name={it.icon} size={22} color={it.color} width={2.2} /></span>
                    <span className="dc-txt"><b>{it.label}</b><small>{it.mode === 'grid' ? `${n} / ${t} 房` : `${n} 項`}{x && x.last ? ` · 最近 ${longD(x.last)}` : ''}</small></span>
                    <span className="dc-go">›</span>
                    {t > 0 && <span className="dc-bar"><i style={{ width: Math.min(100, Math.round(n / t * 100)) + '%', background: it.color }} /></span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </>
    )
  }

  const x = byItem[item.id] || { rooms: new Map(), last: '' }
  const grid = item.mode === 'grid'
  const floors = (fl ? [fl] : FLOORS).filter(f => !grid || nOf(item, f) > 0)
  const roomList = f => (grid ? ROOMS(f, nOf(item, f)) : [...x.rooms.values()].filter(e => e.floor === f).map(e => e.room).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  const lastOf = room => (x.rooms.get(room) || { recs: [] }).recs[0]
  const total = grid ? totalOf(item) : 0
  const doneN = grid ? FLOORS.reduce((a, f) => a + roomList(f).filter(r => x.rooms.has(r)).length, 0) : x.rooms.size
  const floorStat = f => {
    const rs = roomList(f), have = rs.filter(r => x.rooms.has(r))
    const last = have.reduce((a, r) => { const d = x.rooms.get(r).recs[0].done_on || ''; return d > a ? d : a }, '')
    return { n: have.length, t: rs.length, last }
  }

  async function save() {
    if (!form.date && !form.note.trim()) return toast('請填日期或備註')
    try {
      const row = { item: item.id, room: sheet.room, floor: sheet.floor, done_on: form.date || null, note: form.note.trim(), by_name: form.by.trim(), source: '系統登記' }
      await api.dbInsert(T, row); toast('已新增'); setForm(null); await load()
    } catch (ex) { toast(/duplicate|unique/i.test(ex.message) ? '同一日已經有記錄' : '儲存失敗：' + ex.message) }
  }
  async function remove(r) { try { await api.dbDelete(T, r.id); toast('已刪除'); setDelRow(null); await load() } catch (ex) { toast(ex.message) } }

  const reportData = () => ({
    filterText: [item.label, fl ? fl + ' 樓' : '全部樓層', todo ? '未有記錄' : ''].filter(Boolean).join('、'),
    cols: ['房號／區域', '最近日期', '次數', '全部日期'],
    groups: floors.map(f => ({
      name: f + ' 樓',
      rows: roomList(f).filter(r => !todo || !x.rooms.has(r)).map(r => { const e = x.rooms.get(r); return { cells: [r, e ? (longD(e.recs[0].done_on) || e.recs[0].note || '有記錄') : '未有', e ? e.recs.length : 0, e ? e.recs.map(z => longD(z.done_on) || z.note).join('、') : '—'] } }),
    })).filter(g => g.rows.length),
  })

  return (
    <>
      <ToolBar sticky label={`${item.label}${fl ? ` · ${fl} 樓` : ''}`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {!fl ? (
        <>
          <div className="dc-sum">
            <b>{grid ? `${doneN} / ${total}` : x.rooms.size}</b><span>{grid ? '房已有記錄' : '項記錄'}{x.last ? ` · 最近一次 ${longD(x.last)}` : ''}</span>
            {grid && <div className="dc-bar big"><i style={{ width: Math.min(100, Math.round(doneN / Math.max(1, total) * 100)) + '%', background: item.color }} /></div>}
          </div>
          {floors.map(f => {
            const st = floorStat(f)
            if (!grid && !st.t) return null
            return (
              <button className="dc-fl" key={f} onClick={() => { setFl(f); setTodo(false) }}>
                <b>{f} 樓</b>
                <span className="dc-fl-n">{grid ? `${st.n} / ${st.t} 房` : `${st.t} 項`}{st.last ? ` · 最近 ${shortD(st.last)}` : ''}</span>
                <span className="dc-go">›</span>
                {grid && <span className="dc-bar"><i style={{ width: Math.round(st.n / Math.max(1, st.t) * 100) + '%', background: item.color }} /></span>}
              </button>
            )
          })}
          {!grid && x.rooms.size === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有記錄。</p>}
        </>
      ) : (
        <>
          {grid && <div className="fstk"><div className="dc-chips"><button className={'chip' + (todo ? ' on' : '')} onClick={() => setTodo(!todo)}>只睇未有記錄（{floorStat(fl).t - floorStat(fl).n}）</button></div></div>}
          {floors.map(f => {
            const list = roomList(f).filter(r => !todo || !x.rooms.has(r))
            if (!list.length) return <p className="src-note" key={f} style={{ margin: '14px 4px' }}>全部都有記錄 👍</p>
            return (
              <div className={'dc-grid' + (grid ? '' : ' wide')} key={f}>
                {list.map(r => {
                  const l = lastOf(r)
                  return (
                    <button key={r} className={'dc-tile' + (l ? (l.done_on ? ' ok' : ' nt') : '')} onClick={() => setSheet({ room: r, floor: f })}>
                      <b>{r}</b>
                      <span>{l ? (shortD(l.done_on) || '備註') : '—'}</span>
                      {l && l.done_on && <small>{l.done_on.slice(0, 4)}</small>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
      {sheet && (() => {
        const e = x.rooms.get(sheet.room)
        const close = () => { setSheet(null); setForm(null) }
        return (
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
                  {(!e || !e.recs.length) && <p className="src-note" style={{ margin: '10px 2px' }}>未有記錄。</p>}
                  {e && e.recs.map(r => (
                    <div className="dc-rec" key={r.id}>
                      <b>{longD(r.done_on) || '（未有日期）'}</b>
                      <span>{[r.by_name, r.note].filter(Boolean).join(' · ')}</span>
                      {canEdit && <button className="mini" onClick={() => setDelRow(r)}>刪除</button>}
                    </div>
                  ))}
                  {canAdd && <button className="btn" style={{ marginTop: 12 }} onClick={() => setForm({ date: todayStr(), by: '', note: '' })}>＋ 新增完成記錄</button>}
                </>
              )}
            </div>
          </div>
        )
      })()}
      {delRow && <Confirm confirmLabel="刪除" text={`會刪除 ${delRow.room} 嘅 ${longD(delRow.done_on) || '備註'} 記錄。`} onConfirm={() => remove(delRow)} onCancel={() => setDelRow(null)} />}
      {report && <ReportModal title={`深度清潔記錄 · ${item.label}`} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}
