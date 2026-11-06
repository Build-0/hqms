import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
import { useBack } from '../lib/nav'
import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { todayStr } from '../lib/dates'
import { permsOf } from '../lib/accounts'
import { ReportModal, ListReport } from '../components/Reports'
import Icon from '../components/Icon'
import Chemicals from './boh/Chemicals'
import Machines from './boh/Machines'
import Tools from './boh/Tools'
import Supplies from './boh/Supplies'
import WriteOff from './boh/WriteOff'
import RoomSale from './boh/RoomSale'
import { Ordered } from '../lib/cardOrder'
import { itemLevel } from '../lib/accounts'
import { daysUntil, num } from './boh/shared'

// 後勤管理（原「酒店後勤系統」改寫為原生模組，只用中文）
const COLS = {
  products: 'id,category_id,name_zh,name_en,subname_zh,subname_en,applicable_zh,applicable_en,dilution_zh,dilution_en,rinse_zh,rinse_en,alt,stock,status,sort_order,min_stock',
  vacuums: 'id,model,brand,floor_code,status,notes,sort_order,label,serial',
  tools: 'id,name,stock,status,notes,sort_order,category,in_use,min_stock',
  equipment: 'id,type,model,brand,floor_code,status,notes,sort_order,label,serial,accessories',
  supplies: 'id,name,category,unit,stock,min_stock,status,supplier,notes,sort_order',
}
const TABS = [['chem', '清潔劑', 'drop', '#2f8f9d'], ['vac', '吸塵機', 'clean', '#54808c'], ['tool', '清潔工具', 'wrench', '#b5603a'], ['eq', '設備', 'gear', '#7a6a4f'], ['sup', '客房物資消耗品', 'box', '#8a5fa8'], ['wo', '報銷與遺失管理', 'search', '#c0564f'], ['rs', '房間可售物品', 'tag', '#2f8f9d']]
const EMPTY = { supplies: [], supplyCats: [], binAreas: [], binCounts: [],products: [], batches: [], cats: [], vacuums: [], vacMaint: [], floors: [], tools: [], toolCats: [], equipment: [], equipMaint: [], types: [] }

