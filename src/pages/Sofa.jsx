import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { ToolBar, ToolBtn, ExportBtn } from '../components/ui'
import { ReportModal, ListReport } from '../components/Reports'
import { toast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { SUP_FLOORS } from '../lib/accounts'
import { SOFA_ROOMS, SOFA_FLOORS, SOFA_TYPE } from '../data/sofaRooms'

// 大床梳化檢查總表：每間房一個格仔，顏色 = 缺陷嚴重度／已修復／已確認無問題／未檢查
const ST = {
  high: { t: '嚴重', c: '#fff', bg: '#d32f2f' },
  medium: { t: '中度', c: '#fff', bg: '#f57c00' },
  low: { t: '輕微', c: '#4a3b00', bg: '#f6c90e' },
  fixed: { t: '已修復', c: '#17624f', bg: '#bfe3d9' },
  ok: { t: '已確認無問題', c: '#fff', bg: '#2e9e5b' },
  none: { t: '未檢查', c: '#7a8894', bg: '#fff' },
}
const ORDER = ['high', 'medium', 'low', 'fixed', 'ok', 'none']

export default function Sofa({ list, session, onList }) {
  const [checks, setChecks] = useState(null)
  const [err, setErr] = useState('')
  const [fl, setFl] = useState(0)          // 0 ＝ 全部樓層
  const [sel, setSel] = useState(null)
  const [report, setReport] = useState(false)
  const [rmode, setRmode] = useState('sheet')   // 匯出：sheet 檢查表（每層一頁，打勾用）／summary 總表
  const isSup = !!session && session.role === 'supervisor'
  const mine = isSup ? SUP_FLOORS[session.id || session.key] : null
  const floors = mine && mine.length ? mine.map(Number) : SOFA_FLOORS
  const canConfirm = !session || session.role === 'admin' || session.role === 'supervisor'

  useEffect(() => { load() }, [])
  async function load() {
    try { setChecks(await api.dbSelect('sofa_checks')); setErr('') }
    catch (ex) { setChecks([]); setErr(ex.message) }
  }
  const chkOf = useMemo(() => Object.fromEntries((checks || []).map(c => [c.room, c])), [checks])
  const defOf = room => (list || []).filter(d => d.room === room && SOFA_TYPE.test(d.type || ''))
  const stateOf = room => {
    const ds = defOf(room)
    const open = ds.filter(d => d.status !== 'done')
    if (open.length) return { k: ['high', 'medium', 'low'].find(s => open.some(d => d.severity === s)) || 'low', ds }
    if (ds.length) return { k: 'fixed', ds }
    if (chkOf[room]) return { k: 'ok', ds }
    return { k: 'none', ds }
  }
  const rooms = SOFA_ROOMS.filter(r => floors.includes(r.floor))
  const rows = rooms.map(r => ({ ...r, ...stateOf(r.room) }))
  const shown = fl ? rows.filter(r => r.floor === fl) : rows
  const count = (arr, k) => arr.filter(r => r.k === k).length
  const checkedN = rows.filter(r => r.k !== 'none').length

  async function confirmOk(room) {
    try { await api.dbInsert('sofa_checks', { room, ok_by: session ? session.name : '' }); toast('已確認 ' + room + ' 無問題'); setSel(null); load() }
    catch (ex) { toast('儲存失敗：' + ex.message) }
  }
  async function undoOk(room) {
    try { await api.dbDelete('sofa_checks', chkOf[room].id); toast('已取消確認'); setSel(null); load() }
    catch (ex) { toast('取消失敗：' + ex.message) }
  }

  if (checks === null) return <div className="note">載入中…</div>
  const cur = sel ? rows.find(r => r.room === sel) : null

  const reportData = () => ({
    filterText: (fl ? `${fl} 樓` : floors.map(f => `${f} 樓`).join('、')) + `（共 ${shown.length} 間）`,
    cols: ['房號', '狀態', '備註／確認人'],
    groups: floors.filter(f => !fl || f === fl).map(f => ({
      name: `${f} 樓`,
      rows: shown.filter(r => r.floor === f).map(r => ({
        cells: [r.room + (r.suite ? '（套房）' : ''), ST[r.k].t, r.k === 'ok' ? (chkOf[r.room].ok_by || '') : (r.ds.filter(d => d.status !== 'done')[0]?.note || '')],
        cls: ['', r.k === 'high' ? 'rpt-red' : '', ''],
      })),
    })).filter(g => g.rows.length),
  })

  return (
    <>
      <ToolBar label={`已檢查 ${checkedN} / ${rows.length}`}>
        {!isSup && <ExportBtn onClick={() => setReport(true)} />}
      </ToolBar>
      {err && <div className="note" style={{ color: 'var(--red)', textAlign: 'left' }}>讀取確認記錄失敗（可能未建立資料表）：{err}</div>}

      <div className="sf-rows">
        {[0, ...floors].map(f => {
          const fr = f ? rows.filter(r => r.floor === f) : rows
          const segs = ORDER.map(k => ({ k, n: count(fr, k) })).filter(x => x.n > 0)
          return (
            <button key={f} className={`sf-row ${fl === f ? 'on' : ''}`} onClick={() => setFl(fl === f ? 0 : f)}>
              <b>{f ? `${f} 樓` : '全部'}</b>
              <span className="sf-bar">{segs.map(x => <i key={x.k} style={{ flexGrow: x.n, background: ST[x.k].bg, border: x.k === 'none' ? '1px dashed #9aa6b1' : 'none' }} />)}</span>
              <span className="sf-nums">
                {ORDER.map(k => { const n = count(fr, k); return n > 0 ? <em key={k} style={{ background: ST[k].bg, color: ST[k].c, border: k === 'none' ? '1px dashed #9aa6b1' : 'none' }}>{n}</em> : null })}
              </span>
            </button>
          )
        })}
      </div>

      <div className="sf-legend">
        {ORDER.map(k => <span key={k}><i style={{ background: ST[k].bg, borderColor: k === 'none' ? '#9aa6b1' : ST[k].bg, borderStyle: k === 'none' ? 'dashed' : 'solid' }} />{ST[k].t}</span>)}
      </div>

      {floors.filter(f => !fl || f === fl).map(f => {
        const fr = shown.filter(r => r.floor === f)
        return (
          <div key={f}>
            <div className="bh-grp">{f} 樓<span>{fr.length} 間 · 未檢查 {count(fr, 'none')}</span></div>
            <div className="sf-grid">
              {fr.map(r => (
                <button key={r.room} className={`sf-cell k-${r.k}`} style={{ background: ST[r.k].bg, color: ST[r.k].c }} onClick={() => setSel(r.room)}>
                  {r.room}{r.suite && <small>套</small>}{r.k === 'ok' && <u>✓</u>}{r.k === 'fixed' && <u>修</u>}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {cur && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className="sheet">
            <h2>{cur.room} 房{cur.suite ? '（套房）' : ''} · 大床梳化</h2>
            <p><span className="badge" style={{ background: ST[cur.k].bg, color: ST[cur.k].c, border: cur.k === 'none' ? '1px dashed #9aa6b1' : 'none', fontSize: 14, padding: '4px 12px' }}>{ST[cur.k].t}</span></p>
            {cur.ds.map(d => (
              <div className="kv" key={d.id}>
                <span className="k">{d.register_date || (d.created_at || '').slice(0, 10)}</span>
                <span className="v">{(['high', 'medium', 'low'].includes(d.severity) ? ST[d.severity].t : '')} · {d.status === 'done' ? '已修復' : d.status === 'processing' ? '處理中' : '待處理'}{d.note ? `：${d.note}` : ''}</span>
              </div>
            ))}
            {cur.k === 'ok' && <div className="kv"><span className="k">確認人</span><span className="v">{chkOf[cur.room].ok_by || '—'}　{(chkOf[cur.room].ok_at || '').slice(0, 10)}</span></div>}
            {cur.k === 'none' && <p className="src-note">這間房還沒有檢查記錄。檢查後如有問題，請登記缺陷；沒有問題請確認。</p>}
            {canConfirm && (cur.k === 'none') && <button className="btn" onClick={() => confirmOk(cur.room)}>✅ 確認無問題</button>}
            {canConfirm && cur.k === 'ok' && <button className="btn alt" onClick={() => undoOk(cur.room)}>↩ 取消確認</button>}
            {(cur.k === 'none' || cur.k === 'ok') && onList && <button className="btn warn" onClick={() => { setSel(null); onList(cur.room, 'new') }}>⚠ 登記缺陷</button>}
            {cur.ds.length > 0 && onList && <button className="btn alt" onClick={() => { setSel(null); onList(cur.room) }}>查看缺陷記錄</button>}
            <button className="btn ghost" onClick={() => setSel(null)}>關閉</button>
          </div>
        </div>
      )}

      {report && (
        <ReportModal title={rmode === 'sheet' ? '大床梳化檢查表' : '大床梳化檢查總表'} sub={todayStr()} onClose={() => setReport(false)}>
          <div className="chips rpt-noprint">
            <button className={`chip ${rmode === 'sheet' ? 'on' : ''}`} onClick={() => setRmode('sheet')}>檢查表（每層一張 A4，打勾）</button>
            <button className={`chip ${rmode === 'summary' ? 'on' : ''}`} onClick={() => setRmode('summary')}>狀態總表</button>
          </div>
          {rmode === 'summary' ? <ListReport data={reportData()} /> : floors.filter(f => !fl || f === fl).map(f => {
            const fr = shown.filter(r => r.floor === f)
            return (
              <div className="sf-page" key={f}>
                <div className="sf-ph">
                  <b>大床梳化檢查表 · {f} 樓</b>
                  <span>共 {fr.length} 間　已列印日期 {todayStr()}</span>
                </div>
                <div className="sf-sign">檢查人：＿＿＿＿＿＿＿＿　檢查日期：＿＿＿＿＿＿＿＿　主管簽名：＿＿＿＿＿＿＿＿</div>
                <table className="sf-tbl">
                  <thead><tr><th>房號</th><th>現況</th><th>檢查結果（在方格內打 ✓）</th><th>備註</th></tr></thead>
                  <tbody>
                    {fr.map(r => (
                      <tr key={r.room}>
                        <td className="sf-rm">{r.room}{r.suite ? '（套）' : ''}</td>
                        <td className={`sf-cur k-${r.k}`}>{ST[r.k].t}</td>
                        <td className="sf-ck"><span>☐ 無問題</span><span>☐ 輕微</span><span>☐ 中度</span><span>☐ 嚴重</span></td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="sf-note">有問題請到系統「缺陷管理」登記，無問題請在系統「沙發檢查」確認。</div>
              </div>
            )
          })}
        </ReportModal>
      )}
    </>
  )
}
