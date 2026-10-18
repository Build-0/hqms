import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
import { PERMS } from '../lib/accounts'
import { SCORE_DIMS } from '../data/seedData'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'
import Perf from './Perf'
import StaffModal from '../components/Staff'
import { ReportModal, FindingsReport } from '../components/Reports'

// 查房快速記錄：拍照 → 房號 → 選房務員 → 選問題標籤。全程不用打字。
// 同一次可選多個標籤：每個標籤存一筆（共用相片與 batch），方便日後按「人 × 問題」統計。

const LS_ATT = 'hqms_last_attendant'
const LS_INSP = 'hqms_last_inspector'
const lsGet = k => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

// 房號 → 樓層數字：1016→10、352→3
const floorOfRoom = r => {
  const d = String(r || '').replace(/\D/g, '')
  if (d.length >= 4) return parseInt(d.slice(0, d.length - 2), 10)
  if (d.length === 3) return parseInt(d[0], 10)
  return null
}
const floorOfAtt = a => { const m = String(a.floor || '').match(/^(\d+)/); return m ? parseInt(m[1], 10) : null }
const OTHER_TAG = '其他'
const GOOD_DIM = '做得好'      // 正面（表揚）標籤：存在 finding_tags.dim，免改資料庫
const OTHER_GOOD = '其他表揚'
const HIST_DAYS = 90          // 「已有 N 筆記錄」提示的統計範圍
// 一次記錄屬「做得好」：batch 以 good- 開頭（舊記錄一律當有問題）
const kindOf = f => (String(f.batch || '').startsWith('good-') ? 'good' : 'issue')
const REPEAT_DAYS = 30
const REPEAT_MIN = 2

