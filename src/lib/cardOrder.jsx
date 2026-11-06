import { useEffect, useState } from 'react'
import * as api from './api'
import { toast } from './toast'
import { getSession } from './accounts'

// 卡片自訂排序：全部帳號共用（存喺資料庫 card_order），只有開發者／管理員見到「排序」掣
let cache = null            // { 排序位置key: [卡片id…] }
let loading = null
const subs = new Set()
const emit = () => subs.forEach(f => f(n => n + 1))
function load() {
  if (loading) return loading
  loading = api.dbSelect('card_order', { order: 'key' })
    .then(rows => { cache = Object.fromEntries(rows.map(r => [r.key, r.ids || []])) })
    .catch(() => { cache = cache || {} })
    .finally(() => { loading = null; emit() })
  return loading
}

export const canReorder = s => !s || !!s.dev || s.role === 'admin'

function sortBy(ids, items, idOf) {
  if (!ids || !ids.length) return items
  const rank = x => { const i = ids.indexOf(idOf(x)); return i < 0 ? 1e6 : i }
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map(o => o.x)
}

// okey：排序位置（例如 home／boh）；items：目前見到嘅卡片；children(list)：按自訂次序畫出卡片
export function Ordered({ okey, items, idOf = x => x.id, labelOf = x => x.label, bar = true, children }) {
  const [, bump] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => { subs.add(bump); if (!cache) load(); return () => { subs.delete(bump) } }, [])
  const list = sortBy(cache && cache[okey], items, idOf)
  return (
    <>
      {bar && canReorder(getSession()) && list.length > 1 && <div className="ord-bar"><button className="ord-btn" onClick={() => setOpen(true)}>⇅ 排序</button></div>}
      {children(list)}
      {open && <OrderSheet okey={okey} list={list} idOf={idOf} labelOf={labelOf} onClose={() => setOpen(false)} />}
    </>
  )
}

function OrderSheet({ okey, list, idOf, labelOf, onClose }) {
  const [ids, setIds] = useState(list.map(idOf))
  const [busy, setBusy] = useState(false)
  const lab = id => labelOf(list.find(x => idOf(x) === id))
  const move = (i, d) => setIds(a => { const j = i + d; if (j < 0 || j >= a.length) return a; const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b })
  async function save(next) {
    setBusy(true)
    try {
      const rest = next.length ? ((cache && cache[okey]) || []).filter(id => !next.includes(id)) : []   // 呢個帳號見唔到嘅卡片，保留原有相對次序（排喺後面）；next 空＝還原預設
      const all = [...next, ...rest]
      await api.dbUpsert('card_order', { key: okey, ids: all, updated_at: new Date().toISOString() }, 'key')
      cache = { ...(cache || {}), [okey]: all }; emit(); toast('已儲存排序'); onClose()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
    setBusy(false)
  }
  return (
    <div className="modal" style={{ zIndex: 70 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-hd"><h2>卡片排序</h2><span className="sheet-hd-acts"><button className="mini" onClick={onClose}>取消</button><button className="mini pri" disabled={busy} onClick={() => save(ids)}>儲存</button></span></div>
        <p className="src-note">用 ▲ ▼ 調整次序，儲存後所有帳號都會跟呢個次序。</p>
        {ids.map((id, i) => (
          <div className="ord-row" key={id}>
            <span className="ord-n">{i + 1}</span>
            <b>{lab(id)}</b>
            <button className="mini" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
            <button className="mini" disabled={i === ids.length - 1} onClick={() => move(i, 1)}>▼</button>
          </div>
        ))}
        <button className="btn ghost sm-quiet" disabled={busy} onClick={() => save([])}>還原預設次序</button>
      </div>
    </div>
  )
}
