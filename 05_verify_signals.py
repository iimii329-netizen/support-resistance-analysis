# -*- coding: utf-8 -*-
"""
05_verify_signals.py
職責：兩階段驗證
  第一階段：觸及判定（T → T+N 日）
    - 支撐：low ≤ support + tolerance
    - 壓力：high ≥ resistance - tolerance
  第二階段：確認判定（T+N → T+N+M 日）
    - 支撐：close > MA × (1 + threshold%)
    - 壓力：close < MA × (1 - threshold%)
輸出：cache_signals_verified.json
"""

import json

ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
PERIODS = [5, 20, 60]

# 觸及容差（按週期調整）
TOUCH_TOLERANCE = {
    5: 0.05,    # 5%
    20: 0.10,   # 10%
    60: 0.18    # 18%
}

# MA 確認門檻（按市況調整）
MA_CONFIRMATION_THRESHOLD = {
    "TREND_UP": 0.015,      # 1.5%
    "TREND_DOWN": 0.015,    # 1.5%
    "RANGE": 0.030,         # 3.0%
    "UNKNOWN": 0.015        # 預設 1.5%
}

# 驗證參數
TOUCH_WINDOW = 20       # T+N 日（掃描觸及的窗口，單位：日）
CONFIRM_WINDOW = 5      # M（確認窗口，單位：日）

