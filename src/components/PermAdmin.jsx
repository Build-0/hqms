import { Fragment, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { ITEMS, ROLE_LABEL, LEVEL_LABEL, itemDefault } from '../lib/accounts'
import { toast } from '../lib/toast'

// 開發者專用：一張總表睇晒「每個人 × 每個項目」而家嘅權限，並可直接逐格修改。
// 每格 = 預設（跟角色）／無／查看／新增／編輯。有改過（同角色預設唔同）嘅格有記號。
// 帳號按類別分組（開發者／管理員／倉管員／文員／公共地區主管／樓層主管），每組可摺疊成一欄；
// 摺疊後揀一格＝將全組同一項目一次過設定。
const ROLES = ['admin', 'store', 'clerk', 'supervisor']
const SHORT = { none: '無', view: '看', add: '增', edit: '改', mix: '混' }
const GROUPS = [
  { key: 'dev', label: '開發者' },
  { key: 'admin', label: '管理員' },
  { key: 'store', label: '倉管員' },
  { key: 'clerk', label: '文員' },
  { key: 'pubsup', label: '公共地區主管' },
  { key: 'supervisor', label: '樓層主管' },
]

export default function PermAdmin({ session, onClose }) {
  const [staff, setStaff] = useState(null)
  const [ov, setOv] = useState({})            // ov[emp][item] = level
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState({})        // 展開咗邊啲組（預設全部摺疊）
  const load = () => Promise.all([api.listStaffPerms(), api.listPermItems()]).then(([s, p]) => {
    const m = {}; p.forEach(r => { (m[r.emp_id] = m[r.emp_id] || {})[r.item] = r.level })
    setStaff(s); setOv(m); setErr('')
  }).catch(ex => { setErr(ex.message); setStaff(prev => prev || []) })
  useEffect(() => { load() }, [])
  const eff = (r, id) => (ov[r.emp_id] && ov[r.emp_id][id]) || itemDefault({ role: r.role, pub: r.pub_sup, dev: r.is_dev }, id)
  const paItems = ITEMS.filter(i => i.id.startsWith('pa_'))
  const groupOf = r => (r.is_dev ? 'dev' : r.role === 'supervisor' && paItems.some(i => eff(r, i.id) !== 'none') ? 'pubsup' : r.role)

  const groups = useMemo(() => {
    const list = (staff || []).filter(r => !q.trim() || (r.name + r.emp_id).toLowerCase().includes(q.trim().toLowerCase()))
    return GROUPS.map(g => ({ ...g, members: list.filter(r => groupOf(r) === g.key).sort((a, b) => String(a.emp_id).localeCompare(String(b.emp_id))) })).filter(g => g.members.length)
  }, [staff, ov, q])
  const isOpen = g => (q.trim() ? true : !!open[g.key])
  const colCount = groups.reduce((n, g) => n + (isOpen(g) ? g.members.length : 1), 0)

  async function setLevel(r, id, level) {
    setBusy(r.emp_id + id)
    try { await api.setPermItem(r.emp_id, id, level || null); toast('已更新：' + r.name + ' · ' + ITEMS.find(i => i.id === id).label); await load() } catch (ex) { toast('更新失敗：' + ex.message) }
    setBusy('')
  }
  async function setGroup(g, id, level) {
    const targets = g.members.filter(m => m.emp_id !== session.key)
    const it = ITEMS.find(i => i.id === id)
    if (!window.confirm(`將「${g.label}」全部 ${targets.length} 人嘅「${it.label}」${level ? '設為「' + LEVEL_LABEL[level] + '」' : '還原為預設'}？`)) return
    setBusy(g.key + id)
    try { for (const m of targets) await api.setPermItem(m.emp_id, id, level || null); toast(`已更新「${g.label}」${targets.length} 人`); await load() } catch (ex) { toast('更新失敗：' + ex.message) }
    setBusy('')
  }
  async function setRole(r, role) {
    try { await api.updateStaffPerm(r.emp_id, { role }); toast('已更新角色：' + r.name); await load() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  const itemGroups = []
  ITEMS.forEach(i => { const g = itemGroups.find(x => x.name === i.group); if (g) g.items.push(i); else itemGroups.push({ name: i.group, items: [i] }) })
  const optsOf = it => ['view', ...(it.add ? ['add'] : []), 'edit', 'none']

  return (
    <div className="modal pm-modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet pm-sheet pm-wide">
        <div className="sheet-hd"><h2>權限管理（開發者）</h2><span className="sheet-hd-acts"><button className="mini pri" onClick={onClose}>關閉</button></span></div>
        <p className="src-note" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
          一張表睇晒 {staff ? staff.length : '…'} 個帳號 × {ITEMS.length} 個項目，按類別分組，撳組名可摺疊／展開。摺疊後每組一欄，揀一格即全組一次過設定；展開後可逐人修改。「公共地區主管」＝可以睇到公共地區嘅樓層主管。有綠點＝你手動改過（唔跟角色預設）。你本人嗰行不可修改。
        </p>
        <div className="pm-tools">
          <input className="search-inp" placeholder="搜尋姓名或員工編號" value={q} onChange={e => setQ(e.target.value)} />
          <button className="mini" onClick={() => setOpen(Object.fromEntries(GROUPS.map(g => [g.key, true])))}>全部展開</button>
          <button className="mini" onClick={() => setOpen({})}>全部摺疊</button>
        </div>
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {!staff && <div className="note">載入中…</div>}
        {staff && (
          <div className="pm-scroll">
            <table className="pm-t">
              <thead>
                <tr className="pm-ghd">
                  <th className="pm-corner" rowSpan={2}>項目 ＼ 帳號</th>
                  {groups.map(g => <th key={g.key} colSpan={isOpen(g) ? g.members.length : 1} className={'pm-g pm-g-' + g.key}><button onClick={() => setOpen({ ...open, [g.key]: !open[g.key] })}>{isOpen(g) ? '▾' : '▸'} {g.label}（{g.members.length}）</button></th>)}
                </tr>
                <tr>
                  {groups.map(g => isOpen(g)
                    ? g.members.map(r => <th key={r.emp_id} className={'pm-p' + (r.emp_id === session.key ? ' me' : '')}>
                        <b>{r.name}</b><small>{r.emp_id}</small>
                        <select value={r.role} disabled={r.emp_id === session.key} onChange={e => setRole(r, e.target.value)}>{ROLES.map(x => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select>
                      </th>)
                    : <th key={g.key} className="pm-p pm-sum"><b>{g.label}</b><small>{g.members.slice(0, 3).map(m => m.name.split(' ')[0]).join('、')}{g.members.length > 3 ? '…' : ''}</small></th>)}
                </tr>
              </thead>
              <tbody>
                {itemGroups.map(ig => (
                  <Fragment key={ig.name}>
                    <tr className="pm-grp"><td colSpan={colCount + 1}>{ig.name}</td></tr>
                    {ig.items.map(it => (
                      <tr key={it.id}>
                        <td className="pm-item">{it.label}</td>
                        {groups.map(g => isOpen(g)
                          ? g.members.map(r => {
                              const me = r.emp_id === session.key
                              const o = ov[r.emp_id] && ov[r.emp_id][it.id]
                              const e = eff(r, it.id)
                              return (
                                <td key={r.emp_id} className={'pm-c lv-' + e + (o ? ' ov' : '') + (me ? ' me' : '')}>
                                  <select value={o || ''} disabled={me || busy === r.emp_id + it.id} onChange={ev => setLevel(r, it.id, ev.target.value)} title={LEVEL_LABEL[e]}>
                                    <option value="">{SHORT[e]}・預設</option>
                                    {optsOf(it).map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                                  </select>
                                  <span className="pm-lv">{SHORT[e]}</span>
                                </td>
                              )
                            })
                          : (() => {
                              const lv = [...new Set(g.members.map(m => eff(m, it.id)))]
                              const e = lv.length === 1 ? lv[0] : 'mix'
                              const onlyMe = g.members.every(m => m.emp_id === session.key)
                              return (
                                <td key={g.key} className={'pm-c pm-sumc lv-' + e + (onlyMe ? ' me' : '')}>
                                  <select value="" disabled={onlyMe || busy === g.key + it.id} onChange={ev => ev.target.value && setGroup(g, it.id, ev.target.value === '__d' ? '' : ev.target.value)} title={e === 'mix' ? '全組唔一致：' + lv.map(x => LEVEL_LABEL[x]).join('／') : LEVEL_LABEL[e]}>
                                    <option value="">{e === 'mix' ? '混合' : LEVEL_LABEL[e]}（全組設定…）</option>
                                    {optsOf(it).map(l => <option key={l} value={l}>全組設為：{LEVEL_LABEL[l]}</option>)}
                                    <option value="__d">全組還原預設</option>
                                  </select>
                                  <span className="pm-lv">{SHORT[e]}</span>
                                </td>
                              )
                            })())}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pm-legend"><span className="lv-edit">改＝可編輯</span><span className="lv-add">增＝可新增</span><span className="lv-view">看＝只可查看</span><span className="lv-none">無＝睇唔到</span><span className="lv-mix">混＝全組唔一致</span></div>
      </div>
    </div>
  )
}
