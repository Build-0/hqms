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
// mode：grid ＝ 全部客房（3–12 樓各 82 間）；list ＝ 只有部分房／區域有記錄
const ITEMS = [
  { id: 'carpet', label: '地毯清洗', icon: 'drop', color: '#4a6fa5', mode: 'grid' },
  { id: 'tilewash', label: '磁磚清洗', icon: 'drop', color: '#2f8f9d', mode: 'grid' },
  { id: 'tilewax', label: '磁磚打蠟', icon: 'star', color: '#8a6d3b', mode: 'grid' },
  { id: 'ceiling', label: '天花槽吸塵', icon: 'clean', color: '#54808c', mode: 'grid' },
  { id: 'curtain', label: '厚簾／窗簾清洗', icon: 'hotel', color: '#8f7ac9', mode: 'grid' },
  { id: 'sofavac', label: '沙發底地毯吸塵', icon: 'clean', color: '#b5603a', mode: 'grid' },
  { id: 'deep', label: '深層清潔（非機器）', icon: 'focus', color: '#1f7a6d', mode: 'grid' },
  { id: 'mattress', label: '床褥前後反轉', icon: 'bed', color: '#3a8fb5', mode: 'grid' },
  { id: 'bedframe', label: '床架防霉清潔', icon: 'bed', color: '#c0564f', mode: 'grid' },
  { id: 'quilt', label: '被芯更換', icon: 'bed', color: '#d07a2c', mode: 'grid' },
  { id: 'pillowhard', label: '硬枕芯更換', icon: 'bed', color: '#7a6a4f', mode: 'grid' },
  { id: 'pillowsoft', label: '軟枕芯更換', icon: 'bed', color: '#5a8f6a', mode: 'grid' },
  { id: 'pillowinner', label: '內枕袋更換', icon: 'bed', color: '#4a6fa5', mode: 'grid' },
  { id: 'balcony', label: '3 樓露台清洗', icon: 'sun', color: '#2f8f9d', mode: 'list' },
  { id: 'stain', label: '3 樓南翼地毯起漬', icon: 'drop', color: '#c0564f', mode: 'list' },
  { id: 'ninegrid', label: '3 樓九宮格清潔', icon: 'calendar', color: '#8a6d3b', mode: 'list' },
  { id: 'fog', label: '天花滅蟲焗霧', icon: 'search', color: '#54808c', mode: 'list' },
  { id: 'pubarea', label: '樓層公共走廊', icon: 'people', color: '#8a6d3b', mode: 'list' },
]
const FLOORS = Array.from({ length: 10 }, (_, i) => i + 3)
const ROOMS = n => Array.from({ length: 82 }, (_, i) => String(n * 100 + i + 1))
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
  const [fl, setFl] = useState(0)            // 0 ＝ 全部樓層
  const [todo, setTodo] = useState(false)    // 只睇未有記錄
  const [sheet, setSheet] = useState(null)   // { room, floor }
  const [form, setForm] = useState(null)     // 新增記錄
  const [report, setReport] = useState(false)
  const [delRow, setDelRow] = useState(null)
  useBack(!!item, () => { setItem(null); setFl(0); setTodo(false) })
  const load = () => api.dbSelectAll(T, 'id,item,room,floor,done_on,note,by_name').then(r => { cache = r; setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { if (!cache) load() }, [])

  const byItem = useMemo(() => {
    const m = {}
    for (const r of rows || []) {
      const x = m[r.item] || (m[r.item] = { rooms: new Map(), n: 0, last: '' })
      x.n++
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
        <div className="home-grid">
          {ITEMS.map(it => {
            const x = byItem[it.id]
            return (
              <button className="home-item" key={it.id} onClick={() => { setItem(it); setFl(0); setTodo(false) }}>
                <span className="hi-circle" style={{ background: it.color + '26', borderColor: 'transparent' }}><Icon name={it.icon} size={33} color={it.color} width={2.2} /></span>
                <span className="hi-label">{it.label}</span>
                <span className="hi-sub">{x ? (it.mode === 'grid' ? `${x.rooms.size} / 820 房` : `${x.rooms.size} 項`) + (x.last ? ` · ${shortD(x.last)}` : '') : '未有記錄'}</span>
              </button>
            )
          })}
        </div>
      </>
    )
  }

  const x = byItem[item.id] || { rooms: new Map(), n: 0, last: '' }
  const grid = item.mode === 'grid'
  const floors = fl ? [fl] : FLOORS
  const roomList = f => (grid ? ROOMS(f) : [...x.rooms.values()].filter(e => e.floor === f).map(e => e.room).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  const lastOf = room => (x.rooms.get(room) || { recs: [] }).recs[0]
  const doneN = grid ? x.rooms.size : 0

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
      <ToolBar sticky label={`${item.label}${grid ? ` · ${doneN} / 820 房` : ` · ${x.rooms.size} 項`}`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="fstk">
        <div className="dc-chips">
          <button className={'chip' + (!fl ? ' on' : '')} onClick={() => setFl(0)}>全部</button>
          {FLOORS.map(f => <button key={f} className={'chip' + (fl === f ? ' on' : '')} onClick={() => setFl(f)}>{f}F</button>)}
          {grid && <button className={'chip' + (todo ? ' on' : '')} onClick={() => setTodo(!todo)}>未有記錄（{820 - doneN}）</button>}
        </div>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {!grid && x.rooms.size === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有記錄。</p>}
      {floors.map(f => {
        const list = roomList(f).filter(r => !todo || !x.rooms.has(r))
        if (!list.length) return null
        return (
          <div key={f}>
            <div className="bh-grp">{f} 樓<span>{grid ? `${list.filter(r => x.rooms.has(r)).length} / ${list.length}` : list.length}</span></div>
            <div className={'dc-grid' + (grid ? '' : ' wide')}>
              {list.map(r => {
                const l = lastOf(r)
                return (
                  <button key={r} className={'dc-tile' + (l ? (l.done_on ? ' ok' : ' nt') : '')} onClick={() => setSheet({ room: r, floor: f })}>
                    <b>{r}</b>
                    <span>{l ? (shortD(l.done_on) || '備註') : '—'}</span>
                    {l && l.done_on && <small>{l.done_on.slice(2, 4)}</small>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
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
