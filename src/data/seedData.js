// 預設分類（匯入資料庫後以資料庫為準，可在主題庫頁編輯）
export const DEFAULT_CATEGORIES = [
  { name: '客房清潔', emoji: '🛏️', color: '#1f7a6d' },
  { name: '浴室', emoji: '🚿', color: '#4a6fa5' },
  { name: '服務', emoji: '🛎️', color: '#b07d2e' },
  { name: '安全', emoji: '⛑️', color: '#c0564f' },
  { name: '蟲害', emoji: '🐛', color: '#7d9440' },
  { name: '遺留物', emoji: '🎒', color: '#8f7ac9' },
  { name: '工具', emoji: '🧰', color: '#54808c' },
  { name: '工作間', emoji: '🧺', color: '#5f9e63' },
]
export const CATS = DEFAULT_CATEGORIES.map(c => c.name)

// 客訴性質
export const NATURES = ['投訴', '濫訴', '工程投訴']

// 預設品質主題（內容一律繁體國語；匯入後以資料庫為準）
export const seedTopics = [
  // ── 客房清潔 ──
  { category: '客房清潔', title: '床單四角拉緊標準', why: '床是客人進房第一眼看的地方，床單皺摺會令整間房顯得馬虎。', correct_steps: ['床單四角包緊床墊，中線對齊', '被套四角抖到位，被芯不打結', '枕頭袋開口朝外側統一方向'], mistakes: ['四角只塞不包，客人一坐就鬆', '被芯縮在一角'], supervisor_check: '抽查時掀開床尾角看包法', reminder: '「床鋪得好，房就好了一半。」', question: '鋪床時床單四角的標準是什麼？', answer: '四角包緊床墊、中線對齊，被芯抖到位不打結。' },
  { category: '客房清潔', title: '床底及沙發底檢查', why: '床底遺留物是最尷尬的投訴——客人會覺得房間根本沒有打掃過。', correct_steps: ['C/O房用手電筒照床底、沙發底、床頭櫃背面', '發現雜物立即清走並檢查是否遺留物'], mistakes: ['只吸看得見的地面', '以為上一班查過就跳過'], supervisor_check: 'C/O房抽查必照床底', reminder: '「看不見的地方，才是標準所在。」', question: 'C/O房哪三個位置必須用手電筒照？', answer: '床底、沙發底、床頭櫃背面。' },
  { category: '客房清潔', title: '杯具消毒與擺位', why: '杯具直接入口，衛生問題會直接變成投訴甚至衛生部門事件。', correct_steps: ['杯具收回工作間統一消毒', '消毒後戴手套拿杯身，不碰杯口', '杯墊、杯蓋按標準擺位'], mistakes: ['在房內用毛巾擦杯了事', '徒手碰杯口留下指紋'], supervisor_check: '抽查杯口有無水漬指紋', reminder: '「杯子是客人放到嘴邊的東西。」', question: '房間杯具應該在哪裡清潔？', answer: '收回工作間統一消毒，不可在房內用毛巾擦。' },
  { category: '客房清潔', title: '遙控器與電話消毒', why: '遙控器是全房細菌最多的物件，客人愈來愈關注。', correct_steps: ['每日用消毒濕巾擦遙控器、電話聽筒、電燈開關', '電話聽筒檢查有無異味'], mistakes: ['只擦表面不擦按鍵縫', '電話從不檢查'], supervisor_check: '抽查遙控器按鍵縫', reminder: '「客人手最常碰的，就要最乾淨。」', question: '全房細菌最多的物件是什麼？如何處理？', answer: '遙控器——每日用消毒濕巾連按鍵縫一起擦拭。' },
  { category: '客房清潔', title: '鏡面與窗台指紋', why: '鏡面有印客人一照就看見，觀感分立刻扣光。', correct_steps: ['鏡面用乾布打圈收尾', '窗台、玻璃檯面側光檢查'], mistakes: ['布太濕留水痕', '只正面看不側光看'], supervisor_check: '側光看鏡面及玻璃檯面', reminder: '「側身看一眼，勝過正面看三眼。」', question: '檢查鏡面和玻璃檯面的正確方法是什麼？', answer: '側光檢查，才容易看到指紋和水痕。' },
  // ── 浴室 ──
  { category: '浴室', title: '排水口毛髮檢查', why: '一根毛髮足以令客人懷疑整間房的衛生。', correct_steps: ['沖洗後用紙巾檢查排水口蓋及四周', '撥開排水蓋檢查蓋底', '乾身後最後目視檢查'], mistakes: ['只沖水不檢查', '趕房跳過最後檢查'], supervisor_check: '每層抽查3間看排水口及地漏', reminder: '「客人是用一根頭髮，來評價整間房。」', question: '浴室清潔完成前，最後一步必須檢查哪個位置？', answer: '排水口——撥開蓋子檢查蓋底和四周有無毛髮。' },
  { category: '浴室', title: '馬桶內緣與底座', why: '馬桶是衛生投訴的重災區，內緣與底座最容易遺漏。', correct_steps: ['刷內緣出水孔位置', '擦底座與地面接縫', '蓋板正反兩面都擦'], mistakes: ['只刷看得見的內壁', '底座接縫積垢無人理'], supervisor_check: '抽查用鏡子看馬桶內緣', reminder: '「馬桶乾淨，是衛生的底線。」', question: '刷馬桶最容易遺漏的兩個位置是哪裡？', answer: '內緣出水孔和底座與地面的接縫。' },
  { category: '浴室', title: '浴巾布草污漬檢查', why: '有污漬的毛巾掛回架上，等於告訴客人「我們沒有檢查」。', correct_steps: ['布草上架前逐件打開檢查', '有污漬、破損、異味立即更換', '摺法統一，商標朝同一方向'], mistakes: ['整疊上架不逐件看', '污漬面朝內就當看不見'], supervisor_check: '抽查打開浴巾看兩面', reminder: '「每一條毛巾，都代表酒店。」', question: '布草上架前要做什麼？', answer: '逐件打開檢查兩面，有污漬破損異味立即更換。' },
  { category: '浴室', title: '沐浴用品補充標準', why: '用品缺漏是最容易避免卻最常發生的投訴。', correct_steps: ['按房型清單逐格補齊', '瓶裝低於1/3即換', '標籤統一朝外'], mistakes: ['憑記憶補不核對清單', '瓶裝剩一點點就算了'], supervisor_check: '抽查對照備品清單', reminder: '「客人半夜發現沒有沐浴乳，就是投訴。」', question: '瓶裝用品剩多少就要更換？', answer: '低於三分之一即換，補品必須核對清單。' },
  { category: '浴室', title: '地面乾身與防滑', why: '濕滑地面是安全事故源頭，跌倒是最嚴重的投訴類別。', correct_steps: ['清潔後地面擦乾至無水膜', '浴缸/淋浴間底部檢查防滑貼', '地巾擺放到位'], mistakes: ['等地面自然乾', '防滑貼發黑無人更換'], supervisor_check: '完房後踩測地面乾爽度', reminder: '「乾的地面，是最基本的安全。」', question: '完房時浴室地面的標準是什麼？', answer: '擦乾至無水膜、踩上去乾爽，地巾擺放到位。' },
  // ── 服務 ──
  { category: '服務', title: 'DND房處理流程', why: '錯敲DND房是最直接的私隱投訴，客人會非常反感。', correct_steps: ['上班先核對DND名單', 'DND房下午再確認一次', '過夜DND按程序上報主管'], mistakes: ['見門就敲不看名單', 'DND過夜無人跟進'], supervisor_check: '核對每層DND名單執行', reminder: '「掛DND的門，比VIP房更不能碰。」', question: '上班見到DND房第一步做什麼？', answer: '先核對DND名單，下午再確認，過夜要上報主管。' },
  { category: '服務', title: '敲門與報名標準', why: '敲門方式是客人對服務專業度的第一印象。', correct_steps: ['敲三下、報「Housekeeping」、等5秒，重複三輪', '開門後再出聲確認無人', '客人應門立即後退一步微笑'], mistakes: ['敲一下就開門', '用門卡撞門聲代替敲門'], supervisor_check: '現場觀察敲門程序', reminder: '「門的另一邊永遠當作有人。」', question: '標準敲門程序是什麼？', answer: '敲三下、報Housekeeping、等5秒，重複三輪才開門。' },
  { category: '服務', title: '客人在房時的清潔禮儀', why: '客人在房時的一舉一動都被看在眼裡。', correct_steps: ['先詢問是否方便清潔', '動作放輕、不接聽私人電話', '客人物品原位不動'], mistakes: ['當客人不存在大聲操作', '擅自移動客人物品「整理美觀」'], supervisor_check: '留意住客房清潔的禮儀表現', reminder: '「客人在場，你就是酒店的臉。」', question: '客人在房時清潔要注意什麼？', answer: '先詢問是否方便、動作放輕、客人物品原位不動。' },
  { category: '服務', title: '加床加枕回應時限', why: '客人提出要求後的等待時間，決定服務評分。', correct_steps: ['接到要求10分鐘內送到', '送到時報項目確認', '未能即時送到要回覆預計時間'], mistakes: ['「等一下」之後沒有下文', '送錯項目沒有確認'], supervisor_check: '抽查客人需求回應時間', reminder: '「客人計時，是從開口那一刻開始。」', question: '客人要加枕頭，多久內要送到？', answer: '10分鐘內；來不及要回覆預計時間。' },
  // ── 安全 ──
  { category: '安全', title: '化學品分色使用', why: '用錯化學品會損壞設備，混用有毒氣風險。', correct_steps: ['按顏色標籤對應用途', '稀釋按比例，不自行加濃', '噴頭標籤模糊立即更換'], mistakes: ['潔廁劑拿去擦其他位置', '兩種清潔劑混合使用'], supervisor_check: '抽查工作車化學品擺放及標籤', reminder: '「顏色不對，就不要用。」', question: '兩種清潔劑可以混在一起用嗎？', answer: '絕對不可以——有毒氣風險，按顏色標籤用途使用。' },
  { category: '安全', title: '濕滑告示牌擺放', why: '公共區域跌倒事故，酒店責任極大。', correct_steps: ['拖地前先擺告示牌', '乾透才收牌', '走廊拖一半留通道'], mistakes: ['拖完才擺牌', '牌擺了但位置不顯眼'], supervisor_check: '巡樓看告示牌使用', reminder: '「牌先落地，水才可以落地。」', question: '濕滑告示牌何時擺、何時收？', answer: '拖地前先擺，地面乾透才收。' },
  { category: '安全', title: '工作車不擋走火通道', why: '消防通道受阻是檢查即罰項目，緊急時致命。', correct_steps: ['工作車靠牆停放', '不停在防火門、走火通道口', '人離車不超過三間房距離'], mistakes: ['車停通道中間', '防火門被車頂住長開'], supervisor_check: '巡樓看工作車停放位置', reminder: '「通道是逃生的路，不是停車的位。」', question: '工作車不可以停在哪裡？', answer: '防火門和走火通道口，一律靠牆停。' },
  // ── 遺留物 ──
  { category: '遺留物', title: 'L&F即日登記流程', why: '遲登記會令客人取回無門，直接變成投訴。', correct_steps: ['發現後立即通知主管', '即日登記：日期、房號、物品、發現人', '拍照存檔後上架'], mistakes: ['先收起來，之後才輸入系統', '口頭講過就當登記了'], supervisor_check: '核對昨日C/O房與L&F記錄', reminder: '「客人的東西，一分鐘都不能不明不白。」', question: '發現遺留物要何時登記？', answer: '即日——通知主管、登記、拍照、上架，一步都不能少。' },
  { category: '遺留物', title: '貴重物品上報標準', why: '現金、首飾、證件處理不當會演變成誠信事件。', correct_steps: ['貴重物品即時上報主管見證', '雙人清點、密封、簽名', '存入指定保管位置'], mistakes: ['自行保管等下班才交', '沒有見證人自己封袋'], supervisor_check: '貴重L&F必須有雙簽記錄', reminder: '「貴重物品，永遠兩個人處理。」', question: '撿到現金首飾如何處理？', answer: '即時上報，雙人清點、密封、簽名。' },
  // ── 工具 ──
  { category: '工具', title: '工作車每日整理標準', why: '工作車是流動的形象，凌亂的車等於告訴客人「我們很亂」。', correct_steps: ['上班前按分層標準整理車', '布草袋不超過三分之二滿', '車面只放當日所需'], mistakes: ['亂塞亂放找東西慢', '垃圾袋滿溢才換'], supervisor_check: '早上抽查工作車', reminder: '「車整齊，人俐落。」', question: '布草袋多滿就要處理？', answer: '不超過三分之二滿就要換袋。' },
  { category: '工具', title: '吸塵機濾網清潔', why: '濾網堵塞會令吸力下降又有異味，房間怎麼吸都不乾淨。', correct_steps: ['每週清濾網', '塵袋三分之二滿即換', '收工繞好電線檢查插頭'], mistakes: ['吸力變弱才想起濾網', '電線拖地被踩到破皮'], supervisor_check: '抽查吸塵機濾網狀態', reminder: '「工具狀態，就是工作狀態。」', question: '吸塵機濾網多久清一次？', answer: '每週一次，塵袋三分之二滿即換。' },
  // ── 工作間 ──
  { category: '工作間', title: '布草分類擺放', why: '乾淨與污穢布草混放是衛生大忌，也影響清點。', correct_steps: ['乾淨布草上架分類擺', '污穢布草立即放入指定袋', '地面不放布草'], mistakes: ['乾淨污穢疊在一起', '布草放地上'], supervisor_check: '巡工作間看布草分區', reminder: '「布草落地，就當污穢。」', question: '布草掉到地上怎麼辦？', answer: '一律當污穢處理，不可以上架。' },
  { category: '工作間', title: '工作間每日收工檢查', why: '工作間是後場的臉，凌亂的工作間養成凌亂的習慣。', correct_steps: ['下班前消耗品清點', '化學品歸位上鎖', '地面清潔、垃圾清走'], mistakes: ['用完亂放明天再說', '化學品不上鎖'], supervisor_check: '下班前巡一次工作間', reminder: '「今天整理好，明天開工快十分鐘。」', question: '下班前工作間要做哪三件事？', answer: '消耗品清點、化學品歸位上鎖、地面清潔。' },
]

