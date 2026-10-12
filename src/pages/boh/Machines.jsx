import { useMemo, useState } from 'react'
import * as api from '../../lib/api'
import { toast } from '../../lib/toast'
import Confirm from '../../components/Confirm'
import { Thumb, ImageField, useImages, setCachedImage, ListManager, today } from './shared'

const natural = (a, b) => String(a || '').localeCompare(String(b || ''), 'zh-Hant', { numeric: true })
const STATUS_CLS = { 正常: 'b-teal', 維修中: 'b-amber', 報廢: 'b-gray', 遺失: 'b-red' }
const numOf = l => (String(l || '').match(/(\d+)\s*$/) || [])[1]

// 吸塵機與設備共用：每台獨立、可記保養記錄
export default function Machines({ kind, d, edit, reload, reg }) {
  const isVac = kind === 'vacuum'
  const C = isVac
    ? { table: 'vacuums', mtable: 'vacuum_maintenance', fk: 'vacuum_id', items: d.vacuums, maint: d.vacMaint, statuses: ['正常', '維修中', '報廢'], icon: '🌀', name: '吸塵機', groupOf: v => v.floor_code || '（未填位置）' }
    : { table: 'equipment', mtable: 'equipment_maintenance', fk: 'equipment_id', items: d.equipment, maint: d.equipMaint, statuses: ['正常', '維修中', '報廢', '遺失'], icon: '🧰', name: '設備', groupOf: e => e.type || '（未分類）' }
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [grp, setGrp] = useState('')
  const [view, setView] = useState(null)
  const [form, setForm] = useState(null)
  const [orig, setOrig] = useState('')
  const [del, setDel] = useState(null)
  const [mgr, setMgr] = useState(false)
  const [m, setM] = useState({ date: today(), text: '' })
  const img = useImages(C.table, C.items.map(x => x.id))

  const title = x => (isVac ? x.label || x.model || `#${x.id}` : `${x.type || ''} ${numOf(x.label) || x.label || ''}`.trim())
  const sub = x => (isVac ? [x.model, x.brand].filter(Boolean).join(' · ') : [x.label, x.model, x.brand].filter(Boolean).join(' · '))

  const shown = useMemo(() => C.items.filter(x => {
    if (st && x.status !== st) return false
    if (grp && C.groupOf(x) !== grp) return false
    const s = q.trim().toLowerCase()
    return !s || [x.label, x.model, x.brand, x.serial, x.floor_code, x.notes, x.type].join(' ').toLowerCase().includes(s)
  }).sort((a, b) => natural(C.groupOf(a), C.groupOf(b)) || natural(a.label, b.label)), [C.items, q, st, grp])

  const groupNames = isVac ? d.floors.map(f => f.name) : d.types.map(t => t.name)
  const present = [...new Set(C.items.map(C.groupOf))].sort(natural)
  const allGroups = [...groupNames.filter(g => present.includes(g)), ...present.filter(g => !groupNames.includes(g))]
  const groups = allGroups.map(g => ({ g, items: shown.filter(x => C.groupOf(x) === g) })).filter(x => x.items.length)
  const countBy = s => C.items.filter(x => x.status === s).length
  const mOf = id => C.maint.filter(r => r[C.fk] === id).sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)))

  function open(x) {
    const image = x ? img(x.id) || '' : ''
    setOrig(image)
    setForm(x ? { ...x, image, accessories: x.accessories || [] } : { label: '', serial: '', model: '', brand: '', floor_code: isVac ? (d.floors[0]?.name || '') : '', type: isVac ? undefined : (d.types[0]?.name || ''), status: '正常', notes: '', image: '', accessories: [] })
    setView(null)
  }
  async function save() {
    if (!isVac && !form.type) { toast('請選擇設備類型'); return }
    if (!form.label.trim() && !form.model?.trim()) { toast('請填機號或型號'); return }
    const row = { label: form.label.trim(), serial: form.serial || '', model: form.model || '', brand: form.brand || '', floor_code: form.floor_code || '', status: form.status, notes: form.notes || '' }
    if (!isVac) { row.type = form.type; row.accessories = (form.accessories || []).filter(a => a.name.trim()) }
    try {
      if (form.image !== orig) row.image = form.image || null
      if (form.id) { await api.dbUpdate(C.table, form.id, row); if (form.image !== orig) setCachedImage(C.table, form.id, form.image) }
      else { const r = await api.dbInsert(C.table, { ...row, sort_order: C.items.length + 1, image: form.image || null }); setCachedImage(C.table, r.id, form.image) }
      toast('已儲存'); setForm(null); reload()
    } catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function remove(x) {
    try { await api.dbDelete(C.table, x.id); toast('已刪除'); setDel(null); setView(null); setForm(null); reload() } catch (ex) { toast('刪除失敗：' + ex.message) }
  }
  async function addMaint() {
    if (!m.text.trim()) { toast('請填保養內容'); return }
    try { await api.dbInsert(C.mtable, { [C.fk]: view.id, service_date: m.date || today(), description: m.text.trim() }); setM({ date: today(), text: '' }); reload() } catch (ex) { toast('新增失敗：' + ex.message) }
  }
  async function delMaint(r) { try { await api.dbDelete(C.mtable, r.id); reload() } catch (ex) { toast('刪除失敗：' + ex.message) } }
  async function toggleAcc(i) {
    const acc = (view.accessories || []).map((a, k) => (k === i ? { ...a, ok: !a.ok } : a))
    try { await api.dbUpdate(C.table, view.id, { accessories: acc }); setView({ ...view, accessories: acc }); reload() } catch (ex) { toast('更新失敗：' + ex.message) }
  }
  const cur = view && (C.items.find(x => x.id === view.id) || view)

  if (reg) reg.current = () => ({
    title: C.name,
    filterText: [st, grp, q.trim() && `搜尋「${q.trim()}」`].filter(Boolean).join(' · ') || `全部${C.name}`,
    cols: isVac ? ['機號', '型號／品牌', '序號', '狀態'] : ['設備', '機號／型號', '位置', '狀態'],
    groups: groups.map(g => ({
      name: g.g,
      rows: g.items.map(x => ({
        photo: img(x.id),
        cells: isVac ? [title(x), sub(x) || '—', x.serial || '—', x.status] : [title(x), [x.label, x.model, x.brand].filter(Boolean).join(' · ') || '—', x.floor_code || '—', x.status],
        cls: ['', '', '', x.status !== '正常' ? 'rpt-red' : ''],
      })),
    })),
  })
  const chip = (on, set, t, k) => <button key={k} className={`chip ${on ? 'on' : ''}`} onClick={set}>{t}</button>
  return (
    <>
      <div className="fstk">
      <div className="srch-row">
      <input className="search-inp" placeholder={isVac ? '🔍 搜尋機號、型號、序號、位置' : '🔍 搜尋類型、機號、型號、位置'} value={q} onChange={e => setQ(e.target.value)} />
        {edit && <button className="tb-btn sq" title={'管理' + (isVac ? '位置' : '類型')} onClick={() => setMgr(true)}>⚙</button>}
      </div>
      <div className="df-grid" style={{ marginBottom: 8 }}>
        <select className="df-sel" value={st} onChange={e => setSt(e.target.value)}>
          <option value="">{`全部狀態 ${C.items.length}`}</option>
          {C.statuses.map(x => countBy(x) > 0 && <option key={x} value={x}>{`${x} ${countBy(x)}`}</option>)}
        </select>
        <select className="df-sel" value={grp} onChange={e => setGrp(e.target.value)}>
          <option value="">{isVac ? '所有位置' : '所有類型'}</option>
          {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      </div>
      {groups.length === 0 && <div className="note">沒有符合的{C.name}</div>}
      {groups.map(g => (
        <div key={g.g}>
          <div className="bh-grp">{g.g}<span>{g.items.length}</span></div>
          {g.items.map(x => (
            <div className="c-item bh-item" key={x.id} onClick={() => setView(x)}>
              <Thumb src={img(x.id)} fallback={C.icon} />
              <div className="bh-main">
                <div className="bh-name">{title(x)}<span className={`badge ${STATUS_CLS[x.status] || 'b-gray'}`}>{x.status}</span></div>
                <div className="bh-sub">{sub(x) || ' '}</div>
                {x.serial && <div className="bh-note">S/N {x.serial}</div>}
                {!isVac && x.floor_code && <div className="bh-note">📍 {x.floor_code}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {edit && <button className="fab" onClick={() => open(null)}>＋</button>}

      {cur && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="sheet">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <Thumb src={img(cur.id)} fallback={C.icon} size={84} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>{title(cur)}</h2>
                <div className="bh-sub">{sub(cur)}</div>
                <span className={`badge ${STATUS_CLS[cur.status] || 'b-gray'}`}>{cur.status}</span>
              </div>
            </div>
            {cur.serial && <div className="kv"><span className="k">序號</span><span className="v">{cur.serial}</span></div>}
            <div className="kv"><span className="k">位置</span><span className="v">{cur.floor_code || '—'}</span></div>
            {cur.notes && <div className="kv"><span className="k">備註</span><span className="v">{cur.notes}</span></div>}
            {!isVac && (cur.accessories || []).length > 0 && (
              <div className="fd-std"><div className="fd-std-h" style={{ color: 'var(--ink)' }}>配件</div>
                {cur.accessories.map((a, i) => (
                  <label key={i} className="bh-acc"><input type="checkbox" checked={!!a.ok} disabled={!edit} onChange={() => toggleAcc(i)} /> <span style={a.ok ? undefined : { color: 'var(--red)' }}>{a.name}{a.ok ? '' : '（缺）'}</span></label>
                ))}
              </div>
            )}
            <div className="fd-std"><div className="fd-std-h" style={{ color: 'var(--ink)' }}>保養記錄（{mOf(cur.id).length}）</div>
              {mOf(cur.id).length === 0 && <div className="fd-std-none">未有記錄</div>}
              {mOf(cur.id).map(r => (
                <div key={r.id} className="bh-maint"><span className="bh-md">{r.service_date}</span><span style={{ flex: 1 }}>{r.description}</span>{edit && <button className="linky" style={{ color: 'var(--red)' }} onClick={() => delMaint(r)}>✕</button>}</div>
              ))}
              {edit && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" className="df-sel" style={{ flex: '0 0 150px' }} value={m.date} onChange={e => setM({ ...m, date: e.target.value })} />
                    <input className="df-sel" placeholder="保養／維修內容" value={m.text} onChange={e => setM({ ...m, text: e.target.value })} />
                  </div>
                  <button className="btn" style={{ marginTop: 8 }} onClick={addMaint}>新增保養記錄</button>
                </div>
              )}
            </div>
            {edit && <button className="btn ghost" onClick={() => open(cur)}>✎ 編輯</button>}
            <button className="btn ghost" onClick={() => setView(null)}>關閉</button>
          </div>
        </div>
      )}

      {form && (
        <div className="modal" style={{ zIndex: 55 }} onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="sheet">
            <h2>{form.id ? `編輯${C.name}` : `新增${C.name}`}</h2>
            {!isVac && <div className="f-row"><label>設備類型 *</label>
              <select className="df-sel" value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })}>{d.types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
            </div>}
            <div className="bh-row2">
              <div className="f-row"><label>機號（標籤）</label><input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
              <div className="f-row"><label>序號 S/N</label><input value={form.serial || ''} onChange={e => setForm({ ...form, serial: e.target.value })} /></div>
            </div>
            <div className="bh-row2">
              <div className="f-row"><label>型號</label><input value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
              <div className="f-row"><label>品牌</label><input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
            </div>
            <div className="f-row"><label>位置</label>
              {isVac
                ? <select className="df-sel" value={form.floor_code || ''} onChange={e => setForm({ ...form, floor_code: e.target.value })}><option value="">（未填）</option>{d.floors.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select>
                : <input value={form.floor_code || ''} list="bh-locs" onChange={e => setForm({ ...form, floor_code: e.target.value })} />}
              {!isVac && <datalist id="bh-locs">{[...new Set(C.items.map(x => x.floor_code).filter(Boolean))].map(l => <option key={l} value={l} />)}</datalist>}
            </div>
            <div className="f-row"><label>狀態</label>
              <select className="df-sel" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{C.statuses.map(s => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="f-row"><label>備註</label><input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            {!isVac && (
              <div className="f-row"><label>配件</label>
                {(form.accessories || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input className="df-sel" value={a.name} onChange={e => setForm({ ...form, accessories: form.accessories.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} />
                    <button className="mini danger" onClick={() => setForm({ ...form, accessories: form.accessories.filter((_, k) => k !== i) })}>✕</button>
                  </div>
                ))}
                <button className="linky" onClick={() => setForm({ ...form, accessories: [...(form.accessories || []), { name: '', ok: true }] })}>＋ 新增配件</button>
              </div>
            )}
            <ImageField value={form.image} onChange={v => setForm({ ...form, image: v })} fallback={C.icon} />
            <button className="btn" onClick={save}>儲存</button>
            {form.id && <button className="btn danger" onClick={() => setDel(form)}>刪除</button>}
            <button className="btn ghost" onClick={() => setForm(null)}>取消</button>
          </div>
        </div>
      )}
      {del && <Confirm text={`會刪除「${title(del)}」及其保養記錄。`} onConfirm={() => remove(del)} onCancel={() => setDel(null)} />}
      {mgr && (isVac
        ? <ListManager title="吸塵機位置" table="vacuum_floors" rows={d.floors} onClose={() => setMgr(false)} onChanged={reload}
            usedBy={async (a, b) => { for (const v of d.vacuums.filter(x => x.floor_code === a)) await api.dbUpdate('vacuums', v.id, { floor_code: b }) }} />
        : <ListManager title="設備類型" table="equipment_types" rows={d.types} onClose={() => setMgr(false)} onChanged={reload}
            usedBy={async (a, b) => { for (const e of d.equipment.filter(x => x.type === a)) await api.dbUpdate('equipment', e.id, { type: b }) }} />)}
    </>
  )
}
