import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { useBack } from '../lib/nav'
import { ToolBar, ExportBtn } from '../components/ui'
import { ReportModal } from '../components/Reports'

// 機器培訓：
//  1) 機器掌握：人員 × 機器 矩陣，睇邊個已掌握邊部機器（撳格切換）
//  2) 培訓場次：簽到表印出嚟由大家手寫簽名；之後喺系統撳「已簽到」登記（可連結某部機器，登記即標「已掌握」）
//  3) 人員名單
// 簽到表：一頁（A4 橫向，兩欄，中英對照），簽名格留空，列印後手寫；唔用電子簽名
const DEPTS = ['經理', 'Sup', '倉', 'Linen', 'PA', 'PM', 'ON', 'RA']
// 組別中英對照（簽到表同表格都用）
const DEPT_NAME = { 經理: ['經理', 'Manager'], Sup: ['主管', 'Supervisor'], 倉: ['倉庫', 'Warehouse'], Linen: ['布草', 'Linen'], PA: ['公共區域', 'Public Area'], PM: ['中更', 'Mid Shift'], ON: ['通宵', 'Overnight'], RA: ['房務員', 'Room Attendant'], 其他: ['其他', 'Others'] }
const deptLabel = d => (DEPT_NAME[d] ? DEPT_NAME[d][0] + ' ' + DEPT_NAME[d][1] : d)

