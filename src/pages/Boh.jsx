import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { todayStr } from '../lib/dates'
import { PERMS } from '../lib/accounts'
import { ReportModal, ListReport } from '../components/Reports'
import Icon from '../components/Icon'
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
const TABS = [['chem', '清潔劑', 'drop', '#2f8f9d'], ['vac', '吸塵機', 'clean', '#54808c'], ['tool', '清潔工具', 'wrench', '#b5603a'], ['eq', '設備', 'gear', '#7a6a4f']]
const EMPTY = { products: [], batches: [], cats: [], vacuums: [], vacMaint: [], floors: [], tools: [], toolCats: [], equipment: [], equipMaint: [], types: [] }

export default function Boh({ session, init }) {
  const edit = !session || PERMS[session.role].boh === 'edit'
  const [tab, setTab] = useState(init ? 'chem' : null)   // null ＝ 圓形入口選單；從首頁摘要跳入（補貨／臨期）直接開清潔劑
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [report, setReport] = useState(null)   // 目前篩選結果的報告資料
  const reg = useRef(null)                    // 目前分頁登記的「產生報告」函式

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


  return (
    <div className="df-wrap">
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {!tab && (
        <div className="home-grid">
          {TABS.map(([k, t, ic, co]) => (
            <button className="home-item" key={k} onClick={() => setTab(k)}>
              <span className="hi-circle" style={{ background: co + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={co} width={2.2} /></span>
              <span className="hi-label">{t}</span>
              <span className="hi-sub">{{ chem: d.products.length, vac: d.vacuums.length, tool: d.tools.length, eq: d.equipment.length }[k]} 項</span>
            </button>
          ))}
        </div>
      )}
      {tab && <ToolBar label={<button className="linky" style={{ fontSize: 14.5, fontWeight: 700, padding: 0 }} onClick={() => setTab(null)}>‹ {TABS.find(x => x[0] === tab)[1]}</button>}><ExportBtn onClick={() => setReport((reg.current && reg.current()) || { title: '', filterText: '', cols: [], groups: [] })} /></ToolBar>}
      {!edit && <p className="note" style={{ textAlign: 'left', margin: '0 4px 6px' }}>目前帳號只可查看</p>}
      {tab === 'chem' && <Chemicals d={d} edit={edit} reload={load} init={init} reg={reg} />}
      {tab === 'vac' && <Machines kind="vacuum" d={d} edit={edit} reload={load} reg={reg} />}
      {tab === 'tool' && <Tools d={d} edit={edit} reload={load} reg={reg} />}
      {tab === 'eq' && <Machines kind="equipment" d={d} edit={edit} reload={load} reg={reg} />}
      {report && (
        <ReportModal title={`後勤管理 · ${report.title}`} sub={`${report.filterText} · ${todayStr()}`} onClose={() => setReport(null)}>
          <ListReport data={report} />
        </ReportModal>
      )}
    </div>
  )
}
