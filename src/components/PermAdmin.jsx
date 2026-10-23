import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { PERMS, ROLE_LABEL } from '../lib/accounts'
import { toast } from '../lib/toast'

// 開發者專用：查看全部帳號的權限、各自會見到甚麼，並可直接修改（角色、公共地區查看、開發者）
// 真正的資料權限由資料庫（RLS）依「角色」把關；這裡改的是資料庫內每人的角色與旗標，對方下次登入或刷新即生效。
const ROLES = ['admin', 'store', 'clerk', 'supervisor']
const LVL = { edit: '可編輯', add: '可查看及新增', register: '只可登記', view: '只可查看' }
const MODS = [['quality', '房間品質'], ['findings', '查房記錄'], ['boh', '後勤管理'], ['defect', '缺陷管理']]

function seen(role, pub, dev) {
  const p = PERMS[role] || {}
  const out = MODS.filter(([k]) => p[k] && p[k] !== 'none').map(([k, l]) => `${l}：${LVL[p[k]] || p[k]}`)
  if (role === 'admin') out.push('公共地區：可編輯')
  else if (pub) out.push('公共地區：只可查看')
  if (dev) out.push('權限管理（開發者）')
  return out
}

export default function PermAdmin({ session, onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const load = () => api.listStaffPerms().then(r => { setRows(r); setErr('') }).catch(ex => { setErr(ex.message); setRows(prev => prev || []) })
  useEffect(() => { load() }, [])
  async function change(r, patch) {
    try { await api.updateStaffPerm(r.emp_id, patch); toast('已更新：' + r.name); load() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  const list = (rows || []).filter(r => !q.trim() || (r.name + r.emp_id).toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet pm-sheet">
        <div className="sheet-hd"><h2>權限管理（開發者）</h2><span className="sheet-hd-acts"><button className="mini pri" onClick={onClose}>關閉</button></span></div>
        <p className="src-note" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
          共 {rows ? rows.length : '…'} 個帳號。修改後，對方下次登入或刷新頁面即生效。權限以「角色」為單位，由資料庫把關；本人帳號的角色及開發者權限不可在此修改，避免鎖死自己。
        </p>
        <input className="search-inp" placeholder="搜尋姓名或員工編號" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
        {!rows && <div className="note">載入中…</div>}
        {list.map(r => {
          const me = r.emp_id === session.key
          return (
            <div className="pm-row" key={r.emp_id}>
              <div className="pm-top"><b>{r.name}</b><span>{r.emp_id}{me ? '（本人）' : ''}</span></div>
              <div className="pm-ctl">
                <select value={r.role} disabled={me} onChange={e => change(r, { role: e.target.value })}>{ROLES.map(x => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select>
                <label className={'pm-chk' + (r.role === 'admin' ? ' off' : '')}><input type="checkbox" checked={r.role === 'admin' ? true : !!r.pub_sup} disabled={r.role === 'admin'} onChange={e => change(r, { pub_sup: e.target.checked })} />公共地區可查看</label>
                <label className={'pm-chk'}><input type="checkbox" checked={!!r.is_dev} disabled={me} onChange={e => change(r, { is_dev: e.target.checked })} />開發者</label>
              </div>
              <div className="pm-seen">{seen(r.role, r.pub_sup, r.is_dev).map(t => <span key={t}>{t}</span>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
