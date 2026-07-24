// 由 src/data/seedData.js 生成 supabase/seed-topics.sql（開發工具，改完種子資料可重跑）
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { seedTopics } from '../src/data/seedData.js'

const q = s => `'${String(s).replace(/'/g, "''")}'`
const j = arr => `${q(JSON.stringify(arr))}::jsonb`

const rows = seedTopics.map((t, i) =>
  `  (${q(t.category)}, ${q(t.title)}, ${q(t.why)}, ${j(t.correct_steps)}, ${j(t.mistakes)}, ${q(t.supervisor_check)}, ${q(t.reminder)}, ${q(t.question)}, ${q(t.answer)}, ${i})`
).join(',\n')

const sql = `-- 25 個預設品質主題（由 scripts/gen-seed-sql.mjs 生成，請勿手改）
-- 在 Supabase SQL Editor 執行；只有 topics 表為空時才會插入，重跑不會重複
insert into topics (category, title, why, correct_steps, mistakes, supervisor_check, reminder, question, answer, sort_order)
select * from (values
${rows}
) as v(category, title, why, correct_steps, mistakes, supervisor_check, reminder, question, answer, sort_order)
where not exists (select 1 from topics);
`

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed-topics.sql')
writeFileSync(out, sql, 'utf8')
console.log(`已生成 ${out}（${seedTopics.length} 個主題）`)
