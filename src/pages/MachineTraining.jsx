import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { useBack } from '../lib/nav'
import { ToolBar, ExportBtn } from '../components/ui'
import { ReportModal } from '../components/Reports'

// 機器培訓：
//  1) 機器掌握：人員 × 機器 矩陣，睇邊個已掌握邊部機器（撳格切換）
//  2) 培訓場次：每個場次逐人簽到（手寫簽名），可連結某部機器，簽名即自動標「已掌握」
//  3) 人員名單
// 匯出簽到表：一頁（A4 橫向，兩欄），可列印後手寫簽名，亦會帶出已有嘅電子簽名
const DEPTS = ['Sup', '倉', 'Linen', 'PA', 'PM', 'ON', 'RA']

function SigPad({ onSave, onCancel, name }) {
  const ref = useRef(null)
  const st = useRef({ drawing: false, last: null, dirty: false })
  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1d2733'
  }, [])
  const pos = e => { const r = ref.current.getBoundingClientRect(); return [(e.clientX - r.left) * (ref.current.width / r.width), (e.clientY - r.top) * (ref.current.height / r.height)] }
  const down = e => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); st.current.drawing = true; st.current.last = pos(e) }
  const move = e => {
    if (!st.current.drawing) return
    const ctx = ref.current.getContext('2d'); const p = pos(e); const l = st.current.last
    ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); st.current.last = p; st.current.dirty = true
  }
  const up = () => { st.current.drawing = false }
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); st.current.dirty = false }
  const save = () => { if (!st.current.dirty) { toast('請先簽名'); return } onSave(ref.current.toDataURL('image/png')) }
  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="sheet">
        <div className="sheet-hd"><h2>簽名 · {name}</h2><span className="sheet-hd-acts"><button className="mini" onClick={onCancel}>取消</button><button className="mini pri" onClick={save}>儲存</button></span></div>
        <canvas ref={ref} width={640} height={260} className="sig-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        <button className="btn ghost sm-quiet" onClick={clear}>清除重寫</button>
      </div>
    </div>
  )
}

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
  const [signing, setSigning] = useState(null)
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
    try { if (e.id) await api.dbUpdate('mt_machines', e.id, { name: e.name.trim() }); else await api.dbInsert('mt_machines', { name: e.name.trim(), sort_order: machines.length + 1 }); toast('已儲存'); setMsheet(null); load() } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delMachine() { try { await api.dbDelete('mt_machines', msheet.id); toast('已刪除'); setMsheet(null); load() } catch (ex) { toast(ex.message) } }
  async function saveSession() {
    const e = sheet
    if (!e.title.trim()) { toast('請填培訓名稱'); return }
    try { const r = await api.dbInsert('mt_sessions', { title: e.title.trim(), train_date: e.train_date || todayStr(), trainer: e.trainer.trim(), notes: e.notes.trim(), machine_id: e.machine_id || null }); toast('已建立'); setSheet(null); load(); if (r && r.id) setSid(r.id) } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delSession() { try { await api.dbDelete('mt_sessions', ses.id); toast('已刪除'); setSid(null); load() } catch (ex) { toast(ex.message) } }
  async function saveSig(p, data) {
    try {
      const old = signOf(ses.id, p.emp_no)
      if (old) await api.dbUpdate('mt_signs', old.id, { sig: data, signed_at: new Date().toISOString(), by_name: who || '' })
      else await api.dbInsert('mt_signs', { session_id: ses.id, emp_no: p.emp_no, sig: data, by_name: who || '' })
      if (ses.machine_id && !skillOf(ses.machine_id, p.emp_no)) await api.dbInsert('mt_skill', { machine_id: ses.machine_id, emp_no: p.emp_no, mastered_on: ses.train_date })
      toast('已簽名：' + pn(p)); setSigning(null); load()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function clearSig(p) { const old = signOf(ses.id, p.emp_no); if (!old) return; try { await api.dbDelete('mt_signs', old.id); toast('已清除簽名'); load() } catch (ex) { toast(ex.message) } }
  async function savePerson() {
    const e = psheet
    if (!e.emp_no.trim()) { toast('請填員工號碼'); return }
    const row = { emp_no: e.emp_no.trim(), name_en: e.name_en.trim(), name_zh: e.name_zh.trim(), dept: e.dept.trim() }
    try { if (e.id) await api.dbUpdate('mt_people', e.id, row); else await api.dbInsert('mt_people', { ...row, sort_order: people.length + 1 }); toast('已儲存'); setPsheet(null); load() } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delPerson() { try { await api.dbDelete('mt_people', psheet.id); toast('已刪除'); setPsheet(null); load() } catch (ex) { toast(ex.message) } }

  // 一頁簽到表：兩欄並排（員工號碼／英文名／中文名／簽名），空位畀大家手寫簽名
  const SignSheet = ({ s }) => {
    const half = Math.ceil(people.length / 2)
    const cols = [people.slice(0, half), people.slice(half)]
    return (
      <>
        <p className="rpt-mut" style={{ margin: '0 0 6px' }}>共 {people.length} 人　·　已電子簽名 {cntOf(s.id)} 人{s.trainer ? '　·　導師：' + s.trainer : ''}</p>
        <div className="sign-two">
          {cols.map((c, k) => (
            <table className="rpt-t rpt-fixed sign-t" key={k}>
              <colgroup><col style={{ width: '13%' }} /><col style={{ width: '9%' }} /><col style={{ width: '18%' }} /><col style={{ width: '17%' }} /><col style={{ width: '43%' }} /></colgroup>
              <thead><tr><th>組別</th><th>#</th><th>員工號碼</th><th>英文名／中文名</th><th>簽名</th></tr></thead>
              <tbody>{c.map((p, i) => { const sg = signOf(s.id, p.emp_no); return <tr key={p.id}><td>{p.dept}</td><td>{k * half + i + 1}</td><td>{p.emp_no}</td><td>{p.name_en}{p.name_zh ? ' ' + p.name_zh : ''}</td><td className="sign-box">{sg ? <img src={sg.sig} alt="" /> : ''}</td></tr> })}</tbody>
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
        <p className="pa-stat">已簽 {done} ／ {people.length} 人{m ? '　·　機器：' + m.name + '（簽名即標已掌握）' : ''}{ses.trainer ? '　·　導師：' + ses.trainer : ''}{ses.notes ? '　·　' + ses.notes : ''}</p>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {groups.map(g => (
          <div key={g.d}>
            <div className="bh-grp">{g.d}<span>{g.members.filter(p => signOf(ses.id, p.emp_no)).length}／{g.members.length}</span></div>
            {g.members.map(p => {
              const s = signOf(ses.id, p.emp_no)
              return (
                <div className="mt-row" key={p.id}>
                  <span className="mt-no">{p.emp_no}</span>
                  <span className="mt-nm"><b>{p.name_zh || '—'}</b><small>{p.name_en}</small></span>
                  {s ? <img className="mt-sig" src={s.sig} alt="" /> : <span className="mt-no-sig">未簽</span>}
                  {canEdit && <button className={'mini' + (s ? '' : ' pri')} onClick={() => setSigning(p)}>{s ? '重簽' : '簽名'}</button>}
                  {canEdit && s && <button className="mini danger" onClick={() => clearSig(p)}>清</button>}
                </div>
              )
            })}
          </div>
        ))}
        {canEdit && <button className="btn danger sm-quiet" onClick={() => window.confirm('刪除呢個培訓場次同全部簽名？') && delSession()}>刪除這個培訓場次</button>}
        {signing && <SigPad name={pn(signing)} onCancel={() => setSigning(null)} onSave={d => saveSig(signing, d)} />}
        {report === 'sign' && (
          <ReportModal signPage title={`${ses.title} 簽到表`} sub={`${ses.train_date}${ses.trainer ? ' · 導師 ' + ses.trainer : ''}`} onClose={() => setReport(null)}>
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
          {canEdit && <button className="btn alt" style={{ marginBottom: 8 }} onClick={() => setMsheet({ id: null, name: '' })}>＋ 新增機器</button>}
          <p className="src-note" style={{ margin: '0 4px 8px' }}>{canEdit ? '撳格切換「已掌握」；撳機器名可改名或刪除。培訓場次連結機器後，簽名會自動標已掌握。' : '✔ ＝已掌握。'}</p>
          <div className="wo-wrap">
            <table className="wo-t sk-t">
              <thead>
                <tr>
                  <th className="wo-nm">人員</th>
                  {machines.map(m => <th key={m.id} onClick={() => canEdit && setMsheet({ ...m })} style={canEdit ? { cursor: 'pointer' } : undefined}>{m.name}</th>)}
                  <th className="c-calc">已掌握</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <>
                    <tr key={'g' + g.d} className="pm-grp"><td colSpan={machines.length + 2}>{g.d}</td></tr>
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
          {sessions.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有培訓場次。{canEdit ? '撳右下角「＋」建立，再逐個人簽名。' : ''}</p>}
          <div className="pa-grid pa-grid-an">
            {sessions.map(s => (
              <button className="pa-sq pa-an" key={s.id} onClick={() => setSid(s.id)}>
                <span className="pa-sq-top"><em>{s.train_date}</em>{machOf(s.machine_id) && <small className="pa-kind">{machOf(s.machine_id).name}</small>}</span>
                <b className="pa-sq-name">{s.title}</b>
                <span className="pa-sq-post"><span className="st-qty">{cntOf(s.id)}<small> ／ {people.length} 人已簽</small></span>{s.trainer && <span>導師：{s.trainer}</span>}{s.notes && <span className="pa-sq-area">{s.notes}</span>}</span>
              </button>
            ))}
          </div>
          {canEdit && <button className="fab" onClick={() => setSheet({ title: '', train_date: todayStr(), trainer: '', notes: '', machine_id: '' })}>＋</button>}
        </>
      )}
      {tab === 'ppl' && (
        <>
          {groups.map(g => (
            <div key={g.d}>
              <div className="bh-grp">{g.d}<span>{g.members.length}</span></div>
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
            <div className="f-row"><label>連結機器（簽名即標已掌握）</label><select value={sheet.machine_id} onChange={e => setSheet({ ...sheet, machine_id: e.target.value })}><option value="">（不連結）</option>{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
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
        <ReportModal landscape title="機器培訓 · 機器掌握表" sub={todayStr()} onClose={() => setReport(null)}>
          <table className="rpt-t rpt-fixed">
            <thead><tr><th style={{ width: '22%' }}>人員</th>{machines.map(m => <th key={m.id}>{m.name}</th>)}<th>已掌握</th></tr></thead>
            <tbody>{groups.map(g => [<tr key={'g' + g.d}><td colSpan={machines.length + 2} style={{ fontWeight: 800, background: '#eef3f1' }}>{g.d}</td></tr>, ...g.members.map(p => <tr key={p.id}><td>{pn(p)} <small>{p.emp_no}</small></td>{machines.map(m => <td key={m.id} style={{ textAlign: 'center' }}>{skillOf(m.id, p.emp_no) ? '✔' : ''}</td>)}<td>{machines.filter(m => skillOf(m.id, p.emp_no)).length}／{machines.length}</td></tr>)])}</tbody>
          </table>
        </ReportModal>
      )}
    </>
  )
}
