import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { todayStr } from '../lib/dates'
import { PERMS } from '../lib/accounts'
import { ReportModal, BohReport } from '../components/Reports'
import Chemicals from './boh/Chemicals'
import Machines from './boh/Machines'
import Tools from './boh/Tools'
import { daysUntil, num } from './boh/shared'

// 後勤管理（原「酒店後勤系統」改寫為原生模組，只用中文）
const COLS = {
  products: 'id,category_id,name_zh,name_en,subname_zh,subname_en,applicable_zh,applicable_en,dilution_zh,dilution_en,rinse_zh,rinse_en,alt,stock,status,sort_order,min_stock',
  vacuums: 'id,model,brand,floor_code,status,notes,sort_order,label,serial',
  tools: 'id,name,stock,status,notes,sort_order,category,in_use,min_stock',
  equipment: 'id,type,model,brand,floor_code,status,notes,sort_order,label,serial,accessories',
}
const TABS = [['chem', '清潔劑'], ['vac', '吸塵機'], ['tool', '清潔工具'], ['eq', '設備']]
const EMPTY = { products: [], batches: [], cats: [], vacuums: [], vacMaint: [], floors: [], tools: [], toolCats: [], equipment: [], equipMaint: [], types: [] }

export default function Boh({ session }) {
  const edit = !session || PERMS[session.role].boh === 'edit'
  const [tab, setTab] = useState('chem')
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [report, setReport] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const S = api.dbSelect
      const [products, batches, cats, vacuums, vacMaint, floors, tools, toolCats, equipment, equipMaint, types] = await Promise.all([
        S('products', { cols: COLS.products, order: 'sort_order' }), S('product_batches'), S('boh_categories', { order: 'sort_order' }),
        S('vacuums', { cols: COLS.vacuums, order: 'sort_order' }), S('vacuum_maintenance'), S('vacuum_floors', { order: 'sort_order' }),
        S('tools', { cols: COLS.tools, order: 'sort_order' }), S('tool_categories', { order: 'sort_order' }),
        S('equipment', { cols: COLS.equipment, order: 'sort_order' }), S('equipment_maintenance'), S('equipment_types', { order: 'sort_order' }),
      ])
      setD({ products, batches, cats, vacuums, vacMaint, floors, tools, toolCats, equipment, equipMaint, types }); setErr('')
    } catch (ex) { setErr(ex.message); setD(prev => prev || EMPTY) }
  }
  if (!d) return <div className="note">載入中…</div>

  function reportData() {
    const cnt = (arr, key) => { const o = {}; arr.forEach(x => { const k = x[key] || '（未填）'; o[k] = (o[k] || 0) + 1 }); return o }
    const act = p => p.status !== '停用'
    const low = d.products.filter(p => act(p) && num(p.min_stock) > 0 && num(p.stock) < num(p.min_stock)).map(p => ({ name: p.name_zh, stock: p.stock, min: p.min_stock }))
    const expiring = []
    d.batches.forEach(b => {
      const p = d.products.find(x => x.id === b.product_id)
      if (!p || !act(p) || !b.expiry_date || num(b.qty_remaining) <= 0) return
      const dd = daysUntil(b.expiry_date)
      if (dd !== null && dd <= 30) expiring.push({ name: p.name_zh, expiry: b.expiry_date, qty: b.qty_remaining, days: dd })
    })
    expiring.sort((a, b) => a.days - b.days)
    const byType = {}
    d.equipment.forEach(e => { const t = e.type || '（未填）'; byType[t] = byType[t] || {}; byType[t][e.status] = (byType[t][e.status] || 0) + 1 })
    const byCat = {}
    d.tools.forEach(t => { const c = t.category || '（未分類）'; const o = (byCat[c] = byCat[c] || { items: 0, stock: 0 }); o.items++; o.stock += num(t.stock) })
    return {
      products: { active: d.products.filter(act).length, total: d.products.length }, low, expiring,
      vacuums: { total: d.vacuums.length, byStatus: cnt(d.vacuums, 'status'), byFloor: cnt(d.vacuums, 'floor_code') },
      equipment: { total: d.equipment.length, byStatus: cnt(d.equipment, 'status'), byType },
      tools: { total: d.tools.length, byCat },
    }
  }

  return (
    <div className="df-wrap">
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      <div className="chips wrap" style={{ marginBottom: 6 }}>
        {TABS.map(([k, t]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}
        <button className="chip" onClick={() => setReport(true)}>📄 匯出</button>
      </div>
      {!edit && <p className="note" style={{ textAlign: 'left', margin: '0 4px 6px' }}>目前帳號只可查看</p>}
      {tab === 'chem' && <Chemicals d={d} edit={edit} reload={load} />}
      {tab === 'vac' && <Machines kind="vacuum" d={d} edit={edit} reload={load} />}
      {tab === 'tool' && <Tools d={d} edit={edit} reload={load} />}
      {tab === 'eq' && <Machines kind="equipment" d={d} edit={edit} reload={load} />}
      {report && (
        <ReportModal title="後勤管理報告" sub={todayStr()} onClose={() => setReport(false)}>
          <BohReport data={reportData()} />
        </ReportModal>
      )}
    </div>
  )
}
