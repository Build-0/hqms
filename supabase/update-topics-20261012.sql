-- 主題庫整理（Benny 2026-10-12 逐條決定）：刪除 5 題、修改內容、10 題移入「SOP」分類、全部題目清除主管檢查與提問
-- 可重覆執行。

-- 1. 刪除
delete from topics where (category, title) in (
  ('安全','工作車不擋走火通道'),('服務','加床加枕回應時限'),('服務','DND 處理'),
  ('服務','Stayover 程序'),('新人培訓','常見問題'));

-- 2. 內容修改
update topics set correct_steps = '["床單四角包緊床墊，中線對齊","四個角拉平整"]'::jsonb,
  mistakes = '["只鋪不拉平整"]'::jsonb
  where category='房間清潔' and title='床單四角拉緊標準';

update topics set why = '沖涼時，如果因為頭髮去唔到水，客人必定會投訴。',
  correct_steps = '["沖洗後用紙巾檢查排水口蓋及四周","撥開排水蓋檢查蓋底"]'::jsonb,
  mistakes = '["趕房跳過最後檢查"]'::jsonb
  where category='浴室衛生' and title='排水口毛髮檢查';

update topics set mistakes = '["瓶裝剩一點點就算了"]'::jsonb
  where category='浴室衛生' and title='沐浴用品補充標準';

update topics set mistakes = '["等一陣再寫、我肯定會記得"]'::jsonb
  where category='遺留物' and title='L&F即日登記流程';

update topics set mistakes = '["自行保管等下班才交","自行判斷唔值錢"]'::jsonb
  where category='遺留物' and title='貴重物品上報標準';

-- Lost & Found：第 4、5 點對調（先對調，再移入 SOP）
update topics set correct_steps = jsonb_build_array(
    correct_steps->0, correct_steps->1, correct_steps->2, correct_steps->4, correct_steps->3)
  where category='遺留物' and title='Lost & Found' and jsonb_array_length(correct_steps) = 5;

update topics set
  correct_steps = '["上午 11 點到下午 1 點放入請勿打擾牌，並在手機系統按請勿打擾","下午 3 點和收工前再核對一次","VD 房須先詢問確認是否可進入，未得到確認不要敲門"]'::jsonb,
  mistakes = '["不看DND訊號直接敲門","不確認VD DND直接敲門"]'::jsonb
  where category='服務' and title='DND房處理流程';

update topics set
  correct_steps = '["敲三下、報「Housekeeping」、等5秒，重複三輪","開門後再出聲確認無人","客人應門立即後退一步微笑，自報職稱並詢問是否清潔"]'::jsonb,
  mistakes = '["快速敲門","不敲門"]'::jsonb
  where category='服務' and title='敲門與報名標準';

update topics set why = '乾淨與污穢布草混放是衛生大忌。'
  where category='工作間' and title='布草分類擺放';

-- 3. 移入 SOP 分類（不刪資料）
insert into categories (name, emoji, color, sort_order, for_complaints)
select 'SOP', '📘', '#4a6fa5', coalesce((select max(sort_order) from categories), 0) + 1, false
where not exists (select 1 from categories where name = 'SOP');

update topics set category = 'SOP' where (category, title) in (
  ('房間清潔','房間清潔流程'),('房間清潔','衛生標準'),('房間清潔','退房檢查程序'),
  ('遺留物','Lost & Found'),('安全','安全事項'),('服務','VIP 房要求'),
  ('工具','工作車每日整理標準'),('工具','工作車整理'),('工具','吸塵機使用和清潔維護'),
  ('新人培訓','新員工最基本知識的提問'));

-- 4. 全部題目：清除主管檢查與提問
update topics set supervisor_check = '', question = '', answer = '';

select count(*) as 剩餘主題, count(*) filter (where category='SOP') as SOP主題 from topics;
