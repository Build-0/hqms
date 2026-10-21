import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import Icon from '../components/Icon'
import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
import { ReportModal, ListReport } from '../components/Reports'
import { useBack } from '../lib/nav'
import { publicPerm } from '../lib/accounts'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'

// 公共地區管理（管理員可改；公眾主管可查看）。右上角可切換 中文／English。
const GRPS = ['商場', '前區', '後區', '深度清潔', '管理支援']
const GRP_EN = { 商場: 'Mall', 前區: 'Front of house', 後區: 'Back of house', 深度清潔: 'Deep cleaning', 管理支援: 'Supervision', 其他: 'Other' }
const KINDS = ['HSKP', '外判', '主管']
const KIND_EN = { HSKP: 'HSKP', 外判: 'Outsourced', 主管: 'Supervisor' }
const NATS = ['中國', '菲律賓', '越南', '緬甸', '印尼', '尼泊爾', '泰國', '其他']
const NAT_EN = { 中國: 'China', 菲律賓: 'Philippines', 越南: 'Vietnam', 緬甸: 'Myanmar', 印尼: 'Indonesia', 尼泊爾: 'Nepal', 泰國: 'Thailand', 其他: 'Other' }
const LANGS = ['粵語', '普通話', '英語']
const LANG_EN = { 粵語: 'Cantonese', 普通話: 'Mandarin', 英語: 'English' }
const WD = ['日', '一', '二', '三', '四', '五', '六']
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hm = i => `${String(Math.floor(i / 2) % 24).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
const endLabel = i => (i >= 48 ? '24:00' : hm(i))
const catColor = code => ({ M: ['#dff0ee', '#17624f'], F: ['#fbecd0', '#8a5a00'], B: ['#dfeaf7', '#245a9e'], D: ['#efe3f7', '#6a3d99'], G: ['#e8f1d8', '#4a6b1c'], S: ['#f6e0e0', '#9e3a3a'] }[String(code || '')[0]] || ['#eceff2', '#5b6773'])
const taskParts = t => String(t || '').split('+').map(x => x.trim()).filter(Boolean)

const LangCtx = createContext({ en: false, tr: a => a })

export default function PublicAreas({ session }) {
  const [view, setView] = useState(null)       // null 選單／posts／board／tasks／staff／log
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [en, setEn] = useState(() => { try { return localStorage.getItem('pa_lang') === 'en' } catch { return false } })
  const setLang = v => { setEn(v); try { localStorage.setItem('pa_lang', v ? 'en' : 'zh') } catch { /* 無法儲存時照常使用 */ } }
  const tr = (zh, e) => (en ? e : zh)
  const canEdit = publicPerm(session) === 'edit'
  useBack(!!view, () => setView(null))
  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [staff, posts, tasks, slots] = await Promise.all([
        api.dbSelect('pa_staff', { order: 'sort_order' }), api.dbSelect('pa_posts', { order: 'sort_order' }),
        api.dbSelect('pa_tasks', { order: 'sort_order' }), api.dbSelect('pa_slots', { order: 'id' }),
      ])
      setD({ staff, posts, tasks, slots }); setErr('')
    } catch (ex) { setErr(ex.message); setD(prev => prev || { staff: [], posts: [], tasks: [], slots: [] }) }
  }
  const who = session ? session.name : ''
  async function log(what, detail) { try { await api.dbInsert('pa_log', { by_name: who, what, detail: detail || null }) } catch { /* 紀錄失敗不影響主要操作 */ } }
  if (!d) return <div className="note">{tr('載入中…', 'Loading…')}</div>
  const staffOf = id => d.staff.find(s => s.id === id)
  const ctx = { d, load, log, staffOf, canEdit }

  return (
    <LangCtx.Provider value={{ en, tr }}>
      <div className="df-wrap">
        <div className="pa-lang">
          <button className={!en ? 'on' : ''} onClick={() => setLang(false)}>中文</button>
          <button className={en ? 'on' : ''} onClick={() => setLang(true)}>EN</button>
        </div>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>{tr('讀取失敗：', 'Failed to load: ')}{err}</p></div>}
        {!view && (
          <div className="home-grid">
            {[['posts', tr('崗位表', 'Posts'), 'clipcheck', '#1f7a6d', tr(`${d.posts.filter(p => p.active).length} 個崗位`, `${d.posts.filter(p => p.active).length} posts`)],
              ['board', tr('24 小時看板', '24-hour board'), 'calendar', '#4a6fa5', tr('每崗每半小時', 'Every 30 min per post')],
              ['tasks', tr('任務代碼', 'Task codes'), 'book', '#b5603a', tr(`${d.tasks.length} 個任務`, `${d.tasks.length} tasks`)],
              ['staff', tr('員工資料', 'Staff'), 'cap', '#8f7ac9', tr(`${d.staff.filter(s => s.active).length} 位在職`, `${d.staff.filter(s => s.active).length} active`)],
              ...(canEdit ? [['log', tr('改動紀錄', 'Change log'), 'search', '#7a6a4f', tr('誰改過咩', 'Who changed what')]] : [])].map(([k, t, ic, co, sb]) => (
              <button className="home-item" key={k} onClick={() => setView(k)}>
                <span className="hi-circle" style={{ background: co + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={co} width={2.2} /></span>
                <span className="hi-label">{t}</span>
                <span className="hi-sub">{sb}</span>
              </button>
            ))}
          </div>
        )}
        {view === 'posts' && <Posts {...ctx} />}
        {view === 'board' && <Board {...ctx} />}
        {view === 'tasks' && <Tasks {...ctx} />}
        {view === 'staff' && <StaffView {...ctx} />}
        {view === 'log' && canEdit && <LogView />}
      </div>
    </LangCtx.Provider>
  )
}

const useL = () => useContext(LangCtx)
const grpName = (en, g) => (en ? GRP_EN[g] || g : g)
const areaOf = (en, p) => (en && p.work_area_en ? p.work_area_en : p.work_area)
const taskShort = (en, t) => (en && t.short_en ? t.short_en : t.short)
const taskDetail = (en, t) => (en && t.detail_en ? t.detail_en : t.detail)

/* ───────── 崗位表 ───────── */
function Posts({ d, load, log, staffOf, canEdit }) {
  const { en, tr } = useL()
  const [edit, setEdit] = useState(null)
  const [report, setReport] = useState(false)
  const posts = d.posts.filter(p => p.active).sort((a, b) => a.sort_order - b.sort_order)
  const groups = GRPS.map(g => ({ g, items: posts.filter(p => p.grp === g) })).filter(x => x.items.length)
  const other = posts.filter(p => !GRPS.includes(p.grp))
  if (other.length) groups.push({ g: '其他', items: other })
  async function save() {
    const f = edit
    const row = { staff_id: f.staff_id || null, grp: f.grp, work_area: f.work_area.trim(), work_area_en: f.work_area_en || '', start_time: f.start_time, end_time: f.end_time, break_text: f.break_text.trim(), notes: f.notes.trim(), flag: f.flag }
    try {
      if (f.id) { await api.dbUpdate('pa_posts', f.id, row); await log('修改崗位 ' + f.code, { after: row }) }
      else {
        const p = await api.dbInsert('pa_posts', { ...row, code: f.code.trim(), sort_order: d.posts.length + 1 })
        await api.dbInsertMany('pa_slots', Array.from({ length: 48 }, (_, i) => ({ post_id: p.id, slot: i, task: '' })))
        await log('新增崗位 ' + f.code, { after: row })
      }
      toast(tr('已儲存', 'Saved')); setEdit(null); load()
    } catch (ex) { toast(tr('儲存失敗：', 'Save failed: ') + ex.message) }
  }
  async function stop() {
    try { await api.dbUpdate('pa_posts', edit.id, { active: false }); await log('停用崗位 ' + edit.code); toast(tr('已停用', 'Disabled')); setEdit(null); load() } catch (ex) { toast(ex.message) }
  }
  const nm = p => { const s = staffOf(p.staff_id); return s ? `${s.name}（${en ? KIND_EN[s.kind] : s.kind}）` : '—' }
  const reportData = () => ({
    filterText: tr('全部崗位', 'All posts'), cols: [tr('崗位', 'Post'), tr('員工', 'Staff'), tr('性別', 'Gender'), tr('上班—收工', 'Shift'), tr('休息', 'Break'), tr('負責區域', 'Area')],
    groups: groups.map(g => ({ name: grpName(en, g.g), rows: g.items.map(p => ({ cells: [p.code, nm(p), (staffOf(p.staff_id) || {}).gender ? (en ? ({ 男: 'M', 女: 'F' }[staffOf(p.staff_id).gender]) : staffOf(p.staff_id).gender) : '—', `${p.start_time}—${p.end_time}`, p.break_text || '—', areaOf(en, p) || '—'] })) })),
  })
  return (
    <>
      <ToolBar label={tr(`共 ${posts.length} 個崗位`, `${posts.length} posts`)}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      {groups.map(g => (
        <div key={g.g}>
          <div className="bh-grp">{grpName(en, g.g)}<span>{g.items.length}</span></div>
          {g.items.map(p => {
            const s = staffOf(p.staff_id)
            return (
              <button className="pa-card" key={p.id} onClick={() => canEdit && setEdit({ ...p })} style={canEdit ? undefined : { cursor: 'default' }}>
                <span className="pa-code">{p.code}</span>
                <span className="pa-main">
                  <b>{s ? s.name : tr('（未指派）', '(unassigned)')}{s && <small className={`pa-kind k-${s.kind}`}>{en ? KIND_EN[s.kind] : s.kind}</small>}{p.flag && <small className="pa-flag">{en ? 'To confirm' : p.flag}</small>}</b>
                  <span>{p.start_time} — {p.end_time}{p.break_text ? ` · ${tr('休', 'Break')} ${p.break_text}` : ''}</span>
                  <span className="pa-sub">{areaOf(en, p) || '—'}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {canEdit && <button className="fab" onClick={() => setEdit({ id: null, code: `崗${d.posts.length + 1}`, staff_id: '', grp: GRPS[0], work_area: '', work_area_en: '', start_time: '09:00', end_time: '18:00', break_text: '', notes: '', flag: '' })}>＋</button>}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{edit.id ? `${tr('編輯', 'Edit')} ${edit.code}` : tr('新增崗位', 'New post')}</h2>
              <span className="sheet-hd-acts"><button className="mini" onClick={() => setEdit(null)}>{tr('取消', 'Cancel')}</button><button className="mini pri" onClick={save}>{tr('儲存', 'Save')}</button></span></div>
            {!edit.id && <div className="f-row"><label>{tr('崗位編號', 'Post code')}</label><input value={edit.code} onChange={e => setEdit({ ...edit, code: e.target.value })} /></div>}
            <div className="f-row"><label>{tr('員工', 'Staff')}</label>
              <select value={edit.staff_id || ''} onChange={e => setEdit({ ...edit, staff_id: e.target.value })}>
                <option value="">{tr('（未指派）', '(unassigned)')}</option>
                {d.staff.filter(s => s.active || s.id === edit.staff_id).map(s => <option key={s.id} value={s.id}>{s.name}（{en ? KIND_EN[s.kind] : s.kind}）</option>)}
              </select></div>
            <div className="f-row"><label>{tr('分類', 'Group')}</label>
              <select value={edit.grp} onChange={e => setEdit({ ...edit, grp: e.target.value })}>{GRPS.map(g => <option key={g} value={g}>{grpName(en, g)}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('上班', 'Start')}</label><input type="time" value={edit.start_time} onChange={e => setEdit({ ...edit, start_time: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('收工', 'End')}</label><input type="time" value={edit.end_time} onChange={e => setEdit({ ...edit, end_time: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>{tr('休息時間', 'Break')}</label><input value={edit.break_text} onChange={e => setEdit({ ...edit, break_text: e.target.value })} placeholder="13:00–13:30, 18:30–19:00" /></div>
            <div className="f-row"><label>{tr('負責區域（中文）', 'Area (Chinese)')}</label><input value={edit.work_area} onChange={e => setEdit({ ...edit, work_area: e.target.value })} /></div>
            <div className="f-row"><label>{tr('負責區域（English）', 'Area (English)')}</label><input value={edit.work_area_en || ''} onChange={e => setEdit({ ...edit, work_area_en: e.target.value })} /></div>
            <div className="f-row"><label>{tr('備註', 'Notes')}</label><input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
            {edit.flag && <button className="btn alt" onClick={() => setEdit({ ...edit, flag: '' })}>✓ {tr('已確認，取消「', 'Confirmed — clear “')}{edit.flag}{tr('」標記', '” flag')}</button>}
            {edit.id && <button className="btn danger" onClick={stop}>{tr('停用這個崗位', 'Disable this post')}</button>}
          </div>
        </div>
      )}
      {report && <ReportModal title={tr('公共地區崗位表', 'Public Area Post Roster')} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}

/* ───────── 24 小時看板 ───────── */
function Board({ d, load, log, staffOf, canEdit }) {
  const { en, tr } = useL()
  const posts = d.posts.filter(p => p.active).sort((a, b) => a.sort_order - b.sort_order)
  const [mode, setMode] = useState('post')       // post 按崗位／all 總覽
  const [pid, setPid] = useState(posts[0] ? posts[0].id : '')
  const [edit, setEdit] = useState(null)
  const slotsOf = useMemo(() => {
    const m = {}
    d.slots.forEach(s => { (m[s.post_id] = m[s.post_id] || Array(48).fill(null))[s.slot] = s })
    return m
  }, [d.slots])
  const post = posts.find(p => p.id === pid)
  const taskName = code => { const t = d.tasks.find(x => x.code === code); return t ? taskShort(en, t) : '' }
  const segs = id => {
    const arr = slotsOf[id] || []; const out = []
    for (let i = 0; i < 48; i++) {
      const t = (arr[i] && arr[i].task) || ''
      const last = out[out.length - 1]
      if (last && last.task === t) last.to = i + 1; else out.push({ from: i, to: i + 1, task: t })
    }
    return out
  }
  async function apply() {
    const f = edit
    const arr = slotsOf[f.post_id] || []
    const ids = []
    for (let i = f.from; i < f.to; i++) if (arr[i]) ids.push(arr[i].id)
    const task = [f.t1, f.t2].filter(Boolean).join('+')
    if (f.to <= f.from) { toast(tr('「至」要遲過「由」', '“To” must be later than “From”')); return }
    try {
      await api.dbUpdateMany('pa_slots', ids, { task })
      await log(`修改看板 ${posts.find(p => p.id === f.post_id).code} ${hm(f.from)}–${endLabel(f.to)}`, { task })
      toast(tr('已更新', 'Updated')); setEdit(null); load()
    } catch (ex) { toast(tr('儲存失敗：', 'Save failed: ') + ex.message) }
  }
  const openSeg = (post_id, s) => { if (!canEdit || !s) return; const [a, b] = taskParts(s.task); setEdit({ post_id, from: s.from, to: s.to, t1: a || '', t2: b || '' }) }
  return (
    <>
      <div className="seg" style={{ margin: '0 0 10px' }}>
        <button className={mode === 'post' ? 'on' : ''} onClick={() => setMode('post')}>{tr('按崗位', 'By post')}</button>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>{tr(`總覽（${posts.length} 崗）`, `Overview (${posts.length} posts)`)}</button>
      </div>
      {mode === 'post' && post && (
        <>
          <div className="fstk">
            <select className="df-sel" value={pid} onChange={e => setPid(e.target.value)} style={{ width: '100%' }}>
              {posts.map(p => <option key={p.id} value={p.id}>{p.code} · {(staffOf(p.staff_id) || {}).name || tr('未指派', 'unassigned')}（{p.start_time}—{p.end_time}）</option>)}
            </select>
          </div>
          {segs(pid).map(s => {
            const [bg, fg] = catColor(taskParts(s.task)[0])
            return (
              <button key={s.from} className="pa-seg" onClick={() => openSeg(pid, s)} style={{ background: s.task ? bg : 'transparent', color: s.task ? fg : 'var(--sub)', borderStyle: s.task ? 'solid' : 'dashed', cursor: canEdit ? 'pointer' : 'default' }}>
                <b>{hm(s.from)}–{endLabel(s.to)}</b>
                <span>{s.task === '休息' ? tr('休息', 'Break') : s.task ? taskParts(s.task).map(c => `${c}${taskName(c) ? ' ' + taskName(c) : ''}`).join(' ＋ ') : tr('（未安排）', '(unscheduled)')}</span>
              </button>
            )
          })}
          {canEdit && <button className="btn alt" onClick={() => setEdit({ post_id: pid, from: 0, to: 2, t1: '', t2: '' })}>＋ {tr('新增／覆蓋一段時間', 'Add / overwrite a time range')}</button>}
        </>
      )}
      {mode === 'all' && (
        <div className="pa-mx-wrap">
          <table className="pa-mx">
            <thead><tr><th className="pa-t">{tr('時間', 'Time')}</th>{posts.map(p => <th key={p.id}>{p.code.replace('崗', '')}<small>{(staffOf(p.staff_id) || {}).name || ''}</small></th>)}</tr></thead>
            <tbody>
              {Array.from({ length: 48 }, (_, i) => (
                <tr key={i}>
                  <td className="pa-t">{hm(i)}</td>
                  {posts.map(p => {
                    const t = ((slotsOf[p.id] || [])[i] || {}).task || ''
                    const [bg, fg] = t ? catColor(taskParts(t)[0]) : ['transparent', '#aab']
                    return <td key={p.id} style={{ background: bg, color: fg }} onClick={() => openSeg(p.id, segs(p.id).find(x => i >= x.from && i < x.to))}>{t === '休息' ? (en ? 'Br' : '休') : t}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{(posts.find(p => p.id === edit.post_id) || {}).code} {tr('安排', 'schedule')}</h2>
              <span className="sheet-hd-acts"><button className="mini" onClick={() => setEdit(null)}>{tr('取消', 'Cancel')}</button><button className="mini pri" onClick={apply}>{tr('套用', 'Apply')}</button></span></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('由', 'From')}</label>
                <select value={edit.from} onChange={e => setEdit({ ...edit, from: +e.target.value })}>{Array.from({ length: 48 }, (_, i) => <option key={i} value={i}>{hm(i)}</option>)}</select></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('至', 'To')}</label>
                <select value={edit.to} onChange={e => setEdit({ ...edit, to: +e.target.value })}>{Array.from({ length: 48 }, (_, i) => i + 1).map(i => <option key={i} value={i}>{endLabel(i)}</option>)}</select></div>
            </div>
            <div className="f-row"><label>{tr('任務', 'Task')}</label>
              <select value={edit.t1} onChange={e => setEdit({ ...edit, t1: e.target.value })}>
                <option value="">{tr('（清空，不安排）', '(clear)')}</option><option value="休息">{tr('休息', 'Break')}</option>
                {d.tasks.filter(t => t.active).map(t => <option key={t.id} value={t.code}>{t.code} {taskShort(en, t)}</option>)}
              </select></div>
            {edit.t1 && edit.t1 !== '休息' && <div className="f-row"><label>{tr('同時加一個任務（可選）', 'Add a second task (optional)')}</label>
              <select value={edit.t2} onChange={e => setEdit({ ...edit, t2: e.target.value })}>
                <option value="">{tr('（不加）', '(none)')}</option>
                {d.tasks.filter(t => t.active && t.code !== edit.t1).map(t => <option key={t.id} value={t.code}>{t.code} {taskShort(en, t)}</option>)}
              </select></div>}
            <p className="src-note">{tr('會覆蓋所選時間內原有安排。', 'This overwrites the existing schedule in the selected time range.')}</p>
          </div>
        </div>
      )}
    </>
  )
}

/* ───────── 任務代碼 ───────── */
function Tasks({ d, load, log, canEdit }) {
  const { en, tr } = useL()
  const [edit, setEdit] = useState(null)
  const [q, setQ] = useState('')
  const list = d.tasks.filter(t => !q.trim() || (t.code + t.short + t.detail + (t.short_en || '') + (t.detail_en || '')).toLowerCase().includes(q.trim().toLowerCase()))
  const cats = [...new Set(list.map(t => t.cat || '其他'))]
  async function save() {
    const f = edit
    const row = { cat: f.cat, short: f.short.trim(), detail: f.detail.trim(), short_en: (f.short_en || '').trim(), detail_en: (f.detail_en || '').trim(), note: f.note.trim(), flag: f.flag, active: f.active }
    try {
      if (f.id) { await api.dbUpdate('pa_tasks', f.id, row); await log('修改任務 ' + f.code, { after: row }) }
      else { if (!f.code.trim()) { toast(tr('請填任務代碼', 'Task code required')); return } await api.dbInsert('pa_tasks', { ...row, code: f.code.trim(), sort_order: d.tasks.length + 1 }); await log('新增任務 ' + f.code) }
      toast(tr('已儲存', 'Saved')); setEdit(null); load()
    } catch (ex) { toast(tr('儲存失敗：', 'Save failed: ') + ex.message) }
  }
  return (
    <>
      <div className="fstk"><input className="search-inp" placeholder={tr('🔍 搜尋任務代碼、名稱、內容', '🔍 Search code, name, detail')} value={q} onChange={e => setQ(e.target.value)} /></div>
      {cats.map(c => (
        <div key={c}>
          <div className="bh-grp">{c}<span>{list.filter(t => (t.cat || '其他') === c).length}</span></div>
          {list.filter(t => (t.cat || '其他') === c).map(t => {
            const [bg, fg] = catColor(t.code)
            return (
              <button className="pa-card" key={t.id} onClick={() => canEdit && setEdit({ ...t })} style={{ opacity: t.active ? 1 : .5, cursor: canEdit ? 'pointer' : 'default' }}>
                <span className="pa-code" style={{ background: bg, color: fg }}>{t.code}</span>
                <span className="pa-main"><b>{taskShort(en, t)}{t.flag && <small className="pa-flag">{en ? 'To confirm' : t.flag}</small>}</b><span className="pa-sub">{taskDetail(en, t) || '—'}</span>{t.note && !en && <span className="pa-warn">{t.note}</span>}</span>
              </button>
            )
          })}
        </div>
      ))}
      {canEdit && <button className="fab" onClick={() => setEdit({ id: null, code: '', cat: '', short: '', detail: '', short_en: '', detail_en: '', note: '', flag: '', active: true })}>＋</button>}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{edit.id ? `${tr('編輯', 'Edit')} ${edit.code}` : tr('新增任務', 'New task')}</h2>
              <span className="sheet-hd-acts"><button className="mini" onClick={() => setEdit(null)}>{tr('取消', 'Cancel')}</button><button className="mini pri" onClick={save}>{tr('儲存', 'Save')}</button></span></div>
            {!edit.id && <div className="f-row"><label>{tr('任務代碼', 'Task code')}</label><input value={edit.code} onChange={e => setEdit({ ...edit, code: e.target.value })} placeholder="M17" /></div>}
            <div className="f-row"><label>{tr('類別', 'Category')}</label><input value={edit.cat} onChange={e => setEdit({ ...edit, cat: e.target.value })} /></div>
            <div className="f-row"><label>{tr('簡稱（中文）', 'Short name (Chinese)')}</label><input value={edit.short} onChange={e => setEdit({ ...edit, short: e.target.value })} /></div>
            <div className="f-row"><label>{tr('簡稱（English）', 'Short name (English)')}</label><input value={edit.short_en || ''} onChange={e => setEdit({ ...edit, short_en: e.target.value })} /></div>
            <div className="f-row"><label>{tr('詳細內容及標準（中文）', 'Detail (Chinese)')}</label><textarea rows={3} value={edit.detail} onChange={e => setEdit({ ...edit, detail: e.target.value })} /></div>
            <div className="f-row"><label>{tr('詳細內容及標準（English）', 'Detail (English)')}</label><textarea rows={3} value={edit.detail_en || ''} onChange={e => setEdit({ ...edit, detail_en: e.target.value })} /></div>
            {edit.note && <p className="pa-warn">{edit.note}</p>}
            {edit.flag && <button className="btn alt" onClick={() => setEdit({ ...edit, flag: '', note: '' })}>✓ {tr('已確認，取消「', 'Confirmed — clear “')}{edit.flag}{tr('」標記', '” flag')}</button>}
            <button className="btn ghost" onClick={() => setEdit({ ...edit, active: !edit.active })}>{edit.active ? tr('停用此任務', 'Disable this task') : tr('重新啟用', 'Re-enable')}</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ───────── 員工資料 ───────── */
function StaffView({ d, load, log, canEdit }) {
  const { en, tr } = useL()
  const [edit, setEdit] = useState(null)
  const [report, setReport] = useState(false)
  const [f, setF] = useState({ kind: '', gender: '', nat: '', lang: '' })
  const list = d.staff.filter(s => s.active && (!f.kind || s.kind === f.kind) && (!f.gender || s.gender === f.gender) && (!f.nat || s.nationality === f.nat) && (!f.lang || (s.langs || []).includes(f.lang)))
  const gone = d.staff.filter(s => !s.active)
  const gLabel = g => (en ? ({ 男: 'Male', 女: 'Female' }[g] || '') : g)
  async function save() {
    const e = edit
    const row = { name: e.name.trim(), kind: e.kind, gender: e.gender, nationality: e.nationality, langs: e.langs, phone: e.phone.trim(), notes: e.notes.trim(), old_name: e.old_name, rest_kind: e.rest_kind, rest_weekdays: e.rest_weekdays, rest_dates: e.rest_dates, active: e.active }
    if (!row.name) { toast(tr('請填姓名', 'Name required')); return }
    try {
      if (e.id) { await api.dbUpdate('pa_staff', e.id, row); await log('修改員工 ' + row.name) }
      else { await api.dbInsert('pa_staff', { ...row, sort_order: d.staff.length + 1 }); await log('新增員工 ' + row.name) }
      toast(tr('已儲存', 'Saved')); setEdit(null); load()
    } catch (ex) { toast(tr('儲存失敗：', 'Save failed: ') + ex.message) }
  }
  const tg = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  const sel = (key, label, opts, lab) => <select className="df-sel" value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })}><option value="">{label}</option>{opts.map(o => <option key={o} value={o}>{lab ? lab(o) : o}</option>)}</select>
  // 匯出：姓名、類別、性別、上班—收工、主要負責區域（按崗位分類）
  const postsOf = s => d.posts.filter(p => p.active && p.staff_id === s.id)
  const reportData = () => {
    const rows = d.staff.filter(s => s.active).map(s => { const p = postsOf(s)[0]; return { s, p } })
    const grp = x => (x.p ? x.p.grp : '未分配崗位')
    const names = [...GRPS, '未分配崗位']
    return {
      filterText: tr('在職員工', 'Active staff'),
      cols: [tr('姓名', 'Name'), tr('類別', 'Type'), tr('性別', 'Gender'), tr('上班—收工', 'Shift'), tr('主要負責區域', 'Main area')],
      groups: names.map(n => ({ name: n === '未分配崗位' ? tr('未分配崗位', 'No post assigned') : grpName(en, n), rows: rows.filter(x => grp(x) === n).map(({ s, p }) => ({ cells: [s.name, en ? KIND_EN[s.kind] : s.kind, gLabel(s.gender) || '—', p ? `${p.start_time}—${p.end_time}` : '—', p ? (areaOf(en, p) || p.code) : '—'] })) })).filter(g => g.rows.length),
    }
  }
  return (
    <>
      <ToolBar label={tr(`共 ${list.length} 人`, `${list.length} staff`)}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="fstk">
        <div className="df-grid df-grid4">
          {sel('kind', tr('類別', 'Type'), KINDS, k => (en ? KIND_EN[k] : k))}{sel('gender', tr('性別', 'Gender'), ['男', '女'], gLabel)}{sel('nat', tr('國籍', 'Nationality'), NATS, n => (en ? NAT_EN[n] : n))}{sel('lang', tr('語言', 'Language'), LANGS, l => (en ? LANG_EN[l] : l))}
        </div>
      </div>
      {list.map(s => {
        const p = postsOf(s)[0]
        return (
          <button className="pa-card" key={s.id} onClick={() => canEdit && setEdit({ ...s, langs: s.langs || [], rest_weekdays: s.rest_weekdays || [], rest_dates: s.rest_dates || [] })} style={canEdit ? undefined : { cursor: 'default' }}>
            <span className="pa-code" style={{ fontSize: 15 }}>{s.name.slice(0, 2)}</span>
            <span className="pa-main">
              <b>{s.name}<small className={`pa-kind k-${s.kind}`}>{en ? KIND_EN[s.kind] : s.kind}</small></b>
              <span>{[gLabel(s.gender), en ? NAT_EN[s.nationality] || s.nationality : s.nationality, (s.langs || []).map(l => (en ? LANG_EN[l] : l)).join(en ? ' / ' : '／')].filter(Boolean).join(' · ') || tr('（未填：性別、國籍、語言）', '(gender, nationality, language not filled)')}</span>
              {p && <span className="pa-sub">{p.code} · {p.start_time}—{p.end_time} · {areaOf(en, p) || '—'}</span>}
              <span className="pa-sub">{s.rest_kind === 'weekly2' ? tr(`每週休 2 天${(s.rest_weekdays || []).length ? '：週' + s.rest_weekdays.map(w => WD[w]).join('、週') : ''}`, `2 days off weekly${(s.rest_weekdays || []).length ? ': ' + s.rest_weekdays.map(w => WD_EN[w]).join(', ') : ''}`) : s.rest_kind === 'monthly1' ? tr(`每月休 1 天${(s.rest_dates || []).length ? '：' + s.rest_dates.slice(-1)[0] : ''}`, `1 day off monthly${(s.rest_dates || []).length ? ': ' + s.rest_dates.slice(-1)[0] : ''}`) : ''}</span>
            </span>
          </button>
        )
      })}
      {gone.length > 0 && <p className="src-note" style={{ margin: '10px 4px' }}>{tr('已停用：', 'Inactive: ')}{gone.map(s => s.name).join('、')}</p>}
      {canEdit && <button className="fab" onClick={() => setEdit({ id: null, name: '', kind: '外判', gender: '', nationality: '', langs: [], phone: '', notes: '', old_name: '', rest_kind: 'monthly1', rest_weekdays: [], rest_dates: [], active: true })}>＋</button>}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{edit.id ? edit.name : tr('新增員工', 'New staff')}</h2>
              <span className="sheet-hd-acts"><button className="mini" onClick={() => setEdit(null)}>{tr('取消', 'Cancel')}</button><button className="mini pri" onClick={save}>{tr('儲存', 'Save')}</button></span></div>
            <div className="f-row"><label>{tr('姓名', 'Name')}</label><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
            {edit.old_name && <p className="src-note">{tr('舊名單名稱：', 'Previous name: ')}{edit.old_name}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('類別', 'Type')}</label><select value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value, rest_kind: e.target.value === 'HSKP' ? 'weekly2' : 'monthly1' })}>{KINDS.map(k => <option key={k} value={k}>{en ? KIND_EN[k] : k}</option>)}</select></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('性別', 'Gender')}</label><select value={edit.gender} onChange={e => setEdit({ ...edit, gender: e.target.value })}><option value="">{tr('（未填）', '(not set)')}</option><option value="男">{tr('男', 'Male')}</option><option value="女">{tr('女', 'Female')}</option></select></div>
            </div>
            <div className="f-row"><label>{tr('國籍', 'Nationality')}</label><select value={edit.nationality} onChange={e => setEdit({ ...edit, nationality: e.target.value })}><option value="">{tr('（未填）', '(not set)')}</option>{NATS.map(n => <option key={n} value={n}>{en ? NAT_EN[n] : n}</option>)}</select></div>
            <div className="f-row"><label>{tr('識講（可多選）', 'Languages spoken')}</label>
              <div className="chips wrap">{LANGS.map(l => <button key={l} className={`chip ${edit.langs.includes(l) ? 'on' : ''}`} onClick={() => setEdit({ ...edit, langs: tg(edit.langs, l) })}>{en ? LANG_EN[l] : l}</button>)}</div></div>
            {edit.kind === 'HSKP'
              ? <div className="f-row"><label>{tr('固定周假（HSKP 每週 2 天）', 'Weekly days off (HSKP: 2 days)')}</label>
                <div className="chips wrap">{WD.map((w, i) => <button key={i} className={`chip ${edit.rest_weekdays.includes(i) ? 'on' : ''}`} onClick={() => setEdit({ ...edit, rest_weekdays: tg(edit.rest_weekdays, i) })}>{en ? WD_EN[i] : '週' + w}</button>)}</div></div>
              : <div className="f-row"><label>{tr('休息日期（外判每月休 1 天）', 'Days off (outsourced: 1 per month)')}</label>
                <input type="date" value="" onChange={e => e.target.value && setEdit({ ...edit, rest_dates: [...edit.rest_dates, e.target.value].sort() })} />
                <div className="chips wrap" style={{ marginTop: 6 }}>{edit.rest_dates.map(x => <button key={x} className="chip on" onClick={() => setEdit({ ...edit, rest_dates: edit.rest_dates.filter(y => y !== x) })}>{x} ✕</button>)}</div></div>}
            <div className="f-row"><label>{tr('電話', 'Phone')}</label><input inputMode="tel" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></div>
            <div className="f-row"><label>{tr('備註', 'Notes')}</label><input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
            <button className="btn ghost" onClick={() => setEdit({ ...edit, active: !edit.active })}>{edit.active ? tr('標記為已離職／停用', 'Mark as left / inactive') : tr('重新啟用', 'Re-enable')}</button>
          </div>
        </div>
      )}
      {report && <ReportModal title={tr('公共地區員工名單', 'Public Area Staff Roster')} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}

/* ───────── 改動紀錄 ───────── */
function LogView() {
  const { tr } = useL()
  const [rows, setRows] = useState(null)
  useEffect(() => { api.dbSelect('pa_log', { order: 'id', asc: false }).then(r => setRows(r.slice(0, 100))).catch(() => setRows([])) }, [])
  if (!rows) return <div className="note">{tr('載入中…', 'Loading…')}</div>
  return (
    <>
      {rows.length === 0 && <div className="note">{tr('暫時冇改動紀錄', 'No changes recorded yet')}</div>}
      {rows.map(r => (
        <div className="pa-log" key={r.id}><b>{r.what}</b><span>{r.by_name || '—'} · {String(r.at).replace('T', ' ').slice(0, 16)}</span></div>
      ))}
    </>
  )
}