export default function Findings({ session }) {
  const full = !session || PERMS[session.role].findings === 'edit'   // 管理員：名單、標籤、匯出、人員表現、刪除
  const canEdit = !session || PERMS[session.role].findings !== 'none'   // 管理員與樓層主管：查看全部、新增、編輯（公開透明）
  const [atts, setAtts] = useState([])
  const [tags, setTags] = useState([])
  const [topics, setTopics] = useState([])
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState('rec')          // rec 記錄／perf 人員表現
  const [staff, setStaff] = useState(false)
  const [choose, setChoose] = useState(false)     // 右下「＋」→ 揀記錄問題／做得好
  const [view, setView] = useState(null)        // 檢視中的一次記錄（batch）
  const [mgr, setMgr] = useState(false)         // 標籤管理
  const [confirmDel, setConfirmDel] = useState(null)
  const [range, setRange] = useState(7)
  const [kindF, setKindF] = useState('全部')   // 全部 / 有問題 / 做得好
  const [warn, setWarn] = useState(null)        // 選了已有記錄的同事 → 確認彈窗
  const [report, setReport] = useState(false)
  const [withPhotos, setWithPhotos] = useState(true)   // 報告是否附相片
  const [who, setWho] = useState('')            // 只看某位房務員

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [a, t, tp, f] = await Promise.all([api.listAttendants(), api.listFindingTags(), api.listTopics(), api.listFindings(addDaysStr(-HIST_DAYS))])
      setAtts(a); setTags(t); setTopics(tp); setRows(f); setErr('')
    } catch (ex) { setErr(ex.message); setRows([]) }
  }

  const attById = useMemo(() => Object.fromEntries(atts.map(a => [a.id, a])), [atts])
  const tagById = useMemo(() => Object.fromEntries(tags.map(t => [t.id, t])), [tags])
  const topicById = useMemo(() => Object.fromEntries(topics.map(t => [t.id, t])), [topics])
  // 平時工作用英文名溝通：一律英文名在前（沒有英文名才用中文名）
  const nameOf = a => a ? (a.name || a.name_cn) + (a.name_cn && a.name && a.name !== a.name_cn ? ` ${a.name_cn}` : '') : '（已刪除）'
  const shortName = a => a ? (a.name || a.name_cn) : '—'

  if (!rows) return <div className="note">載入中…</div>

  // 同一次記錄（batch）合併顯示
  const since = addDaysStr(-range + 1)
  const batches = []
  const seen = {}
  for (const f of rows) {
    if (f.date < since) continue
    if (kindF !== '全部' && kindOf(f) !== (kindF === '有問題' ? 'issue' : 'good')) continue
    if (who && f.attendant_id !== who) continue
    const k = f.batch || f.id
    if (!seen[k]) { seen[k] = { key: k, kind: kindOf(f), date: f.date, room: f.room, attendant_id: f.attendant_id, photos: f.photos || [], note: f.note, inspector: f.inspector, time: f.check_time, edited_by: f.edited_by, items: [] }; batches.push(seen[k]) }
    seen[k].items.push(f)
  }

  // 重複問題：30 日內同一人同一標籤 ≥2 次
  const repSince = addDaysStr(-REPEAT_DAYS + 1)
  const repMap = {}
  for (const f of rows) {
    if (f.date < repSince || !f.attendant_id || (!f.tag_id && f.tag === OTHER_TAG) || kindOf(f) === 'good') continue
    const tk = f.tag_id || f.tag
    const k = f.attendant_id + '|' + tk
    if (!repMap[k]) repMap[k] = { attendant_id: f.attendant_id, tag: (tagById[f.tag_id] || {}).name || f.tag, n: 0, last: f.date }
    repMap[k].n++
  }
  const repeats = Object.values(repMap).filter(r => r.n >= REPEAT_MIN).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last))

  // ── 表單 ──
  const hasTime = rows.some(r => 'check_time' in r)
  const hasEdit = rows.some(r => 'edited_by' in r)
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }
  const activeAtts = atts.filter(a => a.active)
  const activeTags = tags.filter(t => t.active !== false)
  function newForm(keep, kind = 'issue') {
    setForm({
      kind, confirmedAtt: keep?.confirmedAtt ?? '',
      date: todayStr(), time: nowHM(), room: '', attendant_id: keep?.attendant_id ?? (kind === 'issue' ? '' : lsGet(LS_ATT)), tag_ids: [],
      photos: [], note: '', inspector: keep?.inspector ?? (session ? session.name : lsGet(LS_INSP)),   // 預設為目前登入者
    })
  }
  // 選人：「有問題」入口，如果該同事之前已有記錄就先彈出提示，確認後才繼續
  function pickAtt(id) {
    setForm(f => ({ ...f, attendant_id: id }))
    if (!id || form.kind !== 'issue' || id === form.confirmedAtt) return
    const map = {}
    for (const r of rows) {
      if (r.attendant_id !== id || kindOf(r) !== 'issue') continue
      const k = r.batch || r.id
      if (!map[k]) map[k] = { date: r.date, tags: [] }
      map[k].tags.push((tagById[r.tag_id] || {}).name || r.tag)
    }
    const list = Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
    if (list.length) setWarn({ id, n: list.length, recent: list.slice(0, 3) })
    else setForm(f => ({ ...f, attendant_id: id, confirmedAtt: id }))
  }
  async function save(next) {
    const f = form
    if (!f.attendant_id) { toast('請選擇房務員'); return }
    if (!f.tag_ids.length && !f.note.trim()) { toast(f.kind === 'good' ? '請選擇做得好的地方，或在「補充」寫下來' : '請選擇問題，或在「補充」寫下問題'); return }
    setSaving(true)
    const batch = f.editBatch || `${f.kind === 'good' ? 'good-' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ids = f.tag_ids.length ? f.tag_ids : [null] // 沒有適合的標籤：只靠補充文字記一筆
    const list = ids.map(id => ({
      date: f.date || todayStr(), attendant_id: f.attendant_id, room: f.room.trim(), tag_id: id,
      tag: id ? (tagById[id] || {}).name || '' : (f.kind === 'good' ? OTHER_GOOD : OTHER_TAG), photos: f.photos, note: f.note.trim(), inspector: f.inspector.trim(), batch,
      ...(hasTime ? { check_time: f.time || nowHM() } : {}),
      ...(f.editIds && hasEdit ? { edited_by: session ? session.name : '', edited_at: new Date().toISOString() } : {}),
    }))
    try {
      await api.addFindings(list)
      if (f.editIds) for (const id of f.editIds) await api.deleteFinding(id)   // 先寫入新的，成功後才刪舊的
    } catch (ex) { setSaving(false); toast('儲存失敗：' + ex.message); return }
    setSaving(false)
    lsSet(LS_ATT, f.attendant_id); lsSet(LS_INSP, f.inspector.trim())
    if (f.editIds) { toast('已儲存修改'); setForm(null); setSaving(false); load(); return }
    toast(f.kind === 'good' ? '已記錄表揚 ⭐' : f.tag_ids.length ? `已記錄 ${list.length} 個問題` : '已記錄（其他問題）')
    if (next) newForm({ attendant_id: f.attendant_id, inspector: f.inspector, confirmedAtt: f.confirmedAtt }, f.kind)
    else setForm(null)
    load()
  }
  function editBatch(b) {
    setForm({
      kind: b.kind, confirmedAtt: b.attendant_id || '', date: b.date, room: b.room || '', attendant_id: b.attendant_id || '',
      tag_ids: b.items.map(i => i.tag_id).filter(Boolean), photos: b.photos || [], note: b.note || '', inspector: b.inspector || '',
      time: b.time || '', editIds: b.items.map(i => i.id), editBatch: b.items[0]?.batch || '',
    })
    setView(null)
  }
  async function delBatch(b) {
    try { for (const it of b.items) await api.deleteFinding(it.id) } catch (ex) { toast('刪除失敗：' + ex.message); return }
    setConfirmDel(null); setView(null); toast('已刪除'); load()
  }

  // 房號 → 推薦該樓層的房務員
  const fl = form ? floorOfRoom(form.room) : null
  const suggested = form ? activeAtts.filter(a => fl != null && floorOfAtt(a) === fl)
    .sort((x, y) => String(x.floor).localeCompare(String(y.floor))) : []
  const lastAtt = form && attById[lsGet(LS_ATT)]
  // 已輸入房號並認得樓層時，只顯示該樓層房務員；未有房號才補上「上次用過」的人
  const quick = form ? [...(fl == null && lastAtt && lastAtt.active && !suggested.includes(lastAtt) ? [lastAtt] : []), ...suggested] : []
  if (form && form.attendant_id && attById[form.attendant_id] && !quick.includes(attById[form.attendant_id])) quick.unshift(attById[form.attendant_id])

  const issueTags = activeTags.filter(t => t.dim !== GOOD_DIM)
  const goodTags = activeTags.filter(t => t.dim === GOOD_DIM)
  // 問題標籤按做房次序排列：鋪床 → 抹塵 → 吸塵 → 浴室及杯具 → 玻璃鏡面 → 擺放 → 做房車 → 其他（每條只出現一次）
  const tagsByDim = DIM_ORDER.map(d => ({ d: DIM_LABEL[d] || d, list: issueTags.filter(t => (SCORE_DIMS.includes(t.dim) ? t.dim : '其他') === d) })).filter(g => g.list.length)
  const groups = form?.kind === 'good' ? (goodTags.length ? [{ d: '⭐ 做得好', list: goodTags }] : []) : tagsByDim

  // 報告資料（跟住目前篩選）
  const tagName = it => (tagById[it.tag_id] || {}).name || it.tag
  const issueB = batches.filter(b => b.kind === 'issue'), goodB = batches.filter(b => b.kind === 'good')
  const tagRank = (() => { const o = {}; for (const b of issueB) for (const it of b.items) { const k = tagName(it); o[k] = (o[k] || 0) + 1 } return Object.entries(o).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 10) })()
  const byPerson = (() => { const o = {}; for (const b of batches) { const a = attById[b.attendant_id]; const p = (o[b.attendant_id] = o[b.attendant_id] || { name: shortName(a), floor: a?.floor && a.floor !== '-' ? a.floor : '', issue: 0, good: 0 }); p[b.kind]++ } return Object.values(o).sort((a, b) => b.issue - a.issue || b.good - a.good) })()

  return (
    <>
      {err && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}<br />請先在 Supabase SQL Editor 執行 <b>add-findings.sql</b>。</p>
        </div>
      )}

      {full && <ToolBar label="查房記錄">
        <ToolBtn onClick={() => setStaff(true)}>👥 名單</ToolBtn>
        <ToolBtn onClick={() => setMgr(true)}>⚙ 標籤（{activeTags.length}）</ToolBtn>
        <ExportBtn onClick={() => setReport(true)} />
      </ToolBar>}
      {full && <div className="seg" style={{ margin: '12px 0 8px' }}>
        <button className={mode === 'rec' ? 'on' : ''} onClick={() => setMode('rec')}>記錄</button>
        <button className={mode === 'perf' ? 'on' : ''} onClick={() => setMode('perf')}>人員表現</button>
      </div>}
      {mode === 'perf' && <Perf rows={rows} tagById={tagById} atts={atts} onStaff={() => setStaff(true)} edit />}
      <button className="fab" onClick={() => setChoose(true)}>＋</button>
      {choose && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setChoose(false) }}>
          <div className="sheet">
            <h2>新增查房記錄</h2>
            <button className="btn fd-big fd-issue" onClick={() => { setChoose(false); newForm(undefined, 'issue') }}>⚠ 記錄問題</button>
            <button className="btn fd-big fd-good" style={{ marginTop: 10 }} onClick={() => { setChoose(false); newForm(undefined, 'good') }}>⭐ 做得好</button>
            <button className="btn ghost" onClick={() => setChoose(false)}>取消</button>
          </div>
        </div>
      )}
      {staff && <StaffModal attendants={atts} onClose={() => setStaff(false)} reload={load} />}
      {mode === 'rec' && (
        <>
      {full && repeats.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <h2 style={{ color: 'var(--red)' }}>⚠ 重複出現<span style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 400 }}>（{REPEAT_DAYS} 日內同一問題 ≥{REPEAT_MIN} 次）</span></h2>
          {repeats.slice(0, 12).map(r => (
            <div key={r.attendant_id + r.tag} className="fd-rep" onClick={() => { setWho(r.attendant_id); setRange(30) }}>
              <span className="fd-rep-name">{shortName(attById[r.attendant_id])}{attById[r.attendant_id]?.floor && attById[r.attendant_id].floor !== '-' ? <span className="fd-sub"> {attById[r.attendant_id].floor}</span> : ''}</span>
              <span className="fd-rep-tag">{r.tag}</span>
              <span className="badge" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>×{r.n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="fstk">
      <div className="df-grid" style={{ marginBottom: 8 }}>
        <select className="df-sel" value={range} onChange={e => setRange(+e.target.value)}>
          {[[1, '今日'], [7, '近 7 日'], [30, '近 30 日'], [90, '近 90 日']].map(([d, t]) => <option key={d} value={d}>{t}</option>)}
        </select>
        <select className="df-sel" value={kindF} onChange={e => setKindF(e.target.value)}>
          <option value="全部">全部類型</option><option value="有問題">⚠ 有問題</option><option value="做得好">⭐ 做得好</option>
        </select>
      </div>
      {who && <div className="chips" style={{ marginBottom: 6 }}><button className="chip on" onClick={() => setWho('')}>{shortName(attById[who])} ✕</button></div>}
      </div>

      <h2 style={{ margin: '4px 4px 10px' }}>查房記錄<span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>（{batches.length} 次 · {batches.reduce((n, b) => n + b.items.length, 0)} 個問題）</span></h2>
      {batches.length === 0 && <div className="note">這段時間還沒有記錄。查房發現問題，請按上面的「⚠ 記錄問題」。</div>}
      {batches.map(b => (
        <div className="c-item fd-item" key={b.key} onClick={() => setView(b)}>
          <div className="fd-thumb">{b.photos[0] ? <img src={b.photos[0]} alt="" loading="lazy" /> : <span>📋</span>}{b.photos.length > 1 && <span className="fd-pn">{b.photos.length}</span>}</div>
          <div className="fd-main">
            <div className="fd-top">{b.kind === 'good' && <span className="fd-goodmark">⭐</span>}<b>{shortName(attById[b.attendant_id])}</b>{b.room && <span className="fd-sub"> · {b.room}房</span>}<span className="fd-date">{b.date.slice(5).replace('-', '/')}</span></div>
            <div className="fd-tags">{b.items.map(it => <span key={it.id} className={`fd-tag ${b.kind === 'good' ? 'good' : ''}`}>{(tagById[it.tag_id] || {}).name || it.tag}</span>)}</div>
            {b.note && <div className="fd-note">{b.note}</div>}
            {(b.inspector || b.time) && <div className="fd-by">{b.time ? `🕐 ${b.time}` : ''}{b.time && b.inspector ? ' · ' : ''}{b.inspector ? `抽查 ${b.inspector}` : ''}</div>}
          </div>
        </div>
      ))}

        </>
      )}

      {/* ── 記錄表單 ── */}
      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet fd-form">
            <h2>{form.editIds ? '✏️ 編輯記錄' : form.kind === 'good' ? '⭐ 表揚做得好' : '記錄問題'}</h2>
            <PhotoField label="① 拍照" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} max={4} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }} className="f-row"><label>② 房號</label><input inputMode="numeric" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="例：1016" /></div>
              <div style={{ flex: 1 }} className="f-row"><label>日期</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              {hasTime && <div style={{ flex: 1 }} className="f-row"><label>時間</label><input type="time" value={form.time || ''} onChange={e => setForm({ ...form, time: e.target.value })} /></div>}
            </div>
            <div className="f-row">
              <label>③ 房務員{fl != null && suggested.length > 0 ? `（${fl} 樓）` : ''}</label>
              {quick.length > 0 && (
                <div className="chips wrap" style={{ marginBottom: 6 }}>
                  {quick.map(a => (
                    <button key={a.id} className={`chip ${form.attendant_id === a.id ? 'on' : ''}`} onClick={() => pickAtt(a.id)}>
                      {shortName(a)}{a.floor && a.floor !== '-' ? <span style={{ opacity: .7, fontSize: 12 }}> {a.floor}</span> : ''}
                    </button>
                  ))}
                </div>
              )}
              <select value={quick.some(a => a.id === form.attendant_id) ? '' : form.attendant_id} onChange={e => e.target.value && pickAtt(e.target.value)}>
                <option value="">{quick.length ? '＋ 選其他樓層房務員…' : '請選擇房務員'}</option>
                {activeAtts.slice().sort((x, y) => String(x.floor).localeCompare(String(y.floor), undefined, { numeric: true })).map(a => <option key={a.id} value={a.id}>{a.floor && a.floor !== '-' ? `${a.floor} · ` : ''}{nameOf(a)}</option>)}
              </select>
            </div>
            <div className="f-row">
              <label>{form.kind === 'good' ? '④ 做得好的地方（可多選）' : '④ 問題（可多選）'}</label>
              {groups.map(g => (
                <div key={g.d} className="fd-dim">
                  <div className="fd-dim-h">{g.d}</div>
                  <div className="chips wrap" style={{ marginBottom: 2 }}>
                    {g.list.map(t => {
                      const on = form.tag_ids.includes(t.id)
                      return <button key={t.id} className={`chip fd-chip ${on ? 'on' : ''}`}
                        onClick={() => setForm({ ...form, tag_ids: on ? form.tag_ids.filter(x => x !== t.id) : [...form.tag_ids, t.id] })}>{t.name}</button>
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="f-row"><label>補充（沒有適合的標籤就寫這裡 · 可語音輸入）</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例：浴缸邊" /></div>
            <div className="f-row"><label>抽查人</label><input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="抽查人姓名" /></div>
            {form.editIds && <button className="btn" disabled={saving || !form.attendant_id || (!form.tag_ids.length && !form.note.trim())} onClick={() => save(false)}>{saving ? '儲存中…' : '儲存修改'}</button>}
            {!form.editIds && <button className="btn" disabled={saving || !form.attendant_id || (!form.tag_ids.length && !form.note.trim())} onClick={() => save(true)}>{saving ? '儲存中…' : '儲存，記下一間'}</button>}
            {!form.editIds && <button className="btn ghost" disabled={saving} onClick={() => save(false)} style={{ color: 'var(--accent)', fontWeight: 700 }}>儲存並關閉</button>}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {warn && (
        <div className="modal" style={{ zIndex: 60 }}>
          <div className="sheet center">
            <h2 style={{ marginBottom: 6 }}>{shortName(attById[warn.id])} 已有記錄</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>此同事在系統中已經有 <b>{warn.n}</b> 筆記錄（近 {HIST_DAYS} 日），是否確定新增？</p>
            <div className="fd-warn-list">
              {warn.recent.map((r, i) => <div key={i}><span className="fd-sub">{r.date.slice(5).replace('-', '/')}</span> {r.tags.join('、')}</div>)}
            </div>
            <button className="btn" onClick={() => { setForm(f => ({ ...f, confirmedAtt: warn.id })); setWarn(null) }}>確定新增</button>
            <button className="btn ghost" onClick={() => { setForm(f => ({ ...f, attendant_id: '' })); setWarn(null) }}>返回</button>
          </div>
        </div>
      )}

      {report && (
        <ReportModal title="查房記錄報告" sub={`近 ${range} 日${who ? ' · ' + shortName(attById[who]) : ''}${kindF !== '全部' ? ' · ' + kindF : ''}`} onClose={() => setReport(false)}>
          <FindingsReport withPhotos={withPhotos} onTogglePhotos={setWithPhotos} data={{
            issueN: issueB.length, goodN: goodB.length, peopleN: byPerson.length,
            tagRank, byPerson,
            repeats: repeats.map(r => ({ name: shortName(attById[r.attendant_id]), tag: r.tag, n: r.n })),
            rows: batches.map(b => ({ date: b.date, room: b.room, name: shortName(attById[b.attendant_id]), kind: b.kind, tags: b.items.map(tagName).join('、'), note: b.note, photos: b.photos || [] })),
          }} />
        </ReportModal>
      )}

      {/* ── 檢視一次記錄：相片 + 正確做法（當面講用）── */}
      {view && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <h2 style={{ marginBottom: 4 }}>{shortName(attById[view.attendant_id])}{view.room ? ` · ${view.room}房` : ''}</h2>
            <p className="src-note">{view.date}{view.time ? ` ${view.time}` : ''}{view.inspector ? ` · 抽查：${view.inspector}` : ''}{view.edited_by ? ` · 最後編輯：${view.edited_by}` : ''}</p>
            <PhotoGrid photos={view.photos} />
            {view.note && <div className="kv"><span className="k">補充</span><span className="v">{view.note}</span></div>}
            {view.items.map(it => {
              const tg = tagById[it.tag_id]
              const tp = tg && topicById[tg.topic_id]
              return (
                <div key={it.id} className="fd-std">
                  <div className={`fd-std-h ${view.kind === 'good' ? 'good' : ''}`}>{view.kind === 'good' ? '⭐' : '❌'} {(tg || {}).name || it.tag}</div>
                  {view.kind === 'good' ? null : tp ? (
                    <>
                      <div className="fd-std-t">📘 {tp.title}</div>
                      {(tp.correct_steps || []).length > 0 && <ol className="fd-steps">{tp.correct_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
                    </>
                  ) : it.tag === OTHER_TAG && !it.tag_id ? <div className="fd-std-none">其他問題 · 見上面補充</div> : <div className="fd-std-none">未連結主題 · 可在「⚙ 問題標籤」連結主題庫，之後會顯示正確做法</div>}
                </div>
              )
            })}
            {canEdit && <button className="btn" style={{ marginTop: 14 }} onClick={() => editBatch(view)}>編輯這次記錄</button>}
            {full && <button className="btn danger" onClick={() => setConfirmDel(view)}>刪除這次記錄</button>}
            <button className="btn ghost" onClick={() => setView(null)}>關閉</button>
          </div>
        </div>
      )}

      {mgr && <TagManager tags={tags} topics={topics} onClose={() => setMgr(false)} onChanged={load} />}
      {confirmDel && <Confirm text={`會刪除這次記錄（${confirmDel.items.length} 個問題）。`} onConfirm={() => delBatch(confirmDel)} onCancel={() => setConfirmDel(null)} />}
    </>
  )
}

// 問題標籤的組別次序（做房流程）與顯示名稱；記錄表單與標籤管理共用
const DIM_ORDER = ['鋪床', '抹塵', '吸塵', '清潔器皿', '玻璃及鏡面', '物品整齊度', '做房車整潔度', '其他']
const DIM_LABEL = { 清潔器皿: '浴室及杯具', 物品整齊度: '物品擺放' }
const dimKey = t => (SCORE_DIMS.includes(t.dim) ? t.dim : '其他')
const dimIdx = t => DIM_ORDER.indexOf(dimKey(t))

function TagManager({ tags, topics, onClose, onChanged }) {
  const [tab, setTab] = useState('issue')   // issue=問題標籤 / good=做得好標籤
  const [adding, setAdding] = useState({ name: '', dim: SCORE_DIMS[0] })
  const [confirmDel, setConfirmDel] = useState(null)
  const topicOpts = topics.slice().sort((a, b) => (a.category + a.title).localeCompare(b.category + b.title))
  async function patch(t, p) {
    try { await api.updateFindingTag(t.id, p); onChanged() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  async function add() {
    const name = adding.name.trim()
    if (!name) { toast('請填標籤名稱'); return }
    if (tags.some(t => t.name === name)) { toast('已有同名標籤'); return }
    try { await api.addFindingTag({ name, dim: tab === 'good' ? GOOD_DIM : adding.dim, sort_order: tags.length + 1 }) } catch (ex) { toast('新增失敗：' + ex.message); return }
    setAdding({ name: '', dim: adding.dim }); toast('已新增'); onChanged()
  }
  // 目前分頁的標籤次序：問題標籤先按組別，再按排序；做得好標籤按排序
  const rows = tags.filter(t => (t.dim === GOOD_DIM) === (tab === 'good'))
    .sort((a, b) => (tab === 'issue' ? dimIdx(a) - dimIdx(b) : 0) || (a.sort_order || 0) - (b.sort_order || 0))
  // 上下移動：只在同一組內對調，然後把整個分頁重新編號（10、20、30…）
  async function move(t, dir) {
    const i = rows.findIndex(x => x.id === t.id), j = i + dir
    if (j < 0 || j >= rows.length || (tab === 'issue' && dimIdx(rows[j]) !== dimIdx(t))) return
    const arr = rows.slice();[arr[i], arr[j]] = [arr[j], arr[i]]
    try {
      await Promise.all(arr.map((x, k) => ((x.sort_order || 0) === (k + 1) * 10 ? null : api.updateFindingTag(x.id, { sort_order: (k + 1) * 10 }))))
      onChanged()
    } catch (ex) { toast('調整失敗：' + ex.message) }
  }
  async function del(t) {
    try { await api.deleteFindingTag(t.id) } catch (ex) { toast('刪除失敗：' + ex.message); return }
    setConfirmDel(null); toast('已刪除'); onChanged()
  }
  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <h2>標籤管理</h2>
        <div className="chips" style={{ marginBottom: 8 }}>
          <button className={`chip ${tab === 'issue' ? 'on' : ''}`} onClick={() => setTab('issue')}>⚠ 問題標籤（{tags.filter(t => t.dim !== GOOD_DIM).length}）</button>
          <button className={`chip ${tab === 'good' ? 'on' : ''}`} onClick={() => setTab('good')}>⭐ 做得好標籤（{tags.filter(t => t.dim === GOOD_DIM).length}）</button>
        </div>
        <p className="src-note">每個標籤可連結主題庫一個主題：檢視記錄時會顯示該主題的正確做法。停用的標籤不會再出現在記錄表單，但舊記錄會保留。</p>
        {rows.map((t, ri) => (
          <div key={t.id}>
          {tab === 'issue' && (ri === 0 || dimIdx(rows[ri - 1]) !== dimIdx(t)) && <div className="p-title" style={{ margin: '12px 2px 6px', color: 'var(--accent)' }}>{DIM_LABEL[dimKey(t)] || dimKey(t)}</div>}
          <div className="fd-mgr-row" style={{ opacity: t.active === false ? .5 : 1 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button className="mv-btn" onClick={() => move(t, -1)} aria-label="上移">▲</button>
                <button className="mv-btn" onClick={() => move(t, 1)} aria-label="下移">▼</button>
              </span>
              <input className="fd-inp" defaultValue={t.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.name) patch(t, { name: v }) }} />
              <button className="mini" onClick={() => patch(t, { active: t.active === false })}>{t.active === false ? '啟用' : '停用'}</button>
              <button className="mini danger" onClick={() => setConfirmDel(t)}>✕</button>
            </div>
            {tab === 'issue' && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <select className="fd-inp" style={{ flex: '0 0 38%' }} value={SCORE_DIMS.includes(t.dim) ? t.dim : ''} onChange={e => patch(t, { dim: e.target.value })}>
                <option value="">其他</option>
                {SCORE_DIMS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="fd-inp" value={t.topic_id || ''} onChange={e => patch(t, { topic_id: e.target.value || null })}>
                <option value="">（未連結主題）</option>
                {topicOpts.map(tp => <option key={tp.id} value={tp.id}>{tp.category}｜{tp.title}</option>)}
              </select>
            </div>}
          </div>
          </div>
        ))}
        <div className="fd-mgr-row" style={{ borderStyle: 'dashed' }}>
          <input className="fd-inp" placeholder={tab === 'good' ? '新標籤，例：主動協助同事' : '新標籤，例：浴缸邊有水垢'} value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {tab === 'issue' && <select className="fd-inp" value={adding.dim} onChange={e => setAdding({ ...adding, dim: e.target.value })}>
              {SCORE_DIMS.map(d => <option key={d} value={d}>{d}</option>)}
              <option value="">其他</option>
            </select>}
            <button className="mini pri" onClick={add}>＋ 新增</button>
          </div>
        </div>
        <button className="btn ghost" onClick={onClose}>完成</button>
        {confirmDel && <Confirm text={`刪除標籤「${confirmDel.name}」？舊記錄會保留標籤名稱。想暫時不用可以改按「停用」。`} onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    </div>
  )
}
