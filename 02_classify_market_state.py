# -*- coding: utf-8 -*-
"""
02_classify_market_state.py
職責：市況判定 - 根據 ADX(14) 和 DI 分類市況
邏輯：
  - ADX > 25 且 +DI > -DI → TREND_UP
  - ADX > 25 且 -DI > +DI → TREND_DOWN
  - ADX ≤ 25 → RANGE
輸出：cache_market_state.json
"""

import json

ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
ADX_THRESHOLD = 25

def classify_market_state(adx, plus_di, minus_di):
    """根據 ADX 和 DI 判定市況"""
    if adx is None or plus_di is None or minus_di is None:
        return "UNKNOWN"

    if adx > ADX_THRESHOLD:
        if plus_di > minus_di:
            return "TREND_UP"
        else:
            return "TREND_DOWN"
    else:
        return "RANGE"

def process_market_state():
    """處理所有股票的市況判定"""
    print("\n=== 開始市況判定 ===\n")

    # 加載原始資料
    with open("cache_raw_data.json", "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    market_state = {}

    for stock in STOCKS:
        print(f"處理 {stock}:")

        adx_data = raw_data[stock]["adx"]
        market_state[stock] = {}

        count_up = 0
        count_down = 0
        count_range = 0
        count_unknown = 0

        for date, adx_info in adx_data.items():
            adx = adx_info.get("adx")
            plus_di = adx_info.get("plus_di")
            minus_di = adx_info.get("minus_di")

            state = classify_market_state(adx, plus_di, minus_di)
            market_state[stock][date] = {
                "state": state,
                "adx": adx,
                "plus_di": plus_di,
                "minus_di": minus_di
            }

            if state == "TREND_UP":
                count_up += 1
            elif state == "TREND_DOWN":
                count_down += 1
            elif state == "RANGE":
                count_range += 1
            else:
                count_unknown += 1

        total = count_up + count_down + count_range + count_unknown
        print(f"  [OK] TREND_UP: {count_up} | TREND_DOWN: {count_down} | RANGE: {count_range} | UNKNOWN: {count_unknown} (總計: {total})")

    # 保存快取
    with open("cache_market_state.json", "w", encoding="utf-8") as f:
        json.dump(market_state, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 市況判定完成，已保存: cache_market_state.json")

if __name__ == "__main__":
    process_market_state()
    print("\n=== 市況判定結束 ===")
