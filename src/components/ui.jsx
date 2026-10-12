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

// 篩選掣：維持膠囊型（清單項目才用方形卡片）
export const SqChip = ({ on, onClick, label }) => <button className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{label}</button>
