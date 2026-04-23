# Hook 調試日誌 - 預期輸出順序

## 情況 1：首次載入（stockData 還不存在）

```
🔵 [Home] 渲染開始
  ✓ useState #1: stocks
  ✓ useState #2: selectedId
  ✓ useState #3: period
  ✓ useState #4: timeframe
  ✓ useState #5: panelOpen
  ✓ useState #6: showPeriods
  ✓ useState #7: chartType
  ✓ useState #8: showVolumeProfile
  ✓ useState #9: contentData
  ✓ useState #10: srData
  ✓ useEffect #11: 資料加載
    → useEffect 執行：加載資料
  ✓ useMemo #12: stockList
  ✓ (檢查) stocks[selectedId]
  ⚠️  [檢查點 A] stockData 存在？ false
  ❌ [早期返回] stockData 不存在，返回載入畫面
  ⚠️  注意：此時應該跳過 useMemo #13 和 #14
```

**⚠️ 問題：Hook 數量不一致！**
- 第 1 次渲染：12 個 Hook（useState × 10 + useEffect + useMemo）
- 第 2 次渲染：14 個 Hook（useState × 10 + useEffect + useMemo × 3）
- 導致 React 報錯：「Rendered more hooks than during the previous render」

---

## 情況 2：數據載入完成（stockData 存在）✓

```
🔵 [Home] 渲染開始
  ✓ useState #1: stocks
  ✓ useState #2: selectedId
  ✓ useState #3: period
  ✓ useState #4: timeframe
  ✓ useState #5: panelOpen
  ✓ useState #6: showPeriods
  ✓ useState #7: chartType
  ✓ useState #8: showVolumeProfile
  ✓ useState #9: contentData
  ✓ useState #10: srData
  ✓ useEffect #11: 資料加載
  ✓ useMemo #12: stockList
  ✓ (檢查) stocks[selectedId]
  ⚠️  [檢查點 A] stockData 存在？ true
  ✓ [通過檢查點 A] 繼續執行
  ✓ useMemo #13: roundedSupport (依存: periodData, current_price)
    → useMemo #13 計算中...
    → useMemo #13 結果: 198.5
  ✓ useMemo #14: roundedResistance (依存: periodData, current_price)
    → useMemo #14 計算中...
    → useMemo #14 結果: 210.85
  ℹ️  生成 AI 一句話...
    → 條件滿足，生成 AI 摘要
    → AI 摘要: 根據5日低點，在198.5元附近有支撐。根據VAH，在210.85元附近有壓力。
🟢 [Home] 準備返回 JSX
🏁 [Home] 渲染完成
```

---

## 根本原因總結

| 時刻 | stockData 狀態 | Hook 被調用數量 | 問題 |
|------|--------|--------|--------|
| 初始渲染 | ❌ 不存在 | 12 個 | Hook #13、#14 **跳過** |
| 數據到達後 | ✅ 存在 | 14 個 | Hook #13、#14 **開始調用** |

**這導致同一個組件在不同渲染中呼叫不同數量的 Hook！**

---

## 如何驗證修復

1. **打開瀏覽器開發者工具**（F12）
2. **進入 Console 標籤**
3. **刷新頁面**（F5）
4. **查看日誌順序**
   - 如果看到「❌ [早期返回]」後就停止，且沒有出現「✓ useMemo #13」，表示 **問題仍存在**
   - 如果所有 14 個 Hook 都被調用，表示 **修復成功**

---

## 下一步：修復方案

需要確保 **無論 stockData 是否存在，Hook 的調用數量都一致**。
