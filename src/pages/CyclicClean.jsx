import { DAILY_EXTRA } from '../data/seedData'

// 循環清潔項目：週期性深度清潔排程表（表格提供後套用）
export default function CyclicClean() {
  return (
    <>
      <div className="card">
        <h2>每日清潔加強項目</h2>
        <p className="src-note">除日常清潔標準外，以下項目每天都要做到：</p>
        {DAILY_EXTRA.map((x, i) => (
          <div className="check-item" key={i}><span className="dot">✓</span>{x}</div>
        ))}
      </div>
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <h2>🔁 循環清潔排程表</h2>
        <p className="src-note" style={{ marginBottom: 0 }}>
          此區將放置週期性深度清潔項目（例如每週翻床墊、每月洗窗簾等，按房號或樓層輪替）。
          排程表格提供後即套用到這裡，並自動顯示「今天輪到哪些房 / 哪些項目」。
        </p>
      </div>
    </>
  )
}
