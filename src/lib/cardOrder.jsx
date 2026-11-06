import { useEffect, useState } from 'react'
import * as api from './api'
import { toast } from './toast'
import { getSession } from './accounts'
import Icon from '../components/Icon'

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

// 標題列右上角嘅排序圖示：目前畫面有可排序嘅卡片組先出現，撳一下開排序視窗
const regs = []
const regSubs = new Set()
const emitRegs = () => regSubs.forEach(f => f(n => n + 1))
export function OrderSettingsRow({ onPick }) {
  const [, bump] = useState(0)
  useEffect(() => { regSubs.add(bump); return () => { regSubs.delete(bump) } }, [])
  const r = regs[regs.length - 1]
  if (!r || !canReorder(getSession())) return null
  return (
    <>
      <div className="st2-sec">排序</div>
      <div className="st2-card">
        <button className="st2-row st2-act" onClick={() => { onPick(); r.open() }}>
          <Icon name="sort" size={20} width={2.2} />
          <span className="st2-lab">自訂卡片排序<small>調整目前呢一頁嘅卡片次序</small></span><span className="st2-go">›</span>
        </button>
      </div>
    </>
  )
}

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
  const orderable = bar && list.length > 1
  useEffect(() => {
    if (!orderable) return
    const r = { open: () => setOpen(true) }
    regs.push(r); emitRegs()
    return () => { regs.splice(regs.indexOf(r), 1); emitRegs() }
  }, [orderable])
  return (
    <>
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
      <div className="sheet ord-sheet">
        <div className="sheet-hd"><h2>卡片排序</h2><span className="sheet-hd-acts"><button className="mini" onClick={onClose}>取消</button><button className="mini pri" disabled={busy} onClick={() => save(ids)}>儲存</button></span></div>
        <p className="src-note">撳右邊箭咀移動，儲存後所有帳號都跟呢個次序。</p>
        <div className="ord-list">
          {ids.map((id, i) => (
            <div className="ord-row" key={id}>
              <span className="ord-n">{i + 1}</span>
              <b>{lab(id)}</b>
              <button className="ord-mv" aria-label="上移" disabled={i === 0} onClick={() => move(i, -1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg></button>
              <button className="ord-mv" aria-label="下移" disabled={i === ids.length - 1} onClick={() => move(i, 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>
            </div>
          ))}
        </div>
        <button className="btn ghost sm-quiet" disabled={busy} onClick={() => save([])}>還原預設次序</button>
      </div>
    </div>
  )
}
