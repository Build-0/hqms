import { SqChip } from '../../components/ui'
import { useMemo, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Confirm from '../../components/Confirm'
import { Thumb, ImageField, useImages, setCachedImage, ListManager, num } from './shared'

const EMPTY = { name: '', category: '', stock: 0, in_use: 0, min_stock: 0, status: '啟用', notes: '', image: '' }

export default function Tools({ d, edit, reload, reg }) {
  const [q, setQ] = useState('')
  const [fk, setFk] = useState('all')
  const [form, setForm] = useState(null)
  const [orig, setOrig] = useState('')
  const [del, setDel] = useState(null)
  const [mgr, setMgr] = useState(false)
  const tools = d.tools
  const img = useImages('tools', tools.map(t => t.id))
  const low = t => t.status !== '停用' && num(t.min_stock) > 0 && num(t.stock) < num(t.min_stock)
  const lowN = tools.filter(low).length, offN = tools.filter(t => t.status === '停用').length

  const shown = useMemo(() => tools.filter(t => {
    if (fk === 'low' && !low(t)) return false
    if (fk === 'off' && t.status !== '停用') return false
    if (fk === 'on' && t.status === '停用') return false
    if (!['all', 'low', 'off', 'on'].includes(fk) && t.category !== fk) return false
    const s = q.trim().toLowerCase()
    return !s || [t.name, t.category, t.notes].join(' ').toLowerCase().includes(s)
  }), [tools, q, fk])

  const catNames = [...d.toolCats.map(c => c.name), ...new Set(tools.map(t => t.category).filter(c => c && !d.toolCats.some(x => x.name === c)))]
  const groups = catNames.map(c => ({ c, items: shown.filter(t => t.category === c) })).filter(g => g.items.length)
  const noCat = shown.filter(t => !t.category || !catNames.includes(t.category))
  if (noCat.length) groups.push({ c: '（未分類）', items: noCat })

  function open(t) {
    const image = t ? img(t.id) || '' : ''
    setOrig(image)
    setForm(t ? { ...t, image } : { ...EMPTY, category: d.toolCats[0]?.name || '' })
  }
  async function save() {
    if (!form.name.trim()) { toast('請填工具名稱'); return }
    const row = { name: form.name.trim(), category: form.category, stock: num(form.stock), in_use: num(form.in_use), min_stock: num(form.min_stock), status: form.status, notes: form.notes || '' }
    try {
      if (form.image !== orig) row.image = form.image || null
      if (form.id) { await api.dbUpdate('tools', form.id, row); if (form.image !== orig) setCachedImage('tools', form.id, form.image) }
      else { const r = await api.dbInsert('tools', { ...row, sort_order: tools.length + 1, image: form.image || null }); setCachedImage('tools', r.id, form.image) }
      toast('已儲存'); setForm(null); reload()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function remove(t) {
    try { await api.dbDelete('tools', t.id); toast('已刪除'); setDel(null); setForm(null); reload() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }

  if (reg) reg.current = () => ({
    title: '清潔工具',
    filterText: [fk === 'all' ? '' : fk === 'low' ? '需補貨' : fk === 'off' ? '停用' : fk === 'on' ? '啟用' : fk, q.trim() && `搜尋「${q.trim()}」`].filter(Boolean).join(' · ') || '全部工具',
    cols: ['名稱', '庫存', '在用', '最低', '狀態'],
    groups: groups.map(g => ({
      name: g.c,
      rows: g.items.map(t => ({ photo: img(t.id), cells: [t.name, t.stock, num(t.in_use) || 0, num(t.min_stock) || '—', t.status], cls: ['', low(t) ? 'rpt-red' : '', '', '', ''] })),
    })),
  })
  const chip = (k, t) => <SqChip key={k} on={fk === k} onClick={() => setFk(k)} label={t} />
  return (
    <>
      <div className="fstk">
      <div className="srch-row">
        <input className="search-inp" placeholder="🔍 搜尋工具名稱、分類" value={q} onChange={e => setQ(e.target.value)} />
        {edit && <button className="tb-btn sq" title="管理分類" onClick={() => setMgr(true)}>⚙</button>}
      </div>
      <div className="df-grid" style={{ marginBottom: 6 }}>
        <select className="df-sel" value={['all', 'low', 'off'].includes(fk) ? fk : 'all'} onChange={e => setFk(e.target.value)}>
          <option value="all">{`全部 ${tools.length}`}</option>
          {lowN > 0 && <option value="low">{`🛒 需補貨 ${lowN}`}</option>}
          {offN > 0 && <option value="off">{`停用 ${offN}`}</option>}
        </select>
        <select className="df-sel" value={['all', 'low', 'off'].includes(fk) ? '' : fk} onChange={e => setFk(e.target.value || 'all')}>
          <option value="">所有分類</option>
          {d.toolCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      </div>
      {groups.length === 0 && <div className="note">沒有符合的工具</div>}
      {groups.map(g => (
        <div key={g.c}>
          <div className="bh-grp">{g.c}<span>{g.items.length}</span></div>
          <div className="sq-grid">
            {g.items.map(t => (
              <button className={`sq-card ${t.status === '停用' ? 'off' : ''}`} key={t.id} onClick={() => edit && open(t)}>
                <Thumb src={img(t.id)} fallback="🧹" size={64} />
                <span className="sq-name">{t.name}</span>
                <span className={`sq-n ${low(t) ? 'low' : ''}`}>{t.stock}<small>{t.status === '停用' ? '停用' : low(t) ? '需補貨' : '庫存'}</small></span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {edit && <button className="fab" onClick={() => open(null)}>＋</button>}

      {form && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? '編輯工具' : '新增工具'}</h2>
            <div className="f-row"><label>名稱 *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="f-row"><label>分類</label>
              <select className="df-sel" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">（未分類）</option>{catNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="bh-row3">
              <div className="f-row"><label>庫存</label><input type="number" inputMode="numeric" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
              <div className="f-row"><label>在用</label><input type="number" inputMode="numeric" value={form.in_use} onChange={e => setForm({ ...form, in_use: e.target.value })} /></div>
              <div className="f-row"><label>最低庫存</label><input type="number" inputMode="numeric" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>狀態</label>
              <select className="df-sel" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>啟用</option><option>停用</option></select>
            </div>
            <div className="f-row"><label>備註</label><input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <ImageField value={form.image} onChange={v => setForm({ ...form, image: v })} fallback="🧹" />
            <button className="btn" onClick={save}>儲存</button>
            {form.id && <button className="btn danger" onClick={() => setDel(form)}>刪除</button>}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}
      {del && <Confirm text={`會刪除工具「${del.name}」。`} onConfirm={() => remove(del)} onCancel={() => setDel(null)} />}
      {mgr && <ListManager title="工具分類" table="tool_categories" rows={d.toolCats} onClose={() => setMgr(false)} onChanged={reload}
        usedBy={async (a, b) => { for (const t of tools.filter(x => x.category === a)) await api.dbUpdate('tools', t.id, { category: b }) }} />}
    </>
  )
}