export default function Boh({ session, init }) {
  const edit = permsOf(session).boh === 'edit'
  const woLevel = itemLevel(session, 'writeoff')   // 報銷與遺失管理：沿用原本獨立權限（開發中，預設只限開發者）
  const rsLevel = itemLevel(session, 'roomsale')   // 房間可售物品：同上
  const [tab, setTab] = useState(init ? (init.tab || 'chem') : null)   // null ＝ 圓形入口選單；從首頁摘要跳入（補貨／臨期）直接開清潔劑
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [report, setReport] = useState(null)   // 目前篩選結果的報告資料
  useBack(!!tab, () => setTab(null))
  const toolReg = useRef(null)                // 「需補貨」同頁顯示的清潔工具報告（匯出時合併）
  const reg = useRef(null)                    // 目前分頁登記的「產生報告」函式

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const S = api.dbSelect
      const [products, batches, cats, vacuums, vacMaint, floors, tools, toolCats, equipment, equipMaint, types, binAreas, binCounts, supplies, supplyCats] = await Promise.all([
        S('products', { cols: COLS.products, order: 'sort_order' }), S('product_batches'), S('boh_categories', { order: 'sort_order' }),
        S('vacuums', { cols: COLS.vacuums, order: 'sort_order' }), S('vacuum_maintenance'), S('vacuum_floors', { order: 'sort_order' }),
        S('tools', { cols: COLS.tools, order: 'sort_order' }), S('tool_categories', { order: 'sort_order' }),
        S('equipment', { cols: COLS.equipment, order: 'sort_order' }), S('equipment_maintenance'), S('equipment_types', { order: 'sort_order' }),
        S('bin_areas', { order: 'sort_order' }).catch(() => []), S('bin_counts').catch(() => []),
        S('supplies', { cols: COLS.supplies, order: 'sort_order' }).catch(() => []), S('supply_categories', { order: 'sort_order' }).catch(() => []),
      ])
      setD({ supplies, supplyCats, binAreas, binCounts, products, batches, cats, vacuums, vacMaint, floors, tools, toolCats, equipment, equipMaint, types }); setErr('')
    } catch (ex) { setErr(ex.message); setD(prev => prev || EMPTY) }
  }
  if (!d) return <div className="note">載入中…</div>
  const lowTool = d.tools.some(t => t.status !== '停用' && num(t.min_stock) > 0 && num(t.stock) < num(t.min_stock))
  const combined = tab === 'chem' && init?.fk === 'low' && lowTool
  if (!combined) toolReg.current = null
  // 清潔劑報告 + （同頁顯示時）需補貨清潔工具，合併成一份匯出
  const makeReport = () => {
    const r = (reg.current && reg.current()) || { title: '', filterText: '', cols: [], groups: [] }
    const t = combined && toolReg.current ? toolReg.current() : null
    if (!t || !t.groups.length) return r
    return { ...r, title: '需補貨（清潔劑＋清潔工具）', filterText: '需補貨', groups: [...r.groups, ...t.groups.map(g => ({ name: '🧹 清潔工具 · ' + g.name, rows: g.rows.map(x => ({ ...x, cells: [x.cells[0], x.cells[1], x.cells[3], '—', x.cells[4]] })) }))] }
  }


  return (
    <div className="df-wrap">
      {err && <div className="card" style={{ borderColor: 'var(--red)' }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>讀取失敗：{err}</p></div>}
      {!tab && (
        <Ordered okey="boh" idOf={x => x[0]} labelOf={x => x[1]} items={TABS.filter(x => (x[0] !== 'wo' || woLevel !== 'none') && (x[0] !== 'rs' || rsLevel !== 'none'))}>{list => (
          <div className="home-grid">
            {list.map(([k, t, ic, co]) => (
              <button className="home-item" key={k} onClick={() => setTab(k)}>
                <span className="hi-circle" style={{ background: co + '26', borderColor: 'transparent' }}><Icon name={ic} size={33} color={co} width={2.2} /></span>
                <span className="hi-label">{t}</span>
                <span className="hi-sub">{k === 'wo' ? '報銷、遺失、跟進' : k === 'rs' ? '價錢、庫存' : `${{ chem: d.products.length, vac: d.vacuums.length, tool: d.tools.length, eq: d.equipment.length, sup: d.supplies.length }[k]} 項`}</span>
              </button>
            ))}
          </div>
        )}</Ordered>
      )}
      {tab && tab !== 'wo' && tab !== 'rs' && <ToolBar sticky label={TABS.find(x => x[0] === tab)[1]}><ExportBtn onClick={() => setReport(makeReport())} /></ToolBar>}
      {!edit && <p className="note" style={{ textAlign: 'left', margin: '0 4px 6px' }}>目前帳號只可查看</p>}
      {tab === 'chem' && init?.fk === 'low' && (() => {
        const lw = x => x.status !== '停用' && num(x.min_stock) > 0 && num(x.stock) < num(x.min_stock)
        const nc = d.products.filter(lw).length, nt = d.tools.filter(lw).length
        return nt > 0 ? <div style={{ margin: '0 0 8px', padding: '9px 14px', borderRadius: 12, background: '#fdecea', color: '#b3342a', fontWeight: 700, fontSize: 14 }}>🛒 需補貨共 {nc + nt} 項　<span style={{ fontWeight: 500 }}>清潔劑 {nc} ・ 清潔工具 {nt}</span></div> : null
      })()}
      {tab === 'chem' && <Chemicals d={d} edit={edit} reload={load} init={init} reg={reg} />}
      {combined && (
        <>
          <h2 style={{ fontSize: 15, margin: '18px 4px 6px' }}>🧹 清潔工具需補貨</h2>
          <Tools d={d} edit={edit} reload={load} init={init} reg={toolReg} embedded />
        </>
      )}
      {tab === 'vac' && <Machines kind="vacuum" d={d} edit={edit} reload={load} reg={reg} />}
      {tab === 'tool' && <Tools d={d} edit={edit} reload={load} reg={reg} init={init} />}
      {tab === 'eq' && <Machines kind="equipment" d={d} edit={edit} reload={load} reg={reg} />}
      {tab === 'sup' && <Supplies d={d} edit={edit} reload={load} reg={reg} who={session ? session.name : ''} />}
      {tab === 'wo' && woLevel !== 'none' && <WriteOff edit={woLevel === 'edit'} who={session ? session.name : ''} />}
      {tab === 'rs' && rsLevel !== 'none' && <RoomSale edit={rsLevel === 'edit'} />}
      {report && (
        <ReportModal title={`後勤管理 · ${report.title}`} sub={`${report.filterText} · ${todayStr()}`} onClose={() => setReport(null)}>
          <ListReport data={report} />
        </ReportModal>
      )}
    </div>
  )
}
