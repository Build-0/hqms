import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { SCORE_DIMS, COMMON_FINDING_TAGS } from '../data/seedData'
import { todayStr, addDaysStr } from '../lib/dates'
import { toast } from '../lib/toast'
import { PhotoGrid, PhotoField } from '../components/Photos'
import Confirm from '../components/Confirm'
import { ReportModal, FindingsReport } from '../components/Reports'

// 查房快速記錄：影相 → 房號 → 揀房務員 → 揀問題標籤。全程不用打字。
// 同一次可揀多個標籤：每個標籤存一筆（共用相片與 batch），方便日後按「人 × 問題」統計。

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

export default function Findings() {
  const [atts, setAtts] = useState([])
  const [tags, setTags] = useState([])
  const [topics, setTopics] = useState([])
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState(null)        // 檢視中的一次記錄（batch）
  const [mgr, setMgr] = useState(false)         // 標籤管理
  const [confirmDel, setConfirmDel] = useState(null)
  const [range, setRange] = useState(7)
  const [kindF, setKindF] = useState('全部')   // 全部 / 有問題 / 做得好
  const [warn, setWarn] = useState(null)        // 揀咗已有記錄嘅同事 → 確認彈窗
  const [report, setReport] = useState(false)
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
    if (!seen[k]) { seen[k] = { key: k, kind: kindOf(f), date: f.date, room: f.room, attendant_id: f.attendant_id, photos: f.photos || [], note: f.note, inspector: f.inspector, items: [] }; batches.push(seen[k]) }
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
  const activeAtts = atts.filter(a => a.active)
  const activeTags = tags.filter(t => t.active !== false)
  function newForm(keep, kind = 'issue') {
    setForm({
      kind, confirmedAtt: keep?.confirmedAtt ?? '',
      date: todayStr(), room: '', attendant_id: keep?.attendant_id ?? (kind === 'issue' ? '' : lsGet(LS_ATT)), tag_ids: [],
      photos: [], note: '', inspector: keep?.inspector ?? lsGet(LS_INSP),
    })
  }
  // 揀人：「有問題」入口，如果佢之前已有記錄就先彈提示，確認先繼續
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
    if (!f.attendant_id) { toast('請揀房務員'); return }
    if (!f.tag_ids.length && !f.note.trim()) { toast(f.kind === 'good' ? '請揀做得好嘅地方，或喺「補充」寫低' : '請揀問題，或喺「補充」寫低問題'); return }
    setSaving(true)
    const batch = `${f.kind === 'good' ? 'good-' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ids = f.tag_ids.length ? f.tag_ids : [null] // 冇適合嘅標籤：只靠補充文字記一筆
    const list = ids.map(id => ({
      date: f.date || todayStr(), attendant_id: f.attendant_id, room: f.room.trim(), tag_id: id,
      tag: id ? (tagById[id] || {}).name || '' : (f.kind === 'good' ? OTHER_GOOD : OTHER_TAG), photos: f.photos, note: f.note.trim(), inspector: f.inspector.trim(), batch,
    }))
    try { await api.addFindings(list) } catch (ex) { setSaving(false); toast('儲存失敗：' + ex.message); return }
    setSaving(false)
    lsSet(LS_ATT, f.attendant_id); lsSet(LS_INSP, f.inspector.trim())
    toast(f.kind === 'good' ? '已記錄表揚 ⭐' : f.tag_ids.length ? `已記錄 ${list.length} 個問題` : '已記錄（其他問題）')
    if (next) newForm({ attendant_id: f.attendant_id, inspector: f.inspector, confirmedAtt: f.confirmedAtt }, f.kind)
    else setForm(null)
    load()
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
  const quick = form ? [...(lastAtt && lastAtt.active && !suggested.includes(lastAtt) ? [lastAtt] : []), ...suggested] : []
  if (form && form.attendant_id && attById[form.attendant_id] && !quick.includes(attById[form.attendant_id])) quick.unshift(attById[form.attendant_id])

  const issueTags = activeTags.filter(t => t.dim !== GOOD_DIM)
  const goodTags = activeTags.filter(t => t.dim === GOOD_DIM)
  const common = COMMON_FINDING_TAGS.map(n => issueTags.find(t => t.name === n)).filter(Boolean)
  const commonIds = new Set(common.map(t => t.id))
  const tagsByDim = [
    ...(common.length ? [{ d: '⭐ 常用問題', list: common }] : []),
    ...[...SCORE_DIMS, '其他'].map(d => ({ d, list: issueTags.filter(t => !commonIds.has(t.id) && (SCORE_DIMS.includes(t.dim) ? t.dim : '其他') === d) })).filter(g => g.list.length),
  ]
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn fd-big fd-issue" onClick={() => newForm(undefined, 'issue')}>⚠ 記錄問題</button>
        <button className="btn fd-big fd-good" onClick={() => newForm(undefined, 'good')}>⭐ 做得好</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '6px 2px 10px' }}>
        <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4', marginRight: 6 }} onClick={() => setReport(true)}>📄 匯出</button>
        <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4' }} onClick={() => setMgr(true)}>⚙ 問題標籤（{activeTags.length}）</button>
      </div>

      {repeats.length > 0 && (
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

      <div className="chips">
        {[1, 7, 30, 90].map(d => <button key={d} className={`chip ${range === d ? 'on' : ''}`} onClick={() => setRange(d)}>{d === 1 ? '今日' : `${d} 日`}</button>)}
        {['全部', '有問題', '做得好'].map(k => <button key={k} className={`chip ${kindF === k ? 'on' : ''}`} onClick={() => setKindF(k)}>{k === '有問題' ? '⚠ 有問題' : k === '做得好' ? '⭐ 做得好' : '全部類型'}</button>)}
        {who && <button className="chip on" onClick={() => setWho('')}>{shortName(attById[who])} ✕</button>}
      </div>

      <h2 style={{ margin: '4px 4px 10px' }}>查房記錄<span style={{ fontSize: 11.5, color: 'var(--sub)', fontWeight: 400 }}>（{batches.length} 次 · {batches.reduce((n, b) => n + b.items.length, 0)} 個問題）</span></h2>
      {batches.length === 0 && <div className="note">呢段時間未有記錄。查房見到問題，㩒上面「📷 記錄問題」。</div>}
      {batches.map(b => (
        <div className="c-item fd-item" key={b.key} onClick={() => setView(b)}>
          <div className="fd-thumb">{b.photos[0] ? <img src={b.photos[0]} alt="" loading="lazy" /> : <span>📋</span>}{b.photos.length > 1 && <span className="fd-pn">{b.photos.length}</span>}</div>
          <div className="fd-main">
            <div className="fd-top">{b.kind === 'good' && <span className="fd-goodmark">⭐</span>}<b>{shortName(attById[b.attendant_id])}</b>{b.room && <span className="fd-sub"> · {b.room}房</span>}<span className="fd-date">{b.date.slice(5).replace('-', '/')}</span></div>
            <div className="fd-tags">{b.items.map(it => <span key={it.id} className={`fd-tag ${b.kind === 'good' ? 'good' : ''}`}>{(tagById[it.tag_id] || {}).name || it.tag}</span>)}</div>
            {b.note && <div className="fd-note">{b.note}</div>}
          </div>
        </div>
      ))}

      {/* ── 記錄表單 ── */}
      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.kind === 'good' ? '⭐ 表揚做得好' : '記錄問題'}</h2>
            <PhotoField label="① 影相" photos={form.photos} onChange={p => setForm({ ...form, photos: p })} max={4} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }} className="f-row"><label>② 房號</label><input inputMode="numeric" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="例：1016" /></div>
              <div style={{ flex: 1 }} className="f-row"><label>日期</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
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
              <select value={form.attendant_id} onChange={e => pickAtt(e.target.value)}>
                <option value="">{quick.length ? '其他房務員…' : '請選擇'}</option>
                {activeAtts.slice().sort((x, y) => String(x.floor).localeCompare(String(y.floor), undefined, { numeric: true })).map(a => <option key={a.id} value={a.id}>{a.floor && a.floor !== '-' ? `${a.floor} · ` : ''}{nameOf(a)}</option>)}
              </select>
            </div>
            <div className="f-row">
              <label>{form.kind === 'good' ? '④ 做得好嘅地方（可揀多個 · 冇適合嘅喺下面「補充」寫）' : '④ 問題（可揀多個 · 冇適合嘅可以唔揀，喺下面「補充」寫）'}</label>
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
            <div className="f-row"><label>補充（揀咗問題可留空 · 可用鍵盤🎤講）</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="例：浴缸邊" /></div>
            <div className="f-row"><label>抽查人</label><input value={form.inspector} onChange={e => setForm({ ...form, inspector: e.target.value })} placeholder="例：Benny" /></div>
            <button className="btn" disabled={saving || !form.attendant_id || (!form.tag_ids.length && !form.note.trim())} onClick={() => save(true)}>{saving ? '儲存中…' : '儲存，記下一間'}</button>
            <button className="btn ghost" disabled={saving} onClick={() => save(false)} style={{ color: 'var(--accent)', fontWeight: 700 }}>儲存並關閉</button>
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}

      {warn && (
        <div className="modal" style={{ zIndex: 60 }}>
          <div className="sheet center">
            <h2 style={{ marginBottom: 6 }}>{shortName(attById[warn.id])} 已有記錄</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>此同事喺入面已經有 <b>{warn.n}</b> 筆記錄（近 {HIST_DAYS} 日），是否確定新增？</p>
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
          <FindingsReport data={{
            issueN: issueB.length, goodN: goodB.length, peopleN: byPerson.length,
            tagRank, byPerson,
            repeats: repeats.map(r => ({ name: shortName(attById[r.attendant_id]), tag: r.tag, n: r.n })),
            rows: batches.map(b => ({ date: b.date, room: b.room, name: shortName(attById[b.attendant_id]), kind: b.kind, tags: b.items.map(tagName).join('、'), note: b.note })),
          }} />
        </ReportModal>
      )}

      {/* ── 檢視一次記錄：相片 + 正確做法（當面講用）── */}
      {view && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <h2 style={{ marginBottom: 4 }}>{shortName(attById[view.attendant_id])}{view.room ? ` · ${view.room}房` : ''}</h2>
            <p className="src-note">{view.date}{view.inspector ? ` · 抽查：${view.inspector}` : ''}</p>
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
                      {tp.question && <div className="fd-q">❓ {tp.question}</div>}
                    </>
                  ) : it.tag === OTHER_TAG && !it.tag_id ? <div className="fd-std-none">其他問題 · 見上面補充</div> : <div className="fd-std-none">未連結主題 · 可在「⚙ 問題標籤」連結主題庫，之後會顯示正確做法</div>}
                </div>
              )
            })}
            <button className="btn danger" style={{ marginTop: 14 }} onClick={() => setConfirmDel(view)}>刪除呢次記錄</button>
            <button className="btn ghost" onClick={() => setView(null)}>關閉</button>
          </div>
        </div>
      )}

      {mgr && <TagManager tags={tags} topics={topics} onClose={() => setMgr(false)} onChanged={load} />}
      {confirmDel && <Confirm text={`會刪除呢次記錄（${confirmDel.items.length} 個問題）。`} onConfirm={() => delBatch(confirmDel)} onCancel={() => setConfirmDel(null)} />}
    </>
  )
}

function TagManager({ tags, topics, onClose, onChanged }) {
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
    try { await api.addFindingTag({ name, dim: adding.dim, sort_order: tags.length + 1 }) } catch (ex) { toast('新增失敗：' + ex.message); return }
    setAdding({ name: '', dim: adding.dim }); toast('已新增'); onChanged()
  }
  async function del(t) {
    try { await api.deleteFindingTag(t.id) } catch (ex) { toast('刪除失敗：' + ex.message); return }
    setConfirmDel(null); toast('已刪除'); onChanged()
  }
  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <h2>問題標籤</h2>
        <p className="src-note">每個標籤可連結主題庫一個主題：檢視記錄時會顯示嗰個主題嘅正確做法。停用嘅標籤唔會再出現喺記錄表單，但舊記錄保留。</p>
        {tags.map(t => (
          <div key={t.id} className="fd-mgr-row" style={{ opacity: t.active === false ? .5 : 1 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="fd-inp" defaultValue={t.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.name) patch(t, { name: v }) }} />
              <button className="logout" style={{ color: 'var(--sub)', background: '#eef1f4', flexShrink: 0 }} onClick={() => patch(t, { active: t.active === false })}>{t.active === false ? '啟用' : '停用'}</button>
              <button className="logout" style={{ color: 'var(--red)', background: 'var(--red-soft)', flexShrink: 0 }} onClick={() => setConfirmDel(t)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <select className="fd-inp" style={{ flex: '0 0 38%' }} value={SCORE_DIMS.includes(t.dim) || t.dim === GOOD_DIM ? t.dim : ''} onChange={e => patch(t, { dim: e.target.value })}>
                <option value="">其他</option><option value={GOOD_DIM}>⭐ 做得好（正面）</option>
                {SCORE_DIMS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="fd-inp" value={t.topic_id || ''} onChange={e => patch(t, { topic_id: e.target.value || null })}>
                <option value="">（未連結主題）</option>
                {topicOpts.map(tp => <option key={tp.id} value={tp.id}>{tp.category}｜{tp.title}</option>)}
              </select>
            </div>
          </div>
        ))}
        <div className="fd-mgr-row" style={{ borderStyle: 'dashed' }}>
          <input className="fd-inp" placeholder="新標籤，例：浴缸邊有水垢" value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select className="fd-inp" value={adding.dim} onChange={e => setAdding({ ...adding, dim: e.target.value })}>
              {SCORE_DIMS.map(d => <option key={d} value={d}>{d}</option>)}
              <option value="">其他</option><option value={GOOD_DIM}>⭐ 做得好（正面）</option>
            </select>
            <button className="logout" style={{ color: '#fff', background: 'var(--accent)', flexShrink: 0, padding: '8px 16px' }} onClick={add}>＋ 新增</button>
          </div>
        </div>
        <button className="btn ghost" onClick={onClose}>完成</button>
        {confirmDel && <Confirm text={`刪除標籤「${confirmDel.name}」？舊記錄會保留標籤名稱。想暫時唔用可以改按「停用」。`} onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    </div>
  )
}
