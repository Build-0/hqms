import { useState } from 'react'

// 密碼欄：右邊有眼睛掣，按住或點一下可以查看自己輸入的內容，檢查有沒有輸入錯誤
export default function PasswordInput({ value, onChange, autoComplete = 'current-password', ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrap">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} {...rest} />
      <button type="button" className="pw-eye" aria-label={show ? '隱藏密碼' : '顯示密碼'} onClick={() => setShow(s => !s)}>
        {show ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 5.2A9.9 9.9 0 0 1 12 5c5 0 8.5 4.2 9.5 7a12 12 0 0 1-2.6 3.9M6.1 6.7A12 12 0 0 0 2.5 12c1 2.8 4.5 7 9.5 7a9.7 9.7 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  )
}
