import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { useBack } from '../lib/nav'
import { ToolBar, ExportBtn } from '../components/ui'
import { ReportModal } from '../components/Reports'

// 機器培訓：培訓場次 + 簽到表（員工號碼、英文名、中文名、簽名）。每個場次逐人手寫簽名（手機用手指／電腦用滑鼠）。
const DEPTS = ['Sup', '倉', 'Linen', 'PA', 'PM', 'ON', 'RA']

function SigPad({ onSave, onCancel, name }) {
  const ref = useRef(null)
  const st = useRef({ drawing: false, last: null, dirty: false })
  useEffect(() => {
    const c = ref.current; const ctx = c.getContext('2d')
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
  const [sessions, setSessions] = useState([])
  const [signs, setSigns] = useState([])
  const [tab, setTab] = useState('sess')           // sess 培訓場次／ppl 人員名單
  const [sid, setSid] = useState(null)             // 開咗邊個場次
  const [sheet, setSheet] = useState(null)         // 新增場次
  const [psheet, setPsheet] = useState(null)       // 編輯人員
  const [signing, setSigning] = useState(null)
  const [report, setReport] = useState(false)
  const [err, setErr] = useState('')
  useBack(!!sid, () => setSid(null), 2)
  const load = () => {
    api.dbSelect('mt_people', { order: 'sort_order' }).then(r => { setPeople(r); setErr('') }).catch(ex => { setErr(ex.message); setPeople(prev => prev || []) })
    api.dbSelect('mt_sessions', { order: 'train_date', asc: false }).then(setSessions).catch(() => setSessions([]))
    api.dbSelect('mt_signs', { order: 'signed_at' }).then(setSigns).catch(() => setSigns([]))
  }
  useEffect(() => { load() }, [])
  if (!people) return <div className="note">載入中…</div>
  const ses = sessions.find(s => s.id === sid)
  const signOf = (sessId, emp) => signs.find(x => x.session_id === sessId && x.emp_no === emp)
  const cntOf = sessId => signs.filter(x => x.session_id === sessId).length
  const groups = DEPTS.map(d => ({ d, members: people.filter(p => p.dept === d) })).concat([{ d: '其他', members: people.filter(p => !DEPTS.includes(p.dept)) }]).filter(g => g.members.length)

  async function saveSession() {
    const e = sheet
    if (!e.title.trim()) { toast('請填培訓名稱'); return }
    try { const r = await api.dbInsert('mt_sessions', { title: e.title.trim(), train_date: e.train_date || todayStr(), trainer: e.trainer.trim(), notes: e.notes.trim() }); toast('已建立'); setSheet(null); load(); if (r && r.id) setSid(r.id) } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function delSession() { try { await api.dbDelete('mt_sessions', ses.id); toast('已刪除'); setSid(null); load() } catch (ex) { toast(ex.message) } }
  async function saveSig(p, data) {
    try {
      const old = signOf(ses.id, p.emp_no)
      if (old) await api.dbUpdate('mt_signs', old.id, { sig: data, signed_at: new Date().toISOString(), by_name: who || '' })
      else await api.dbInsert('mt_signs', { session_id: ses.id, emp_no: p.emp_no, sig: data, by_name: who || '' })
      toast('已簽名：' + (p.name_zh || p.name_en)); setSigning(null); load()
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

  // ── 場次詳情：簽到表 ──
  if (ses) {
    const done = cntOf(ses.id)
    return (
      <>
        <ToolBar label={`${ses.title} · ${ses.train_date}`}><ExportBtn onClick={() => setReport(true)} /></ToolBar>
        <p className="pa-stat">已簽 {done} ／ {people.length} 人{ses.trainer ? '　·　導師：' + ses.trainer : ''}{ses.notes ? '　·　' + ses.notes : ''}</p>
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
        {signing && <SigPad name={signing.name_zh || signing.name_en} onCancel={() => setSigning(null)} onSave={d => saveSig(signing, d)} />}
        {report && (
          <ReportModal landscape={false} title={`機器培訓簽到表 · ${ses.title}`} sub={`${ses.train_date}${ses.trainer ? ' · 導師 ' + ses.trainer : ''}`} onClose={() => setReport(false)}>
            <p className="rpt-mut">已簽 {done} ／ {people.length} 人</p>
            {groups.map(g => (
              <div key={g.d}>
                <div className="rpt-sub">{g.d} · {g.members.length}</div>
                <table className="rpt-t rpt-fixed">
                  <colgroup><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col style={{ width: '42%' }} /></colgroup>
                  <thead><tr><th>員工號碼</th><th>英文名</th><th>中文名</th><th>簽名</th></tr></thead>
                  <tbody>{g.members.map(p => { const s = signOf(ses.id, p.emp_no); return <tr key={p.id}><td>{p.emp_no}</td><td>{p.name_en}</td><td>{p.name_zh}</td><td style={{ height: 34 }}>{s ? <img src={s.sig} alt="" style={{ height: 30, maxWidth: '100%' }} /> : ''}</td></tr> })}</tbody>
                </table>
              </div>
            ))}
          </ReportModal>
        )}
      </>
    )
  }

  // ── 場次列表／人員名單 ──
  return (
    <>
      <div className="seg" style={{ margin: '0 0 10px' }}>
        <button className={tab === 'sess' ? 'on' : ''} onClick={() => setTab('sess')}>培訓場次（{sessions.length}）</button>
        <button className={tab === 'ppl' ? 'on' : ''} onClick={() => setTab('ppl')}>人員名單（{people.length}）</button>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {tab === 'sess' && (
        <>
          {sessions.length === 0 && <p className="src-note" style={{ margin: '14px 4px' }}>暫時未有培訓場次。{canEdit ? '撳右下角「＋」建立，再逐個人簽名。' : ''}</p>}
          <div className="pa-grid pa-grid-an">
            {sessions.map(s => (
              <button className="pa-sq pa-an" key={s.id} onClick={() => setSid(s.id)}>
                <span className="pa-sq-top"><em>{s.train_date}</em></span>
                <b className="pa-sq-name">{s.title}</b>
                <span className="pa-sq-post"><span className="st-qty">{cntOf(s.id)}<small> ／ {people.length} 人已簽</small></span>{s.trainer && <span>導師：{s.trainer}</span>}{s.notes && <span className="pa-sq-area">{s.notes}</span>}</span>
              </button>
            ))}
          </div>
          {canEdit && <button className="fab" onClick={() => setSheet({ title: '機器培訓', train_date: todayStr(), trainer: '', notes: '' })}>＋</button>}
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
            <div className="f-row"><label>培訓名稱</label><input value={sheet.title} onChange={e => setSheet({ ...sheet, title: e.target.value })} placeholder="例：吸塵機培訓" /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="f-row" style={{ flex: 1 }}><label>日期</label><input type="date" value={sheet.train_date} onChange={e => setSheet({ ...sheet, train_date: e.target.value })} /></div>
              <div className="f-row" style={{ flex: 1 }}><label>導師</label><input value={sheet.trainer} onChange={e => setSheet({ ...sheet, trainer: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>備註</label><input value={sheet.notes} onChange={e => setSheet({ ...sheet, notes: e.target.value })} /></div>
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
    </>
  )
}