// 新人教材預設 12 章（匯入資料庫後以資料庫為準，可在 app 內編輯）
export const TRAINING = [
  { emoji: '🧹', title: '房間清潔流程', intro: '入房到報房的標準次序：', steps: ['敲門報名 → 進房開窗通風', '收布草、倒垃圾', '鋪床（四角包緊）', '由高到低、由裡到外擦塵', '浴室清潔（最後檢查排水口）', '補品核對清單', '吸塵由裡向門口退出', '最後360°目視檢查', '報房更新房態'] },
  { emoji: '🧼', title: '衛生標準', intro: '衛生是房務的底線：', steps: ['布草逐件檢查，污漬破損立即更換', '杯具統一回工作間消毒', '抹布分色使用不交叉', '化學品按標籤用途及比例'] },
  { emoji: '🚪', title: 'DND 處理', intro: '掛牌房的處理原則：', steps: ['上班先核對DND名單', 'DND房不敲門不打擾', '下午再確認一次', '過夜DND上報主管跟進'] },
  { emoji: '🌙', title: 'Stayover 程序', intro: '住客房清潔的分寸：', steps: ['客人物品原位不動', '私人文件、財物不觸碰', '床鋪整理、毛巾按使用情況更換', '發現異常（損壞/違禁品）立即報主管'] },
  { emoji: '🧳', title: 'Checkout 程序', intro: 'C/O房是深度檢查房：', steps: ['手電筒照床底、沙發底、抽屜', '保險箱確認已開啟並清空', '迷你吧清點入帳', '遺留物即報即登記', '全面更換布草及消耗品'] },
  { emoji: '🎒', title: 'Lost & Found', intro: '遺留物處理五步：', steps: ['發現 → 立即通知主管', '即日登記（日期/房號/物品/發現人）', '拍照存檔', '按類別上架保存', '貴重物品雙人處理、密封簽名'] },
  { emoji: '🌟', title: 'VIP 房要求', intro: 'VIP房的加碼標準：', steps: ['按VIP等級對照擺設清單', '歡迎品、鮮花、卡片檢查', '主管必須複查後才報房', '留意客史偏好（枕頭/樓層/忌諱）'] },
  { emoji: '🤝', title: '客人服務禮儀', intro: '每一次接觸都是服務：', steps: ['主動微笑、稱呼客人', '走廊靠邊讓路、電梯讓客人先', '聽不懂的要求找主管，不隨便答應', '不議論客人、不透露房號住客資料'] },
  { emoji: '⛑️', title: '安全事項', intro: '保護自己也保護客人：', steps: ['化學品不混用、不徒手接觸', '彎腰搬重物用腿力不用腰力', '發現可疑人物/物品立即通報', '熟悉走火通道及滅火器位置'] },
  { emoji: '🛒', title: '工作車整理', intro: '車的標準：', steps: ['上層：清潔劑及工具', '中層：備品消耗品', '下層：乾淨布草', '側掛：布草袋、垃圾袋（不超過2/3滿）', '車靠牆停、不擋通道'] },
  { emoji: '🧺', title: '工作間整理', intro: '後場標準：', steps: ['乾淨/污穢布草嚴格分區', '化學品上鎖存放', '消耗品每日清點', '下班前清潔地面'] },
  { emoji: '❓', title: '常見問題', intro: '新人最常犯錯的地方：', steps: ['趕房漏最後檢查 → 寧可慢一分鐘', '憑記憶補品 → 必須核對清單', '見DND照敲 → 先看名單', '遺留物先收起來 → 即報即登記', '杯具房內隨便擦 → 統一消毒'] },
]

