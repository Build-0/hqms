import { useState } from 'react'
import * as api from '../lib/api'
import { toast } from '../lib/toast'

// 房務員名單管理：新增員工、改編號/樓層/姓名、停用、刪除（原本放在評分頁）
export const staffName = a => (a.name || a.name_cn || '') + (a.name_cn && a.name && a.name_cn !== a.name ? ` ${a.name_cn}` : '')

export default function StaffModal({ attendants, onClose, reload }) {
  const [n, setN] = useState({ emp_id: '', name_cn: '', name: '', floor: '' })
  const [q, setQ] = useState('')

  async function add() {
    const emp_id = n.emp_id.trim(), name = n.name.trim(), name_cn = n.name_cn.trim(), floor = n.floor.trim()
    if (!name && !name_cn) { toast('請填中文名或英文名'); return }
    const norm = x => String(x || '').toLowerCase().replace(/\s+/g, '')
    const dup = attendants.find(a => (emp_id && a.emp_id === emp_id) || (name && norm(a.name) === norm(name)) || (name_cn && norm(a.name_cn) === norm(name_cn)))
    if (dup) { toast(`已有相同員工：${staffName(dup)}${dup.emp_id ? ' (' + dup.emp_id + ')' : ''}`); return }
    try { await api.addAttendant({ name: name || name_cn, name_cn, floor, emp_id, sort_order: attendants.length }) } catch (ex) { toast('新增失敗：' + ex.message); return }
    setN({ emp_id: '', name_cn: '', name: '', floor: '' }); toast(`已新增 ${name || name_cn}`); reload()
  }
  async function patch(a, p, msg) { try { await api.updateAttendant(a.id, p); if (msg) toast(msg); reload() } catch (ex) { toast('更新失敗：' + ex.message) } }
  async function del(a) { try { await api.deleteAttendant(a.id); toast('已刪除'); reload() } catch (ex) { toast(ex.message) } }

  const list = attendants.filter(a => !q.trim() || (staffName(a) + (a.floor || '') + (a.emp_id || '')).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((x, y) => String(x.floor || '~').localeCompare(String(y.floor || '~'), undefined, { numeric: true }))
  return (
    <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <h2>人員名單（{attendants.length} 人）</h2>
        <div className="fd-std" style={{ marginTop: 0 }}>
          <div className="fd-std-h" style={{ color: 'var(--ink)' }}>新增員工</div>
          <div className="bh-row2">
            <div className="f-row"><label>員工編號</label><input inputMode="numeric" value={n.emp_id} onChange={e => setN({ ...n, emp_id: e.target.value })} placeholder="例 100672" /></div>
            <div className="f-row"><label>負責樓層</label><input value={n.floor} onChange={e => setN({ ...n, floor: e.target.value })} placeholder="例 3A" /></div>
          </div>
          <div className="bh-row2">
            <div className="f-row"><label>英文姓名</label><input value={n.name} onChange={e => setN({ ...n, name: e.target.value })} placeholder="Jenny Lai" /></div>
            <div className="f-row"><label>中文姓名</label><input value={n.name_cn} onChange={e => setN({ ...n, name_cn: e.target.value })} placeholder="賴振莉" /></div>
          </div>
          <button className="btn" onClick={add}>加入</button>
        </div>
        <input className="search-inp" style={{ marginTop: 12 }} placeholder="🔍 搜尋名單" value={q} onChange={e => setQ(e.target.value)} />
        {list.map(a => (
          <div key={a.id} className="st-row" style={a.active ? undefined : { opacity: .55 }}>
            <input className="st-fl" defaultValue={a.floor || ''} placeholder="樓層" onBlur={e => e.target.value.trim() !== (a.floor || '') && patch(a, { floor: e.target.value.trim() }, '已更新樓層')} />
            <input className="st-nm" defaultValue={a.name || ''} placeholder="英文名" onBlur={e => e.target.value.trim() !== (a.name || '') && e.target.value.trim() && patch(a, { name: e.target.value.trim() }, '已改名')} />
            <input className="st-nm" defaultValue={a.name_cn || ''} placeholder="中文名" onBlur={e => e.target.value.trim() !== (a.name_cn || '') && patch(a, { name_cn: e.target.value.trim() }, '已改名')} />
            <button className="mini" onClick={() => patch(a, { active: !a.active })}>{a.active ? '停用' : '啟用'}</button>
            <button className="mini danger" onClick={() => del(a)}>✕</button>
          </div>
        ))}
        <button className="btn ghost" onClick={onClose}>完成</button>
      </div>
    </div>
  )
}
