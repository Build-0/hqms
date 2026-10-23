import { Fragment, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { ITEMS, ROLE_LABEL, LEVEL_LABEL, itemDefault } from '../lib/accounts'
import { toast } from '../lib/toast'

// 開發者專用：一張總表睇晒「每個人 × 每個項目」而家嘅權限，並可直接逐格修改。
// 每格 = 預設（跟角色）／無／查看／新增／編輯。有改過（同角色預設唔同）嘅格有記號。
// 資料庫（RLS）會跟住逐項權限：授權即可讀取／新增／編輯；設為「無」即收回。
const ROLES = ['admin', 'store', 'clerk', 'supervisor']
const SHORT = { none: '無', view: '看', add: '增', edit: '改' }

export default function PermAdmin({ session, onClose }) {
  const [staff, setStaff] = useState(null)
  const [ov, setOv] = useState({})            // ov[emp][item] = level
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const load = () => Promise.all([api.listStaffPerms(), api.listPermItems()]).then(([s, p]) => {
    const m = {}; p.forEach(r => { (m[r.emp_id] = m[r.emp_id] || {})[r.item] = r.level })
    setStaff(s); setOv(m); setErr('')
  }).catch(ex => { setErr(ex.message); setStaff(prev => prev || []) })
  useEffect(() => { load() }, [])
  const people = useMemo(() => (staff || []).filter(r => !q.trim() || (r.name + r.emp_id).toLowerCase().includes(q.trim().toLowerCase())), [staff, q])
  const eff = (r, id) => (ov[r.emp_id] && ov[r.emp_id][id]) || itemDefault({ role: r.role, pub: r.pub_sup }, id)

  async function setLevel(r, id, level) {
    setBusy(r.emp_id + id)
    try { await api.setPermItem(r.emp_id, id, level || null); toast('已更新：' + r.name + ' · ' + ITEMS.find(i => i.id === id).label); await load() } catch (ex) { toast('更新失敗：' + ex.message) }
    setBusy('')
  }
  async function setRole(r, role) {
    try { await api.updateStaffPerm(r.emp_id, { role }); toast('已更新角色：' + r.name); await load() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  const groups = []
  ITEMS.forEach(i => { const g = groups.find(x => x.name === i.group); if (g) g.items.push(i); else groups.push({ name: i.group, items: [i] }) })

  return (
    <div className="modal pm-modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet pm-sheet pm-wide">
        <div className="sheet-hd"><h2>權限管理（開發者）</h2><span className="sheet-hd-acts"><button className="mini pri" onClick={onClose}>關閉</button></span></div>
        <p className="src-note" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
          一張表睇晒 {staff ? staff.length : '…'} 個帳號 × {ITEMS.length} 個項目。每格可揀「預設（跟角色）／無／查看／新增／編輯」，有改過嘅格會有綠色記號。對方下次登入或刷新即生效；資料庫會同步授權或收回。你本人嗰行不可修改。
        </p>
        <input className="search-inp" placeholder="搜尋姓名或員工編號" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {!staff && <div className="note">載入中…</div>}
        {staff && (
          <div className="pm-scroll">
            <table className="pm-t">
              <thead>
                <tr>
                  <th className="pm-corner">項目 ＼ 帳號</th>
                  {people.map(r => <th key={r.emp_id} className={r.emp_id === session.key ? 'me' : ''}><b>{r.name}</b><small>{r.emp_id}</small>{r.is_dev && <i className="pm-dev">開發者</i>}</th>)}
                </tr>
                <tr>
                  <th className="pm-corner pm-rolehd">角色（預設權限）</th>
                  {people.map(r => (
                    <th key={r.emp_id} className="pm-role">
                      <select value={r.role} disabled={r.emp_id === session.key} onChange={e => setRole(r, e.target.value)}>{ROLES.map(x => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={g.name}>
                    <tr className="pm-grp"><td colSpan={people.length + 1}>{g.name}</td></tr>
                    {g.items.map(it => (
                      <tr key={it.id}>
                        <td className="pm-item">{it.label}</td>
                        {people.map(r => {
                          const me = r.emp_id === session.key
                          const o = ov[r.emp_id] && ov[r.emp_id][it.id]
                          const e = eff(r, it.id)
                          const opts = ['view', ...(it.add ? ['add'] : []), 'edit', 'none']
                          return (
                            <td key={r.emp_id} className={'pm-c lv-' + e + (o ? ' ov' : '') + (me ? ' me' : '')}>
                              <select value={o || ''} disabled={me || busy === r.emp_id + it.id} onChange={ev => setLevel(r, it.id, ev.target.value)} title={LEVEL_LABEL[e]}>
                                <option value="">{SHORT[e]}・預設</option>
                                {opts.map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                              </select>
                              <span className="pm-lv">{SHORT[e]}</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pm-legend"><span className="lv-edit">改＝可編輯</span><span className="lv-add">增＝可新增</span><span className="lv-view">看＝只可查看</span><span className="lv-none">無＝睇唔到</span><span>● 有綠點＝你手動改過（唔跟角色預設）</span></div>
      </div>
    </div>
  )
}