// 每日清潔加強項目（除日常標準外）——顯示於「循環清潔」模組
export const DAILY_EXTRA = [
  '放置拖鞋位置區域及衣櫃抽屜要擦塵',
  '牙刷架及咖啡杯盒拖出來擦塵',
  '推拉門及九宮格黑邊框要擦塵',
  '書桌腳及全身鏡都要擦塵',
]

// 示範模式的樣本客訴（日期相對今天，保證「昨日客訴→今日重點」邏輯看得到）
export function seedComplaints() {
  const d = n => {
    const t = new Date()
    t.setDate(t.getDate() + n)
    const p = x => String(x).padStart(2, '0')
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
  }
  const row = (offset, room, category, guest_comment, actual_cause, correct_standard, improvement, flags = {}) => ({
    id: crypto.randomUUID(), date: d(offset), room, category, nature: '投訴', guest_comment, actual_cause, correct_standard, improvement,
    shared: false, check_scheduled: false, recurred: false, photos: [], created_at: new Date().toISOString(), ...flags,
  })
  return [
    row(-1, '1208', '浴室', '淋浴排水口有毛髮', '趕房時跳過最後目視檢查', '浴室完成後必須檢查排水口蓋及四周', '列為今日早會重點，主管每層抽查3間', { check_scheduled: true }),
    row(-5, '0915', '浴室', '浴巾有污漬仍掛回架上', '補品時未逐條檢查布草', '布草上架前逐件檢查，有疑慮立即更換', '已於早會分享，工作車補品流程加檢查步驟', { shared: true, check_scheduled: true, recurred: true }),
    row(-9, '1502', '客房清潔', '床底有前住客的襪子', 'C/O房未做床底檢查', 'C/O房必須用手電筒照床底及沙發底', '已於早會分享', { shared: true }),
    row(-13, '0722', '服務', 'DND牌未掛好期間被敲門', '服務員未先核對DND名單', '上班先核對DND名單，DND房下午再確認', '已重溫DND處理流程', { shared: true }),
    row(-16, '1101', '遺留物', '客人退房後充電器三日後才找到', 'L&F未即日登記入系統', '遺留物須即日登記、拍照、上架', 'L&F流程張貼於工作間', { recurred: true }),
  ]
}
