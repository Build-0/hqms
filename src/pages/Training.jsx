import { useState } from 'react'
import { TRAINING } from '../data/seedData'

export default function Training() {
  const [open, setOpen] = useState(null)
  return (
    <>
      <div className="src-note" style={{ margin: '2px 4px 12px' }}>
        新人基礎培訓教材，固定內容按需更新。在職同事可隨時重溫。
      </div>
      {TRAINING.map((t, i) => (
        <div className="acc" key={i}>
          <div className="acc-h" onClick={() => setOpen(open === i ? null : i)}>
            {i + 1}. {t.title}<span style={{ color: 'var(--sub)' }}>{open === i ? '－' : '＋'}</span>
          </div>
          {open === i && (
            <div className="acc-b">
              {t.intro}
              <ol>{t.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
