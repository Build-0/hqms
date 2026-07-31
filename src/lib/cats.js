// 七大分類的視覺識別：圖示 + 主色 + 淡色，全站統一使用
export const CAT_META = {
  '房間': { e: '🛏️', c: '#1f7a6d', s: '#e2f0ee' },
  '客房清潔': { e: '🛏️', c: '#1f7a6d', s: '#e2f0ee' },
  '床品布草': { e: '🛌', c: '#2e86ab', s: '#e4eef4' },
  '浴室':     { e: '🚿', c: '#4a6fa5', s: '#e8eef6' },
  '服務':     { e: '🛎️', c: '#b07d2e', s: '#f6efe2' },
  '安全':     { e: '⛑️', c: '#c0564f', s: '#f7e8e6' },
  '蟲害':     { e: '🐛', c: '#7d9440', s: '#eef2e2' },
  '遺留物':   { e: '🎒', c: '#8f7ac9', s: '#ece7f6' },
  '工具':     { e: '🧰', c: '#54808c', s: '#e3edf0' },
  '工作間':   { e: '🧺', c: '#5f9e63', s: '#e7f2e8' },
  '設備':     { e: '🔌', c: '#5b6ee1', s: '#e7e9fb' },
}
export const catMeta = c => CAT_META[c] || { e: '📋', c: '#7a8894', s: '#eef1f4' }

// 由資料庫的 categories 列表建立查詢函數（找不到時退回預設）
export const metaOf = (cats, name) => {
  const f = cats?.find(x => x.name === name)
  return f ? { e: f.emoji, c: f.color, s: f.color + '22' } : catMeta(name)
}

// 分類編輯器可選的顏色
export const COLOR_CHOICES = ['#1f7a6d', '#4a6fa5', '#b07d2e', '#c0564f', '#8f7ac9', '#54808c', '#5f9e63', '#a3599b', '#7a8894', '#2e86ab']