export default function MachineTraining({ canEdit, who }) {
  const [people, setPeople] = useState(null)
  const [machines, setMachines] = useState([])
  const [skills, setSkills] = useState([])
  const [sessions, setSessions] = useState([])
  const [signs, setSigns] = useState([])
  const [tab, setTab] = useState('skill')          // skill 機器掌握／sess 培訓場次／ppl 人員名單
  const [sid, setSid] = useState(null)             // 開咗邊個場次
  const [sheet, setSheet] = useState(null)         // 新增場次
  const [psheet, setPsheet] = useState(null)       // 編輯人員
  const [msheet, setMsheet] = useState(null)       // 新增／改機器
  const [report, setReport] = useState(null)       // 'sign' 一頁簽到表／'skill' 掌握矩陣
  const [err, setErr] = useState('')
  useBack(!!sid, () => setSid(null), 2)
  const load = () => {
    api.dbSelect('mt_people', { order: 'sort_order' }).then(r => { setPeople(r); setErr('') }).catch(ex => { setErr(ex.message); setPeople(prev => prev || []) })
    api.dbSelect('mt_machines', { order: 'sort_order' }).then(setMachines).catch(() => setMachines([]))
    api.dbSelect('mt_skill', { order: 'id' }).then(setSkills).catch(() => setSkills([]))
    api.dbSelect('mt_sessions', { order: 'train_date', asc: false }).then(setSessions).catch(() => setSessions([]))
    api.dbSelect('mt_signs', { order: 'signed_at' }).then(setSigns).catch(() => setSigns([]))
  }
  useEffect(() => { load() }, [])
  if (!people) return <div className="note">載入中…</div>
  const ses = sessions.find(s => s.id === sid)
  const machOf = id => machines.find(m => m.id === id)
  const signOf = (sessId, emp) => signs.find(x => x.session_id === sessId && x.emp_no === emp)
  const cntOf = sessId => signs.filter(x => x.session_id === sessId).length
  const skillOf = (mid, emp) => skills.find(x => x.machine_id === mid && x.emp_no === emp)
  const groups = DEPTS.map(d => ({ d, members: people.filter(p => p.dept === d) })).concat([{ d: '其他', members: people.filter(p => !DEPTS.includes(p.dept)) }]).filter(g => g.members.length)
  const pn = p => p.name_zh || p.name_en

  async function toggleSkill(m, p) {
    const old = skillOf(m.id, p.emp_no)
    try {
      if (old) await api.dbDelete('mt_skill', old.id); else await api.dbInsert('mt_skill', { machine_id: m.id, emp_no: p.emp_no, mastered_on: todayStr() })
      load()
    } catch (ex) { toast(ex.message) }
  }
  async function saveMachine() {
    const e = msheet
    if (!e.name.trim()) { toast('請填機器名稱'); return }
    try { if (e.id) await api.dbUpdate('mt_machines', e.id, { name: e.name.trim(), name_en: (e.name_en || '').trim() }); else await api.dbInsert('mt_machines', { name: e.name.trim(), name_en: (e.name_en || '').trim(), sort_order: machines.length + 1 }); toast('已儲存'); setMsheet(null); load() } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delMachine() { try { await api.dbDelete('mt_machines', msheet.id); toast('已刪除'); setMsheet(null); load() } catch (ex) { toast(ex.message) } }
  async function saveSession() {
    const e = sheet
    if (!e.title.trim()) { toast('請填培訓名稱'); return }
    try { const r = await api.dbInsert('mt_sessions', { title: e.title.trim(), title_en: (e.title_en || '').trim(), train_date: e.train_date || todayStr(), trainer: e.trainer.trim(), notes: e.notes.trim(), machine_id: e.machine_id || null }); toast('已建立'); setSheet(null); load(); if (r && r.id) setSid(r.id) } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delSession() { try { await api.dbDelete('mt_sessions', ses.id); toast('已刪除'); setSid(null); load() } catch (ex) { toast(ex.message) } }
  // 紙本簽名後，喺系統登記「已簽到」；有連結機器就同時標「已掌握」
  async function toggleSign(p) {
    try {
      const old = signOf(ses.id, p.emp_no)
      if (old) { await api.dbDelete('mt_signs', old.id) }
      else {
        await api.dbInsert('mt_signs', { session_id: ses.id, emp_no: p.emp_no, sig: '', by_name: who || '' })
        if (ses.machine_id && !skillOf(ses.machine_id, p.emp_no)) await api.dbInsert('mt_skill', { machine_id: ses.machine_id, emp_no: p.emp_no, mastered_on: ses.train_date })
      }
      load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function signAll() {
    if (!window.confirm('將全部未登記嘅人標為「已簽到」' + (ses.machine_id ? '，並標為已掌握' : '') + '？')) return
    try {
      for (const p of people.filter(x => !signOf(ses.id, x.emp_no))) {
        await api.dbInsert('mt_signs', { session_id: ses.id, emp_no: p.emp_no, sig: '', by_name: who || '' })
        if (ses.machine_id && !skillOf(ses.machine_id, p.emp_no)) await api.dbInsert('mt_skill', { machine_id: ses.machine_id, emp_no: p.emp_no, mastered_on: ses.train_date })
      }
      toast('已全部登記'); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function savePerson() {
    const e = psheet
    if (!e.emp_no.trim()) { toast('請填員工號碼'); return }
    const row = { emp_no: e.emp_no.trim(), name_en: e.name_en.trim(), name_zh: e.name_zh.trim(), dept: e.dept.trim() }
    try { if (e.id) await api.dbUpdate('mt_people', e.id, row); else await api.dbInsert('mt_people', { ...row, sort_order: people.length + 1 }); toast('已儲存'); setPsheet(null); load() } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delPerson() { try { await api.dbDelete('mt_people', psheet.id); toast('已刪除'); setPsheet(null); load() } catch (ex) { toast(ex.message) } }

  // 一頁簽到表：兩欄並排（中英對照），簽名格留空畀大家手寫
  const SignSheet = ({ s }) => {
    // 三欄並排、組別用整行標題，令 50 人剛好一頁 A4 橫向放得落
    const items = []
    let no = 0
    groups.forEach(g => { items.push({ hd: g.d }); g.members.forEach(p => { no += 1; items.push({ p, no }) }) })
    const per = Math.ceil(items.length / 3)
    const cols = [0, 1, 2].map(k => items.slice(k * per, (k + 1) * per))
    // 每欄開頭如果唔係組別標題，補返所屬組別標題
    cols.forEach((c, k) => { if (c.length && !c[0].hd) { const prev = items.slice(0, k * per).reverse().find(x => x.hd); c.unshift({ hd: prev ? prev.hd : c[0].p.dept, cont: true }) } })
    return (
      <>
        <p className="rpt-mut" style={{ margin: '0 0 6px' }}>共 {people.length} 人 Total {people.length} staff{s.trainer ? '　·　導師 Trainer：' + s.trainer : ''}</p>
        <div className="sign-three">
          {cols.map((c, k) => (
            <table className="rpt-t rpt-fixed sign-t" key={k}>
              <colgroup><col style={{ width: '8%' }} /><col style={{ width: '17%' }} /><col style={{ width: '31%' }} /><col style={{ width: '44%' }} /></colgroup>
              <thead><tr><th>#</th><th>員工號碼<br />Staff No.</th><th>姓名<br />Name</th><th>簽名<br />Signature</th></tr></thead>
              <tbody>{c.map((x, i) => x.hd !== undefined
                ? <tr key={'h' + i} className="sign-hd"><td colSpan={4}>{deptLabel(x.hd)}{x.cont ? '（續）' : ''}</td></tr>
                : <tr key={x.p.id}><td>{x.no}</td><td>{x.p.emp_no}</td><td className="sign-nm">{x.p.name_en}{x.p.name_zh ? ' ' + x.p.name_zh : ''}</td><td className="sign-box"></td></tr>)}</tbody>
            </table>
          ))}
        </div>
      </>
    )
  }

  // ── 場次詳情：簽到表 ──
  if (ses) {
    const done = cntOf(ses.id)
    const m = machOf(ses.machine_id)
    return (
      <>
        <ToolBar label={`${ses.title} · ${ses.train_date}`}><ExportBtn onClick={() => setReport('sign')} /></ToolBar>
        <p className="pa-stat">已簽到 {done} ／ {people.length} 人{m ? '　·　機器：' + m.name + '（登記即標已掌握）' : ''}{ses.trainer ? '　·　導師：' + ses.trainer : ''}{ses.notes ? '　·　' + ses.notes : ''}</p>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {groups.map(g => (
          <div key={g.d}>
            <div className="bh-grp">{deptLabel(g.d)}<span>{g.members.filter(p => signOf(ses.id, p.emp_no)).length}／{g.members.length}</span></div>
            {g.members.map(p => {
              const s = signOf(ses.id, p.emp_no)
              return (
                <div className="mt-row" key={p.id}>
                  <span className="mt-no">{p.emp_no}</span>
                  <span className="mt-nm"><b>{p.name_zh || '—'}</b><small>{p.name_en}</small></span>
                  <span className={s ? 'mt-ok' : 'mt-no-sig'}>{s ? '✔ 已簽到' : '未簽到'}</span>
                  {canEdit && <button className={'mini' + (s ? '' : ' pri')} onClick={() => toggleSign(p)}>{s ? '取消' : '登記'}</button>}
                </div>
              )
            })}
          </div>
        ))}
        {canEdit && <button className="btn alt" style={{ marginTop: 10 }} onClick={signAll}>全部標為已簽到</button>}
        {canEdit && <button className="btn danger sm-quiet" onClick={() => window.confirm('刪除呢個培訓場次同全部簽到紀錄？') && delSession()}>刪除這個培訓場次</button>}
        {report === 'sign' && (
          <ReportModal signPage title={`${ses.title}${ses.title_en ? ' ' + ses.title_en : ''} 簽到表 Sign-in Sheet`} sub={`${ses.train_date}${ses.trainer ? ' · 導師 Trainer ' + ses.trainer : ''}`} onClose={() => setReport(null)}>
            <SignSheet s={ses} />
          </ReportModal>
        )}
      </>
    )
  }

  // ── 主畫面 ──
  return (
    <>
      <div className="seg" style={{ margin: '0 0 10px' }}>
        <button className={tab === 'skill' ? 'on' : ''} onClick={() => setTab('skill')}>機器掌握</button>
        <button className={tab === 'sess' ? 'on' : ''} onClick={() => setTab('sess')}>培訓場次（{sessions.length}）</button>
        <button className={tab === 'ppl' ? 'on' : ''} onClick={() => setTab('ppl')}>人員（{people.length}）</button>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {tab === 'skill' && (
        <>
          <ToolBar label={`${people.length} 人 × ${machines.length} 部機器`}><ExportBtn onClick={() => setReport('skill')} /></ToolBar>
          {canEdit && <button className="btn alt" style={{ marginBottom: 8 }} onClick={() => setMsheet({ id: null, name: '', name_en: '' })}>＋ 新增機器</button>}
          <p className="src-note" style={{ margin: '0 4px 8px' }}>{canEdit ? '撳格切換「已掌握」；撳機器名可改名或刪除。培訓場次連結機器後，登記「已簽到」會自動標已掌握。' : '✔ ＝已掌握。'}</p>
          <div className="wo-wrap">
            <table className="wo-t sk-t">
              <thead>
                <tr>
                  <th className="wo-nm">人員</th>
                  {machines.map(m => <th key={m.id} onClick={() => canEdit && setMsheet({ ...m })} style={canEdit ? { cursor: 'pointer' } : undefined}>{m.name}{m.name_en && <small style={{ display: 'block', fontWeight: 500, color: 'var(--sub)' }}>{m.name_en}</small>}</th>)}
                  <th className="c-calc">已掌握</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <>
                    <tr key={'g' + g.d} className="pm-grp"><td colSpan={machines.length + 2}>{deptLabel(g.d)}</td></tr>
                    {g.members.map(p => {
                      const n = machines.filter(m => skillOf(m.id, p.emp_no)).length
                      return (
                        <tr key={p.id}>
                          <td className="wo-nm"><b>{pn(p)}</b><small>{p.emp_no}{p.name_zh ? ' ' + p.name_en : ''}</small></td>
                          {machines.map(m => { const s = skillOf(m.id, p.emp_no); return <td key={m.id} className={'sk-c' + (s ? ' ok' : '')} onClick={() => canEdit && toggleSkill(m, p)} style={canEdit ? { cursor: 'pointer' } : undefined}>{s ? '✔' : ''}</td> })}
                          <td className="c-calc">{n}／{machines.length}</td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="wo-nm"><b>已掌握人數</b></td>{machines.map(m => <td key={m.id} className="c-calc">{skills.filter(s => s.machine_id === m.id).length}／{people.length}</td>)}<td className="c-calc"></td></tr>
              </tfoot>
            </table>
          </div>
          {machines.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有機器。{canEdit ? '撳「＋ 新增機器」逐部加入。' : ''}</p>}
        </>
      )}
      {tab === 'sess' && (
        <>
          {sessions.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有培訓場次。{canEdit ? '撳右下角「＋」建立，匯出簽到表印出嚟手寫簽名，之後喺度登記。' : ''}</p>}
          <div className="pa-grid pa-grid-an">
            {sessions.map(s => (
              <button className="pa-sq pa-an" key={s.id} onClick={() => setSid(s.id)}>
                <span className="pa-sq-top"><em>{s.train_date}</em>{machOf(s.machine_id) && <small className="pa-kind">{machOf(s.machine_id).name}</small>}</span>
                <b className="pa-sq-name">{s.title}</b>
                <span className="pa-sq-post"><span className="st-qty">{cntOf(s.id)}<small> ／ {people.length} 人已簽到</small></span>{s.trainer && <span>導師：{s.trainer}</span>}{s.notes && <span className="pa-sq-area">{s.notes}</span>}</span>
              </button>
            ))}
          </div>
          {canEdit && <button className="fab" onClick={() => setSheet({ title: '', title_en: '', train_date: todayStr(), trainer: '', notes: '', machine_id: '' })}>＋</button>}
        </>
      )}
      {tab === 'ppl' && (
        <>
          {groups.map(g => (
            <div key={g.d}>
              <div className="bh-grp">{deptLabel(g.d)}<span>{g.members.length}</span></div>
              {g.members.map(p => (
                <button className="mt-row mt-row-b" key={p.id} onClick={() => canEdit && setPsheet({ ...p })} style={canEdit ? undefined : { cursor: 'default' }}>
                  <span className="mt-no">{p.emp_no}</span>
                  <span className="mt-nm"><b>{p.name_zh || '—'}</b><small>{p.name_en}</small></span>
                </button>
              ))}
            </div>
          ))}
          {canEdit && <button className="fab" onClick={() => setPsheet({ id: null, emp_no: '', name_en: '', name_zh: '', dept: 'RA' })}>＋</button>}
        </>
      )}
      {sheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>新增培訓場次</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setSheet(null)}>取消</button><button className="mini pri" onClick={saveSession}>建立</button></span></div>
            <div className="f-row"><label>培訓名稱</label><input value={sheet.title} onChange={e => setSheet({ ...sheet, title: e.target.value })} placeholder="例：新洗地機培訓" /></div>
            <div className="f-row"><label>英文名稱</label><input value={sheet.title_en || ''} onChange={e => setSheet({ ...sheet, title_en: e.target.value })} placeholder="e.g. New Floor Scrubber Training" /></div>
            <div className="f-row"><label>連結機器（登記即標已掌握）</label><select value={sheet.machine_id} onChange={e => setSheet({ ...sheet, machine_id: e.target.value })}><option value="">（不連結）</option>{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>日期</label><input type="date" value={sheet.train_date} onChange={e => setSheet({ ...sheet, train_date: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>導師</label><input value={sheet.trainer} onChange={e => setSheet({ ...sheet, trainer: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
          </div>
        </div>
      )}
      {msheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setMsheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{msheet.id ? '改機器名稱' : '新增機器'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setMsheet(null)}>取消</button><button className="mini pri" onClick={saveMachine}>儲存</button></span></div>
            <div className="f-row"><label>機器名稱</label><input value={msheet.name} onChange={e => setMsheet({ ...msheet, name: e.target.value })} placeholder="例：吸塵機、洗地機、高壓水槍" /></div>
            <div className="f-row"><label>英文名</label><input value={msheet.name_en || ''} onChange={e => setMsheet({ ...msheet, name_en: e.target.value })} placeholder="e.g. Floor scrubber" /></div>
            {msheet.id && <button className="btn danger sm-quiet" onClick={() => window.confirm('刪除機器同佢嘅全部掌握紀錄？') && delMachine()}>刪除這部機器</button>}
          </div>
        </div>
      )}
      {psheet && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setPsheet(null) }}>
          <div className="sheet">
            <div className="sheet-hd"><h2>{psheet.id ? '編輯人員' : '新增人員'}</h2><span className="sheet-hd-acts"><button className="mini" onClick={() => setPsheet(null)}>取消</button><button className="mini pri" onClick={savePerson}>儲存</button></span></div>
            <div className="f-row"><label>員工號碼</label><input inputMode="numeric" value={psheet.emp_no} onChange={e => setPsheet({ ...psheet, emp_no: e.target.value })} /></div>
            <div className="f-row"><label>英文名</label><input value={psheet.name_en} onChange={e => setPsheet({ ...psheet, name_en: e.target.value })} /></div>
            <div className="f-row"><label>中文名</label><input value={psheet.name_zh} onChange={e => setPsheet({ ...psheet, name_zh: e.target.value })} /></div>
            <div className="f-row"><label>組別</label><select value={psheet.dept} onChange={e => setPsheet({ ...psheet, dept: e.target.value })}>{DEPTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            {psheet.id && <button className="btn danger sm-quiet" onClick={delPerson}>刪除這位人員</button>}
          </div>
        </div>
      )}
      {report === 'skill' && (
        <ReportModal landscape title="機器培訓 · 機器掌握表 Machine Training Matrix" sub={todayStr()} onClose={() => setReport(null)}>
          <table className="rpt-t rpt-fixed">
            <thead><tr><th style={{ width: '22%' }}>人員 Staff</th>{machines.map(m => <th key={m.id}>{m.name}{m.name_en && <><br />{m.name_en}</>}</th>)}<th>已掌握<br />Mastered</th></tr></thead>
            <tbody>{groups.map(g => [<tr key={'g' + g.d}><td colSpan={machines.length + 2} style={{ fontWeight: 800, background: '#eef3f1' }}>{deptLabel(g.d)}</td></tr>, ...g.members.map(p => <tr key={p.id}><td>{pn(p)} <small>{p.emp_no}</small></td>{machines.map(m => <td key={m.id} style={{ textAlign: 'center' }}>{skillOf(m.id, p.emp_no) ? '✔' : ''}</td>)}<td>{machines.filter(m => skillOf(m.id, p.emp_no)).length}／{machines.length}</td></tr>)])}</tbody>
          </table>
        </ReportModal>
      )}
    </>
  )
}
