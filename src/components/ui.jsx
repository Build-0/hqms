// 全站共用的小元件：各模組的工具列、匯出掣一律由此產生，確保位置、大小、顏色一致
export function ToolBar({ label, children, sticky }) {
  return (
    <div className={`tb ${sticky ? 'stk' : ''}`}>
      <span className="tb-lab">{label}</span>
      <div className="tb-acts">{children}</div>
    </div>
  )
}
export const ToolBtn = ({ onClick, children, primary }) => (
  <button type="button" className={`tb-btn ${primary ? 'pri' : ''}`} onClick={onClick}>{children}</button>
)
export const ExportBtn = ({ onClick }) => <ToolBtn onClick={onClick}>📄 匯出</ToolBtn>

// 小正方形篩選掣：上面數字、下面名稱（後勤等篩選列用）
export const SqChip = ({ on, onClick, label }) => {
  const m = String(label).match(/^(.*?)\s*(\d+)$/)
  return (
    <button className={`chip sq ${on ? 'on' : ''}`} onClick={onClick}>
      {m ? <><b>{m[2]}</b><small>{m[1].trim() || '全部'}</small></> : <small>{label}</small>}
    </button>
  )
}
