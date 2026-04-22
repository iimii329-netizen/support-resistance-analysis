import { Bar } from '../types';

/**
 * 從 XQ 測試伺服器獲取歷史日線資料
 * @param sid 股票代碼 (例如: 2330.TW)
 * @param days 獲取天數
 */
export async function fetchXQHistory(sid: string, days: number = 100): Promise<Bar[]> {
  // 透過後端 API Route 代理，避免 CORS 並處理 XML 解析
  try {
    const res = await fetch(`/api/xq/history?sid=${sid}&days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch XQ data');
    const data = await res.json();
    return data.bars as Bar[];
  } catch (err) {
    console.error('XQ Fetch Error:', err);
    return [];
  }
}
