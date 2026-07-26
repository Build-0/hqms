// 通用刪除/危險操作確認彈窗
export default function Confirm({ text, confirmLabel = '刪除', onConfirm, onCancel }) {
  return (
    <div className="modal" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="sheet center">
        <h2 style={{ marginBottom: 6 }}>確定要{confirmLabel}嗎？</h2>
        <p style={{ fontSize: 13.5, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 14 }}>{text}</p>
        <button className="btn" style={{ background: 'var(--red)' }} onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn ghost" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}
