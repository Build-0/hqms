import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import Icon from '../components/Icon'
import { ToolBar, ExportBtn } from '../components/ui'
import { ReportModal, ListReport } from '../components/Reports'
import { useBack } from '../lib/nav'
import { publicPerm } from '../lib/accounts'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'

// 公共地區管理（管理員可改；公眾主管可查看）。右上角可切換 中文／English。
const GRPS = ['商場', '前區', '後區', '深度清潔', '管理支援']   // 「替補」另外加喺 Roster，唔放喺新增崗位預設
const GRP_EN = { 商場: 'Mall', 前區: 'Front of house', 後區: 'Back of house', 深度清潔: 'Deep cleaning', 管理支援: 'Supervisors & Captains', 替補: 'Relief', 其他: 'Other' }
const KINDS = ['HSKP', '外判']
const POS_EN = { 組長: 'Captain', 主管: 'Supervisor', 替補: 'Relief' }
const KIND_EN = { HSKP: 'HSKP', 外判: 'Pro-Cleaning', 主管: 'Supervisor', 替補: 'Relief' }
const NATS = ['中國', '菲律賓', '越南', '緬甸', '印尼', '尼泊爾', '其他']
const NAT_EN = { 中國: 'China', 菲律賓: 'Philippines', 越南: 'Vietnam', 緬甸: 'Myanmar', 印尼: 'Indonesia', 尼泊爾: 'Nepal', 其他: 'Other' }
const LANGS = ['粵語', '普通話', '英語']
const LANG_EN = { 粵語: 'Cantonese', 普通話: 'Mandarin', 英語: 'English' }
const WD = ['日', '一', '二', '三', '四', '五', '六']
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hm = i => `${String(Math.floor(i / 2) % 24).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
const endLabel = i => (i >= 48 ? '24:00' : hm(i))
const catColor = code => ({ M: ['#dff0ee', '#17624f'], F: ['#fbecd0', '#8a5a00'], B: ['#dfeaf7', '#245a9e'], D: ['#efe3f7', '#6a3d99'], G: ['#e8f1d8', '#4a6b1c'], S: ['#f6e0e0', '#9e3a3a'] }[String(code || '')[0]] || ['#eceff2', '#5b6773'])
// 每日工時：上班—收工（可跨日）= 總工時；扣除看板上標為「休息」嘅時間 = 實際工作時數
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m }
const num = n => String(Math.round(n * 10) / 10)
const hoursOf = (p, slots) => {
  const st = toMin(p.start_time), e0 = toMin(p.end_time), en = e0 <= st ? e0 + 1440 : e0
  const gross = (en - st) / 60
  const brk = slots.filter(x => x.post_id === p.id && x.task === '休息').length * 0.5
  return { gross, brk, net: Math.max(0, gross - brk) }
}
const hoursText = (en, h) => (en ? `${num(h.gross)} h total · ${num(h.net)} h net of break` : `全日 ${num(h.gross)} 小時 · 扣休息淨 ${num(h.net)} 小時`)
// 崗位編號：英文版顯示 Post 1／Relief 1
const codeLabel = (en, c) => (en ? String(c).replace(/^崗/, 'Post ').replace(/^替/, 'Relief ') : c)
const codeShort = (en, c) => (en ? String(c).replace(/^崗/, '').replace(/^替/, 'R') : String(c).replace('崗', ''))
const taskParts = t => String(t || '').split('+').map(x => x.trim()).filter(Boolean)

const LangCtx = createContext({ en: false, tr: a => a })

export default function PublicAreas({ session }) {
  const [view, setView] = useState(null)       // null 選單／roster／board／tasks
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [en, setEn] = useState(() => { try { return localStorage.getItem('pa_lang') === 'en' } catch { return false } })
  // 語言喺「設定」撳：設定視窗寫入 localStorage 再發出 pa-lang 事件
  useEffect(() => {
    const fn = () => { try { setEn(localStorage.getItem('pa_lang') === 'en') } catch { /* 讀唔到就保持現狀 */ } }
    window.addEventListener('pa-lang', fn)
    return () => window.removeEventListener('pa-lang', fn)
  }, [])
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
      <div className="df-wrap pa-wrap">
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>{tr('讀取失敗：', 'Failed to load: ')}{err}</p></div>}
        {!view && (
          <div className="home-grid">
            {[['roster', tr('人員崗位', 'Staff & posts'), 'people', '#1f7a6d', tr(`${d.staff.filter(x => x.active).length} 位在職 · ${d.posts.filter(p => p.active).length} 個崗位`, `${d.staff.filter(x => x.active).length} staff · ${d.posts.filter(p => p.active).length} posts`)],
              ['tasks', tr('任務代碼', 'Task codes'), 'book', '#b5603a', tr(`${d.tasks.length} 個任務`, `${d.tasks.length} tasks`)],
              ['board', tr('24 小時看板', '24-hour board'), 'calendar', '#4a6fa5', tr('每崗每半小時', 'Every 30 min per post')],
              ['annual', tr('年度清潔', 'Annual cleaning'), 'drop', '#3a8fb5', tr('水池、寫字樓、跟進表', 'Pond, offices, follow-up')],
            ].map(([k, t, ic, co, sb]) => (
              <button className="home-item" key={k} onClick={() => setView(k)}>
                <span className="hi-circle" style={{ background: co + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={co} width={2.2} /></span>
                <span className="hi-label">{t}</span>
                <span className="hi-sub">{sb}</span>
              </button>
            ))}
          </div>
        )}
        {view === 'roster' && <Roster {...ctx} />}
        {view === 'board' && <Board {...ctx} />}
        {view === 'annual' && <Annual {...ctx} />}
        {view === 'tasks' && <Tasks {...ctx} />}
      </div>
    </LangCtx.Provider>
  )
}

const useL = () => useContext(LangCtx)
const grpName = (en, g) => (en ? GRP_EN[g] || g : g)
const areaOf = (en, p) => (en && p.work_area_en ? p.work_area_en : p.work_area)
const taskShort = (en, t) => (en && t.short_en ? t.short_en : t.short)
const taskDetail = (en, t) => (en && t.detail_en ? t.detail_en : t.detail)

/* ───────── 人員崗位（人 + 崗位合併；一人一崗，冇崗位嘅人放「替補」） ───────── */
function Roster({ d, load, log, staffOf, canEdit }) {
  const { en, tr } = useL()
  const [edit, setEdit] = useState(null)
  const [report, setReport] = useState(false)
  const [f, setF] = useState({ kind: '', pos: '', gender: '', nat: '', lang: '' })
  const posts = d.posts.filter(p => p.active).sort((a, b) => a.sort_order - b.sort_order)
  const gLabel = g => (en ? ({ 男: 'Male', 女: 'Female' }[g] || '') : g)
  const pass = s => !s ? !(f.kind || f.pos || f.gender || f.nat || f.lang) : (!f.kind || s.kind === f.kind) && (!f.pos || (f.pos === 'none' ? !s.position : s.position === f.pos)) && (!f.gender || s.gender === f.gender) && (!f.nat || s.nationality === f.nat) && (!f.lang || (s.langs || []).includes(f.lang))
  const shown = posts.filter(p => pass(staffOf(p.staff_id)))
  const grpOrder = [...GRPS, '替補']
  const groups = [...grpOrder, ...new Set(shown.map(p => p.grp).filter(g => !grpOrder.includes(g)))].map(g => ({ g, items: shown.filter(p => p.grp === g) })).filter(x => x.items.length)
  const gone = d.staff.filter(s => !s.active)
  const tg = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  const sel = (key, label, opts, lab) => <select className="df-sel" value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })}><option value="">{label}</option>{opts.map(o => <option key={o} value={o}>{lab ? lab(o) : o}</option>)}</select>
  const hrs = p => (p.start_time && p.end_time ? hoursOf(p, d.slots) : null)
  const flagText = p => (en ? ({ 替班: 'Relief', 外判替代中: 'Covered by Pro-Cleaning', 替班待確認: 'Relief TBC' }[p.flag] || 'To confirm') : p.flag)

  const reportData = () => ({
    filterText: tr('在職員工', 'Active staff'),
    cols: [tr('崗位', 'Post'), tr('姓名', 'Name'), tr('類別', 'Type'), tr('性別', 'Gender'), tr('國籍', 'Nationality'), tr('上班—收工', 'Shift'), tr('工時 總／淨', 'Hours total / net'), tr('主要負責區域', 'Main area')],
    groups: groups.map(g => ({ name: grpName(en, g.g), rows: g.items.map(p => {
      const s = staffOf(p.staff_id) || {}; const h = hrs(p)
      return { cells: [codeLabel(en, p.code), s.name || '—', s.kind ? (en ? KIND_EN[s.kind] : s.kind) + (s.position ? ' · ' + (en ? POS_EN[s.position] || s.position : s.position) : '') : '—', gLabel(s.gender) || '—', (en ? NAT_EN[s.nationality] : s.nationality) || '—', p.start_time && p.end_time ? `${p.start_time}‑${p.end_time}` : '—', h ? `${num(h.gross)} / ${num(h.net)}` : '—', areaOf(en, p) || '—'] }
    }) })),
  })

  const blank = { id: null, post_id: null, name: '', kind: '外判', position: '', gender: '', nationality: '', langs: [], phone: '', notes: '', old_name: '', rest_kind: 'monthly1', rest_weekdays: [], rest_dates: [], active: true, code: `崗${d.posts.length + 1}`, grp: GRPS[0], start_time: '09:00', end_time: '18:00', break_text: '', work_area: '', work_area_en: '', pnotes: '', flag: '' }
  const open = p => {
    const s = staffOf(p.staff_id)
    setEdit(s
      ? { ...s, langs: s.langs || [], rest_weekdays: s.rest_weekdays || [], rest_dates: s.rest_dates || [], post_id: p.id, code: p.code, grp: p.grp, start_time: p.start_time, end_time: p.end_time, break_text: p.break_text, work_area: p.work_area, work_area_en: p.work_area_en || '', pnotes: p.notes, flag: p.flag }
      : { ...blank, id: null, post_id: p.id, code: p.code, grp: p.grp, start_time: p.start_time, end_time: p.end_time, break_text: p.break_text, work_area: p.work_area, work_area_en: p.work_area_en || '', pnotes: p.notes, flag: p.flag })
  }
  async function save() {
    const e = edit
    if (!e.name.trim()) { toast(tr('請填姓名', 'Name required')); return }
    const srow = { name: e.name.trim(), kind: e.kind, gender: e.gender, nationality: e.nationality, position: e.position || '', langs: e.langs, phone: e.phone.trim(), notes: e.notes.trim(), old_name: e.old_name, rest_kind: e.rest_kind, rest_weekdays: e.rest_weekdays, rest_dates: e.rest_dates, active: e.active }
    const prow = { grp: e.grp, work_area: e.work_area.trim(), work_area_en: e.work_area_en || '', start_time: e.start_time || '', end_time: e.end_time || '', break_text: e.break_text.trim(), notes: (e.pnotes || '').trim(), flag: e.flag }
    try {
      let sid = e.id
      if (sid) { await api.dbUpdate('pa_staff', sid, srow); await log('修改員工 ' + srow.name) }
      else { const s = await api.dbInsert('pa_staff', { ...srow, sort_order: d.staff.length + 1 }); sid = s.id; await log('新增員工 ' + srow.name) }
      if (e.post_id) await api.dbUpdate('pa_posts', e.post_id, { ...prow, staff_id: sid })
      else {
        const p = await api.dbInsert('pa_posts', { ...prow, staff_id: sid, code: e.code.trim(), sort_order: d.posts.length + 1 })
        await api.dbInsertMany('pa_slots', Array.from({ length: 48 }, (_, i) => ({ post_id: p.id, slot: i, task: '' })))
        await log('新增崗位 ' + e.code.trim())
      }
      toast(tr('已儲存', 'Saved')); setEdit(null); load()
    } catch (ex) { toast(tr('儲存失敗：', 'Save failed: ') + ex.message) }
  }
  async function stopPost() {
    try { await api.dbUpdate('pa_posts', edit.post_id, { active: false }); await log('停用崗位 ' + edit.code); toast(tr('已停用崗位', 'Post disabled')); setEdit(null); load() } catch (ex) { toast(ex.message) }
  }
  return (
    <>
      <ToolBar label={tr(`共 ${shown.length} 個崗位`, `${shown.length} posts`)}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="fstk">
        <div className="df-grid3">
          {sel('kind', tr('類別', 'Type'), KINDS, k => (en ? KIND_EN[k] : k))}{sel('pos', tr('職級', 'Position'), ['none', '組長', '主管', '替補'], p => (p === 'none' ? tr('一般', 'Regular') : en ? POS_EN[p] : p))}{sel('gender', tr('性別', 'Gender'), ['男', '女'], gLabel)}{sel('nat', tr('國籍', 'Nationality'), NATS, n => (en ? NAT_EN[n] : n))}{sel('lang', tr('語言', 'Language'), LANGS, l => (en ? LANG_EN[l] : l))}
        </div>
      </div>
      {groups.map(g => (
        <div key={g.g}>
          <div className="bh-grp">{grpName(en, g.g)}<span>{g.items.length}</span></div>
          <div className="pa-grid">
            {g.items.map(p => {
              const s = staffOf(p.staff_id); const h = hrs(p)
              const person = s ? [gLabel(s.gender), en ? NAT_EN[s.nationality] || s.nationality : s.nationality].filter(Boolean).join(' · ') : ''
              return (
                <button className="pa-sq" key={p.id} onClick={() => canEdit && open(p)} style={canEdit ? undefined : { cursor: 'default' }}>
                  <span className="pa-sq-top"><em>{codeLabel(en, p.code)}</em>{p.flag && <small className="pa-flag">{flagText(p)}</small>}</span>
                  <b className="pa-sq-name">{s ? s.name : tr('（未指派）', '(unassigned)')}</b>
                  <span className="pa-sq-tags">{s && <small className={`pa-kind k-${s.kind}`}>{en ? KIND_EN[s.kind] : s.kind}</small>}{s && s.position && <small className="pa-kind k-pos">{en ? POS_EN[s.position] || s.position : s.position}</small>}</span>
                  {person && <span className="pa-sq-person">{person}</span>}
                  <span className="pa-sq-post">
                    {p.start_time && p.end_time ? <b>{p.start_time}–{p.end_time}</b> : <span>{tr('未設定時間', 'No shift set')}</span>}
                    {h && <span className="pa-hrs">⏱ {num(h.gross)}h · {tr('淨', 'net')} {num(h.net)}h</span>}
                    <span className="pa-sq-area">{areaOf(en, p) || '—'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {gone.length > 0 && <p className="src-note" style={{ margin: '10px 4px' }}>{tr('已離職／停用：', 'Inactive: ')}{gone.map(s => s.name).join('、')}</p>}
      {canEdit && <button className="fab" onClick={() => setEdit({ ...blank })}>＋</button>}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{edit.id ? edit.name : tr('新增人員／崗位', 'New staff / post')}</h2>
              <span className="sheet-hd-acts"><button className="mini" onClick={() => setEdit(null)}>{tr('取消', 'Cancel')}</button><button className="mini pri" onClick={save}>{tr('儲存', 'Save')}</button></span></div>
            <div className="pa-sep first">{tr('人員資料', 'Staff')}</div>
            <div className="f-row"><label>{tr('姓名', 'Name')}</label><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
            {edit.old_name && <p className="src-note">{tr('舊名單名稱：', 'Previous name: ')}{edit.old_name}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('類別', 'Type')}</label><select value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value, rest_kind: e.target.value === 'HSKP' ? 'weekly2' : 'monthly1' })}>{KINDS.map(k => <option key={k} value={k}>{en ? KIND_EN[k] : k}</option>)}</select></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('職級', 'Position')}</label><select value={edit.position || ''} onChange={e => setEdit({ ...edit, position: e.target.value })}><option value="">{tr('（一般）', '(none)')}</option><option value="組長">{tr('組長', 'Captain')}</option><option value="主管">{tr('主管', 'Supervisor')}</option><option value="替補">{tr('替補', 'Relief')}</option></select></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('性別', 'Gender')}</label><select value={edit.gender} onChange={e => setEdit({ ...edit, gender: e.target.value })}><option value="">{tr('（未填）', '(not set)')}</option><option value="男">{tr('男', 'Male')}</option><option value="女">{tr('女', 'Female')}</option></select></div>
            </div>
            <div className="f-row"><label>{tr('國籍', 'Nationality')}</label><select value={edit.nationality} onChange={e => setEdit({ ...edit, nationality: e.target.value })}><option value="">{tr('（未填）', '(not set)')}</option>{NATS.map(n => <option key={n} value={n}>{en ? NAT_EN[n] : n}</option>)}</select></div>
            <div className="f-row"><label>{tr('識講（可多選）', 'Languages spoken')}</label>
              <div className="chips wrap">{LANGS.map(l => <button key={l} className={`chip ${edit.langs.includes(l) ? 'on' : ''}`} onClick={() => setEdit({ ...edit, langs: tg(edit.langs, l) })}>{en ? LANG_EN[l] : l}</button>)}</div></div>
            {edit.kind !== 'HSKP' && <div className="f-row"><label>{tr('休息日期（外判每月休 1 天）', 'Days off (outsourced: 1 per month)')}</label>
              <input type="date" value="" onChange={e => e.target.value && setEdit({ ...edit, rest_dates: [...edit.rest_dates, e.target.value].sort() })} />
              <div className="chips wrap" style={{ marginTop: 6 }}>{edit.rest_dates.map(x => <button key={x} className="chip on" onClick={() => setEdit({ ...edit, rest_dates: edit.rest_dates.filter(y => y !== x) })}>{x} ✕</button>)}</div></div>}
            <div className="f-row"><label>{tr('人員備註', 'Staff notes')}</label><input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
            <div className="pa-sep">{tr('崗位資料', 'Post')}</div>
            {!edit.post_id && <div className="f-row"><label>{tr('崗位編號', 'Post code')}</label><input value={edit.code} onChange={e => setEdit({ ...edit, code: e.target.value })} /></div>}
            <div className="f-row"><label>{tr('分類', 'Group')}</label>
              <select value={edit.grp} onChange={e => setEdit({ ...edit, grp: e.target.value })}>{[...GRPS, '替補'].map(g => <option key={g} value={g}>{grpName(en, g)}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('上班', 'Start')}</label><input type="time" value={edit.start_time} onChange={e => setEdit({ ...edit, start_time: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('收工', 'End')}</label><input type="time" value={edit.end_time} onChange={e => setEdit({ ...edit, end_time: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>{tr('休息時間', 'Break')}</label><input value={edit.break_text} onChange={e => setEdit({ ...edit, break_text: e.target.value })} placeholder="13:00–13:30, 18:30–19:00" /></div>
            <div className="f-row"><label>{tr('負責區域（中文）', 'Area (Chinese)')}</label><input value={edit.work_area} onChange={e => setEdit({ ...edit, work_area: e.target.value })} /></div>
            <div className="f-row"><label>{tr('負責區域（English）', 'Area (English)')}</label><input value={edit.work_area_en || ''} onChange={e => setEdit({ ...edit, work_area_en: e.target.value })} /></div>
            <div className="f-row"><label>{tr('崗位備註', 'Post notes')}</label><input value={edit.pnotes || ''} onChange={e => setEdit({ ...edit, pnotes: e.target.value })} /></div>
            {edit.flag && <button className="btn alt" onClick={() => setEdit({ ...edit, flag: '' })}>✓ {tr('已確認，取消「', 'Confirmed — clear “')}{edit.flag}{tr('」標記', '” flag')}</button>}
            {edit.post_id && <button className="btn danger sm-quiet" onClick={stopPost}>{tr('停用這個崗位', 'Disable this post')}</button>}
            {edit.id && <button className="btn ghost sm-quiet" onClick={() => setEdit({ ...edit, active: !edit.active })}>{edit.active ? tr('標記為已離職／停用', 'Mark as left / inactive') : tr('重新啟用', 'Re-enable')}</button>}
          </div>
        </div>
      )}
      {report && <ReportModal title={tr('公共地區人員崗位表', 'Public Area Staff & Post Roster')} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}

/* ───────── 年度清潔（皇宮水池、後勤寫字樓、非日常清潔跟進） ───────── */
const ANNUAL_CATS = [
  ['pool', '皇宮水池清潔時間', 'Palace pond cleaning times'],
  ['office', '後勤寫字樓清潔時間表', 'Back-office cleaning schedule'],
  ['offroutine', '非日常清潔衛生跟進表', 'Non-routine cleaning follow-up'],
]
const ANNUAL_STATUS = ['待辦', '進行中', '已完成']
const ANNUAL_STATUS_EN = { 待辦: 'To do', 進行中: 'In progress', 已完成: 'Done' }

function Annual({ log, canEdit }) {
  const { en, tr } = useL()
  const [rows, setRows] = useState(null)
  const [cat, setCat] = useState(null)       // null：三張分類卡；否則顯示該分類項目
  useBack(!!cat, () => setCat(null), 2)
  const [edit, setEdit] = useState(null)
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  const load = () => api.dbSelect('pa_annual', { order: 'sort_order' }).then(r => { setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { load() }, [])
  if (!rows) return <div className="note">{tr('載入中…', 'Loading…')}</div>
  const catName = c => { const x = ANNUAL_CATS.find(a => a[0] === c); return en ? x[2] : x[1] }
  const ICONS = { pool: ['drop', '#3a8fb5'], office: ['hotel', '#7a6a4f'], offroutine: ['clean', '#8f7ac9'] }
  if (!cat) {
    return (
      <>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>{tr('讀取失敗：', 'Failed to load: ')}{err}</p></div>}
        <div className="home-grid">
          {ANNUAL_CATS.map(([k, zh, e]) => (
            <button className="home-item" key={k} onClick={() => setCat(k)}>
              <span className="hi-circle" style={{ background: ICONS[k][1] + '26', borderColor: 'transparent' }}><Icon name={ICONS[k][0]} size={33} color={ICONS[k][1]} width={2.2} /></span>
              <span className="hi-label">{en ? e : zh}</span>
              <span className="hi-sub">{tr(`${rows.filter(r => r.cat === k).length} 項`, `${rows.filter(r => r.cat === k).length} items`)}</span>
            </button>
          ))}
        </div>
      </>
    )
  }
  const list = rows.filter(r => r.cat === cat).sort((a, b) => String(a.plan_date || '9999').localeCompare(String(b.plan_date || '9999')) || a.sort_order - b.sort_order)
  const rangeText = r => (r.plan_date ? (r.end_date && r.end_date !== r.plan_date ? r.plan_date + ' → ' + r.end_date : r.plan_date) : '')
  const stLabel = s => (en ? ANNUAL_STATUS_EN[s] || s : s)
  async function save() {
    const e = edit
    if (!e.title.trim()) { toast(tr('請填項目', 'Item required')); return }
    const row = { cat: e.cat, title: e.title.trim(), area: e.area.trim(), freq: e.freq.trim(), plan_date: e.plan_date || null, end_date: e.end_date || null, status: e.status, notes: e.notes.trim() }
    try {
      if (e.id) { await api.dbUpdate('pa_annual', e.id, row); await log('修改年度清潔 ' + row.title) }
      else { await api.dbInsert('pa_annual', { ...row, sort_order: rows.length + 1 }); await log('新增年度清潔 ' + row.title) }
      toast(tr('已儲存', 'Saved')); setEdit(null); load()
    } catch (ex) { toast(tr('儲存失敗：', 'Save failed: ') + ex.message) }
  }
  async function del() {
    try { await api.dbDelete('pa_annual', edit.id); await log('刪除年度清潔 ' + edit.title); toast(tr('已刪除', 'Deleted')); setEdit(null); load() } catch (ex) { toast(ex.message) }
  }
  const reportData = () => ({
    filterText: catName(cat),
    cols: [tr('項目', 'Item'), tr('區域', 'Area'), tr('頻率', 'Frequency'), tr('日期（開始至結束）', 'Date (start – end)'), tr('狀態', 'Status'), tr('備註', 'Notes')],
    groups: [{ name: catName(cat), rows: list.map(r => ({ cells: [r.title, r.area || '—', r.freq || '—', rangeText(r) || '—', stLabel(r.status) || '—', r.notes || '—'] })) }],
  })
  return (
    <>
      <ToolBar label={tr(`共 ${list.length} 項`, `${list.length} items`)}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
      <div className="bh-grp">{catName(cat)}<span>{list.length}</span></div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>{tr('讀取失敗：', 'Failed to load: ')}{err}</p></div>}
      {list.length === 0 && !err && <p className="src-note" style={{ margin: '14px 4px' }}>{tr('暫時未有項目。', 'No items yet.')}{canEdit ? tr('撳右下角「＋」新增。', ' Tap “＋” to add.') : ''}</p>}
      <div className="pa-grid">
        {list.map(r => (
          <button className="pa-sq pa-an" key={r.id} onClick={() => canEdit && setEdit({ ...r, plan_date: r.plan_date || '', end_date: r.end_date || '' })} style={canEdit ? undefined : { cursor: 'default' }}>
            <span className="pa-sq-top"><em>{rangeText(r) || tr('未定日期', 'No date')}</em>{r.status && <small className={`pa-flag an-${r.status === '已完成' ? 'done' : 'todo'}`}>{stLabel(r.status)}</small>}</span>
            <b className="pa-sq-name">{r.title}</b>
            <span className="pa-sq-post">
              {r.area && <span>{r.area}</span>}
              {r.freq && <span className="pa-hrs">{r.freq}</span>}
              {r.notes && <span className="pa-sq-area">{r.notes}</span>}
            </span>
          </button>
        ))}
      </div>
      {canEdit && <button className="fab" onClick={() => setEdit({ id: null, cat, title: '', area: '', freq: '', plan_date: '', end_date: '', status: '待辦', notes: '' })}>＋</button>}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{edit.id ? edit.title : tr('新增項目', 'New item')}</h2>
              <span className="sheet-hd-acts"><button className="mini" onClick={() => setEdit(null)}>{tr('取消', 'Cancel')}</button><button className="mini pri" onClick={save}>{tr('儲存', 'Save')}</button></span></div>
            <div className="f-row"><label>{tr('類別', 'Category')}</label>
              <select value={edit.cat} onChange={e => setEdit({ ...edit, cat: e.target.value })}>{ANNUAL_CATS.map(([k, zh, e2]) => <option key={k} value={k}>{en ? e2 : zh}</option>)}</select></div>
            <div className="f-row"><label>{tr('項目', 'Item')}</label><input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} /></div>
            <div className="f-row"><label>{tr('區域', 'Area')}</label><input value={edit.area} onChange={e => setEdit({ ...edit, area: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('頻率', 'Frequency')}</label><input value={edit.freq} onChange={e => setEdit({ ...edit, freq: e.target.value })} placeholder={tr('例：每月一次', 'e.g. monthly')} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('開始日期', 'Start date')}</label><input type="date" value={edit.plan_date} onChange={e => setEdit({ ...edit, plan_date: e.target.value, end_date: edit.end_date && edit.end_date < e.target.value ? e.target.value : edit.end_date })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>{tr('結束日期', 'End date')}</label><input type="date" value={edit.end_date} min={edit.plan_date || undefined} onChange={e => setEdit({ ...edit, end_date: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>{tr('狀態', 'Status')}</label>
              <select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}><option value="">{tr('（未設定）', '(none)')}</option>{ANNUAL_STATUS.map(s => <option key={s} value={s}>{stLabel(s)}</option>)}</select></div>
            <div className="f-row"><label>{tr('備註', 'Notes')}</label><input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></div>
            {edit.id && <button className="btn danger sm-quiet" onClick={del}>{tr('刪除這項', 'Delete this item')}</button>}
          </div>
        </div>
      )}
      {report && <ReportModal title={tr('年度清潔', 'Annual cleaning') + ' · ' + catName(cat)} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={reportData()} /></ReportModal>}
    </>
  )
}

/* ───────── 24 小時看板 ───────── */
function Board({ d, load, log, staffOf, canEdit }) {
  const { en, tr } = useL()
  const posts = d.posts.filter(p => p.active).sort((a, b) => a.sort_order - b.sort_order)
  const [mode, setMode] = useState('all')       // all 總覽（預設）／post 按崗位
  const [pid, setPid] = useState(posts[0] ? posts[0].id : '')
  const [edit, setEdit] = useState(null)
  const [report, setReport] = useState(false)
  const [ov, setOv] = useState('sheet')       // 總覽顯示：sheet 橫向總表／codes 只顯示代碼
  const slotsOf = useMemo(() => {
    const m = {}
    d.slots.forEach(s => { (m[s.post_id] = m[s.post_id] || Array(48).fill(null))[s.slot] = s })
    return m
  }, [d.slots])
  const post = posts.find(p => p.id === pid)
  const taskName = code => { const t = d.tasks.find(x => x.code === code); return t ? taskShort(en, t) : '' }
  // 當值時間（上班—收工，可跨日）；之外嘅格標為「非當值」
  const onDuty = (p, i) => {
    const tm = x => { const [h, m] = x.split(':').map(Number); return h * 60 + m }
    const st = tm(p.start_time), e0 = tm(p.end_time), en = e0 <= st ? e0 + 1440 : e0
    return [i * 30, i * 30 + 1440].some(x => x + 30 > st && x < en)
  }
  const segs = id => {
    const arr = slotsOf[id] || []; const out = []; const p = posts.find(x => x.id === id)
    for (let i = 0; i < 48; i++) {
      const t = (arr[i] && arr[i].task) || ''
      const off = p ? !onDuty(p, i) && !t : false
      const last = out[out.length - 1]
      if (last && last.task === t && !!last.off === off) last.to = i + 1; else out.push({ from: i, to: i + 1, task: t, off })
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
  // 匯出：按崗位為一組，列出每段時間的任務（「按崗位」只出目前崗位；「總覽」出全部崗位）
  const taskText = s => (s.off ? tr('（非當值）', '(off duty)') : s.task === '休息' ? tr('休息', 'Break') : s.task ? taskParts(s.task).map(c => `${c}${taskName(c) ? ' ' + taskName(c) : ''}`).join(' + ') : tr('（未安排）', '(unscheduled)'))
  const boardReport = () => {
    const list = mode === 'post' && post ? [post] : posts
    return {
      filterText: mode === 'post' && post ? post.code : tr('全部崗位', 'All posts'),
      cols: [tr('時間', 'Time'), tr('任務', 'Task')],
      groups: list.map(p => ({ name: `${codeLabel(en, p.code)} · ${(staffOf(p.staff_id) || {}).name || tr('未指派', 'unassigned')}（${p.start_time}‑${p.end_time}）`, rows: segs(p.id).map(x => ({ cells: [`${hm(x.from)}‑${endLabel(x.to)}`, taskText(x)] })) })),
    }
  }
  // 橫向總表：崗位分兩批、時間分上下半日，共 4 頁；同一任務連續時間合併成一格
  const segIn = (pid, a, b) => { const out = []; segs(pid).forEach(x => { const f = Math.max(x.from, a), t = Math.min(x.to, b); if (t > f) out.push({ ...x, from: f, to: t }) }); return out }
  const matrixPages = (codesOnly = false) => {
    const pages = [{ ps: posts, a: 0, b: 48 }]
    return pages.map((pg, k) => {
      const starts = {}
      pg.ps.forEach(p => segIn(p.id, pg.a, pg.b).forEach(x => { starts[p.id + ':' + x.from] = x }))
      return (
        <div key={k} className={'mxr' + (k ? ' sf-page' : '')}>
          <table className={'mxr-t' + (codesOnly ? ' mxr-codes' : ' mxr-names')}>
            <thead><tr><th>{tr('時間', 'Time')}</th>{pg.ps.map(p => <th key={p.id}><b>{codeLabel(en, p.code)}</b><span>{(staffOf(p.staff_id) || {}).name || ''}</span><small>{p.start_time}‑{p.end_time}</small></th>)}</tr></thead>
            <tbody>
              {Array.from({ length: pg.b - pg.a }, (_, j) => pg.a + j).map(i => (
                <tr key={i}>
                  <td className="mxr-tm">{hm(i)}</td>
                  {pg.ps.map(p => {
                    const x = starts[p.id + ':' + i]
                    if (!x) return (segIn(p.id, pg.a, pg.b).some(y => i > y.from && i < y.to)) ? null : <td key={p.id} />
                    const [bg, fg] = x.task && x.task !== '休息' ? catColor(taskParts(x.task)[0]) : x.task === '休息' ? ['#eceff2', '#5b6773'] : ['#fff', '#aab']
                    const long = !codesOnly
                    const text = x.off ? '' : x.task === '休息' ? tr('休息', 'Break') : x.task ? taskParts(x.task).map(c => c + (long && taskName(c) ? ' ' + taskName(c) : '')).join(' ＋ ') : ''
                    return <td key={p.id} rowSpan={x.to - x.from} style={{ background: x.off ? '#f6f7f8' : bg, color: fg }}>{text}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    })
  }
  const openSeg = (post_id, s) => { if (!canEdit || !s) return; const [a, b] = taskParts(s.task); setEdit({ post_id, from: s.from, to: s.to, t1: a || '', t2: b || '' }) }
  return (
    <>
      <ToolBar label={mode === 'post' ? tr('目前崗位', 'Current post') : tr(`${posts.length} 個崗位`, `${posts.length} posts`)}><ExportBtn onClick={() => setReport(mode === 'all' ? 'matrix' : true)} /></ToolBar>
      <div className="seg" style={{ margin: '0 0 10px' }}>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>{tr(`總覽（${posts.length} 崗）`, `Overview (${posts.length} posts)`)}</button>
        <button className={mode === 'post' ? 'on' : ''} onClick={() => setMode('post')}>{tr('按崗位', 'By post')}</button>
      </div>
      {mode === 'post' && post && (
        <>
          <div className="fstk">
            <select className="df-sel" value={pid} onChange={e => setPid(e.target.value)} style={{ width: '100%' }}>
              {posts.map(p => <option key={p.id} value={p.id}>{codeLabel(en, p.code)} · {(staffOf(p.staff_id) || {}).name || tr('未指派', 'unassigned')}（{p.start_time}—{p.end_time}）</option>)}
            </select>
          </div>
          {segs(pid).map(s => {
            const [bg, fg] = catColor(taskParts(s.task)[0])
            return (
              <button key={s.from} className="pa-seg" onClick={() => openSeg(pid, s)} style={{ background: s.task ? bg : 'transparent', color: s.task ? fg : 'var(--sub)', borderStyle: s.task ? 'solid' : 'dashed', opacity: s.off ? 0.5 : 1, cursor: canEdit ? 'pointer' : 'default' }}>
                <b>{hm(s.from)}–{endLabel(s.to)}</b>
                <span>{s.off ? tr('（非當值）', '(off duty)') : s.task === '休息' ? tr('休息', 'Break') : s.task ? taskParts(s.task).map(c => `${c}${taskName(c) ? ' ' + taskName(c) : ''}`).join(' ＋ ') : tr('（未安排）', '(unscheduled)')}</span>
              </button>
            )
          })}
          {canEdit && <button className="btn alt" onClick={() => setEdit({ post_id: pid, from: 0, to: 2, t1: '', t2: '' })}>＋ {tr('新增／覆蓋一段時間', 'Add / overwrite a time range')}</button>}
        </>
      )}
      {mode === 'all' && (
        <>
        <div className="seg" style={{ margin: '0 0 8px' }}>
          <button className={ov === 'sheet' ? 'on' : ''} onClick={() => setOv('sheet')}>{tr('橫向總表', 'Wide sheet')}</button>
          <button className={ov === 'codes' ? 'on' : ''} onClick={() => setOv('codes')}>{tr('只顯示代碼', 'Codes only')}</button>
        </div>
        {ov === 'sheet' ? (
          <>
            <div className="pa-sheet-wrap"><div className="rpt-print rpt-wide">{matrixPages(false)}</div></div>
          </>
        ) : (
        <div className="pa-mx-wrap">
          <table className="pa-mx">
            <thead><tr><th className="pa-t">{tr('時間', 'Time')}</th>{posts.map(p => <th key={p.id}>{codeShort(en, p.code)}<small>{(staffOf(p.staff_id) || {}).name || ''}</small></th>)}</tr></thead>
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
        </>
      )}
      {report === true && <ReportModal title={tr('24 小時看板', '24-Hour Board')} sub={todayStr()} onClose={() => setReport(false)}><ListReport data={boardReport()} /></ReportModal>}
      {report === 'matrix' && <ReportModal landscape a3 title={tr('24 小時看板總表', '24-Hour Board Matrix')} sub={todayStr()} onClose={() => setReport(false)}>{matrixPages(ov === 'codes')}</ReportModal>}
      {canEdit && edit && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{codeLabel(en, (posts.find(p => p.id === edit.post_id) || {}).code)} {tr('安排', 'schedule')}</h2>
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
            <button className="btn ghost sm-quiet" onClick={() => setEdit({ ...edit, active: !edit.active })}>{edit.active ? tr('停用此任務', 'Disable this task') : tr('重新啟用', 'Re-enable')}</button>
          </div>
        </div>
      )}
    </>
  )
}