def verify_signals():
    """驗證所有信號"""
    print("\n=== 開始兩階段驗證 ===\n")

    # 加載中間結果
    with open("cache_raw_data.json", "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    with open("cache_layers_selected.json", "r", encoding="utf-8") as f:
        layers = json.load(f)

    with open("cache_market_state.json", "r", encoding="utf-8") as f:
        market_state = json.load(f)

    verified = {}

    for stock in STOCKS:
        print(f"驗證 {stock}：")

        indicators = raw_data[stock]["indicators"]
        dates_sorted = sorted(indicators.keys())

        verified[stock] = {}

        valid_count = {"support": 0, "resistance": 0}
        invalid_count = {"support": 0, "resistance": 0}

        for idx, date in enumerate(dates_sorted):
            if date not in layers[stock]:
                continue

            indicator = indicators[date]
            close = indicator.get("close")
            market_info = market_state[stock].get(date, {})
            state = market_info.get("state", "UNKNOWN")

            verified[stock][date] = {}

            for period in PERIODS:
                period_layers = layers[stock][date].get(f"period_{period}", {})
                support_info = period_layers.get("support", {})
                resistance_info = period_layers.get("resistance", {})

                support_price = support_info.get("price")
                resistance_price = resistance_info.get("price")

                # ========== 支撐線驗證 ==========
                support_is_valid = False
                support_touched_date = None
                support_days_to_touch = None
                support_validation_date = None

                if support_price is not None:
                    tolerance = support_price * TOUCH_TOLERANCE[period]
                    support_threshold = support_price + tolerance

                    # 第一階段：掃描觸及
                    for i in range(idx, min(idx + TOUCH_WINDOW, len(dates_sorted))):
                        touch_date = dates_sorted[i]
                        if touch_date in indicators:
                            low = indicators[touch_date].get("low")
                            if low is not None and low <= support_threshold:
                                support_touched_date = touch_date
                                support_days_to_touch = i - idx
                                break

                    # 第二階段：掃描確認
                    if support_touched_date is not None:
                        touch_idx = dates_sorted.index(support_touched_date)
                        ma_type = support_info.get("ma_type")
                        ma_price = support_info.get("price") if support_info.get("layer") == "L3" else None

                        # 取得合適的 MA
                        if ma_price is None:
                            ma5 = indicator.get("ma5")
                            ma20 = indicator.get("ma20")
                            ma60 = indicator.get("ma60")
                            # 選 Close 下方最高的 MA
                            if ma5 is not None and close > ma5:
                                ma_price = ma5
                            elif ma20 is not None and close > ma20:
                                ma_price = ma20
                            elif ma60 is not None and close > ma60:
                                ma_price = ma60

                        if ma_price is not None:
                            threshold = MA_CONFIRMATION_THRESHOLD.get(state, 0.015)
                            confirmation_level = ma_price * (1 + threshold)

                            for i in range(touch_idx, min(touch_idx + CONFIRM_WINDOW, len(dates_sorted))):
                                confirm_date = dates_sorted[i]
                                if confirm_date in indicators:
                                    confirm_close = indicators[confirm_date].get("close")
                                    if confirm_close is not None and confirm_close > confirmation_level:
                                        support_is_valid = True
                                        support_validation_date = confirm_date
                                        break

                if support_is_valid:
                    valid_count["support"] += 1
                else:
                    invalid_count["support"] += 1

                # ========== 壓力線驗證 ==========
                resistance_is_valid = False
                resistance_touched_date = None
                resistance_days_to_touch = None
                resistance_validation_date = None

                if resistance_price is not None:
                    tolerance = resistance_price * TOUCH_TOLERANCE[period]
                    resistance_threshold = resistance_price - tolerance

                    # 第一階段：掃描觸及
                    for i in range(idx, min(idx + TOUCH_WINDOW, len(dates_sorted))):
                        touch_date = dates_sorted[i]
                        if touch_date in indicators:
                            high = indicators[touch_date].get("high")
                            if high is not None and high >= resistance_threshold:
                                resistance_touched_date = touch_date
                                resistance_days_to_touch = i - idx
                                break

                    # 第二階段：掃描確認
                    if resistance_touched_date is not None:
                        touch_idx = dates_sorted.index(resistance_touched_date)
                        ma_price = resistance_info.get("price") if resistance_info.get("layer") == "L3" else None

                        # 取得合適的 MA
                        if ma_price is None:
                            ma5 = indicator.get("ma5")
                            ma20 = indicator.get("ma20")
                            ma60 = indicator.get("ma60")
                            # 選 Close 上方最低的 MA
                            if ma5 is not None and close < ma5:
                                ma_price = ma5
                            elif ma20 is not None and close < ma20:
                                ma_price = ma20
                            elif ma60 is not None and close < ma60:
                                ma_price = ma60

                        if ma_price is not None:
                            threshold = MA_CONFIRMATION_THRESHOLD.get(state, 0.015)
                            confirmation_level = ma_price * (1 - threshold)

                            for i in range(touch_idx, min(touch_idx + CONFIRM_WINDOW, len(dates_sorted))):
                                confirm_date = dates_sorted[i]
                                if confirm_date in indicators:
                                    confirm_close = indicators[confirm_date].get("close")
                                    if confirm_close is not None and confirm_close < confirmation_level:
                                        resistance_is_valid = True
                                        resistance_validation_date = confirm_date
                                        break

                if resistance_is_valid:
                    valid_count["resistance"] += 1
                else:
                    invalid_count["resistance"] += 1

                # 記錄驗證結果
                verified[stock][date][f"period_{period}"] = {
                    "support": {
                        "is_valid": support_is_valid,
                        "touched_date": support_touched_date,
                        "days_to_touch": support_days_to_touch,
                        "validation_date": support_validation_date
                    },
                    "resistance": {
                        "is_valid": resistance_is_valid,
                        "touched_date": resistance_touched_date,
                        "days_to_touch": resistance_days_to_touch,
                        "validation_date": resistance_validation_date
                    }
                }

        print(f"  [OK] 支撐有效: {valid_count['support']} | 無效: {invalid_count['support']}")
        print(f"  [OK] 壓力有效: {valid_count['resistance']} | 無效: {invalid_count['resistance']}")

    # 保存快取
    with open("cache_signals_verified.json", "w", encoding="utf-8") as f:
        json.dump(verified, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 驗證完成，已保存: cache_signals_verified.json")

if __name__ == "__main__":
    verify_signals()
    print("\n=== 驗證結束 ===")
