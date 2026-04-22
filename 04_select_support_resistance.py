# -*- coding: utf-8 -*-
"""
04_select_support_resistance.py
職責：支撐/壓力選層（L1/L2/L3）
★v2.2 新增★：
  1. L1 由區位決定（不由市況決定）
  2. 鄰近失效檢查：|Close - L1| < 0.3 × ATR → L1降至L2
輸出：cache_layers_selected.json
"""

import json
from collections import defaultdict

ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
PERIODS = [5, 20, 60]
PROXIMITY_COEFFICIENT = 0.3

def get_fractal_extremum(dates_sorted, values, lookback, is_high=True):
    """取 lookback 期間內的最高點或最低點"""
    if lookback <= 0 or len(values) == 0:
        return None

    extremum_value = max(values) if is_high else min(values)
    return extremum_value if extremum_value is not None else None

def is_line_too_close(close, line_price, atr):
    """檢查 Close 與 L1 線的距離是否小於 0.3 × ATR（鄰近失效）"""
    if line_price is None or atr is None or atr == 0:
        return False
    return abs(close - line_price) < PROXIMITY_COEFFICIENT * atr

def select_support_l1(zone, vah, poc, val):
    """根據區位決定支撐 L1（不由市況決定）"""
    l1_map = {
        "ZONE_1": vah,           # 突破，VAH 成支撐
        "ZONE_2": poc,           # 價值區上半，POC 成支撐
        "ZONE_3": val,           # 價值區下半，VAL 成支撐
        "ZONE_4": None,          # 跌破，VP 無法作支撐
        "ZONE_UNKNOWN": None     # VP 缺失
    }
    return l1_map.get(zone)

def select_resistance_l1(zone, vah, poc, val):
    """根據區位決定壓力 L1（不由市況決定）"""
    l1_map = {
        "ZONE_1": None,          # 突破，VP 無法作壓力
        "ZONE_2": vah,           # 價值區上半，VAH 成壓力
        "ZONE_3": poc,           # 價值區下半，POC 成壓力
        "ZONE_4": val,           # 跌破，VAL 成壓力
        "ZONE_UNKNOWN": None
    }
    return l1_map.get(zone)

def get_ma_support(close, ma5, ma20, ma60):
    """選擇合適的 MA 作支撐（Close 在 MA 上方）"""
    if close is None:
        return None
    # 選擇 Close 下方最高的 MA
    candidates = []
    if ma5 is not None and close > ma5:
        candidates.append(("SMA5", ma5))
    if ma20 is not None and close > ma20:
        candidates.append(("SMA20", ma20))
    if ma60 is not None and close > ma60:
        candidates.append(("SMA60", ma60))

    if candidates:
        return max(candidates, key=lambda x: x[1])
    return None

def get_ma_resistance(close, ma5, ma20, ma60):
    """選擇合適的 MA 作壓力（Close 在 MA 下方）"""
    if close is None:
        return None
    # 選擇 Close 上方最低的 MA
    candidates = []
    if ma5 is not None and close < ma5:
        candidates.append(("SMA5", ma5))
    if ma20 is not None and close < ma20:
        candidates.append(("SMA20", ma20))
    if ma60 is not None and close < ma60:
        candidates.append(("SMA60", ma60))

    if candidates:
        return min(candidates, key=lambda x: x[1])
    return None

def process_layers():
    """處理所有股票的選層邏輯"""
    print("\n=== 開始支撐/壓力選層 ===\n")

    # 加載中間結果
    with open("cache_raw_data.json", "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    with open("cache_price_zone.json", "r", encoding="utf-8") as f:
        price_zone = json.load(f)

    layers = {}

    for stock in STOCKS:
        print(f"處理 {stock}：")

        indicators = raw_data[stock]["indicators"]
        vp = raw_data[stock]["volume_profile"]
        adx_data = raw_data[stock]["adx"]

        layers[stock] = {}

        # 為了計算 L2（Fractal），需要建立日期排序
        dates_sorted = sorted(indicators.keys())

        # 統計計數
        l1_count = {"support": 0, "resistance": 0}
        l2_count = {"support": 0, "resistance": 0}
        l3_count = {"support": 0, "resistance": 0}
        proximity_filtered_count = 0

        for date in dates_sorted:
            indicator = indicators[date]
            close = indicator.get("close")
            ma5 = indicator.get("ma5")
            ma20 = indicator.get("ma20")
            ma60 = indicator.get("ma60")
            atr = indicator.get("atr") if "atr" in indicator else None

            # 如果沒有 ATR，從 ADX 資料中尋找（作為備用）
            if atr is None and date in adx_data:
                # 簡單估算 ATR（這邊可能需要從其他來源取得）
                atr = None

            if date not in layers[stock]:
                layers[stock][date] = {}

            # 針對每個週期處理支撐和壓力
            for period in PERIODS:
                zone_info = price_zone[stock].get(date, {}).get(f"zone_{period}", {})
                zone = zone_info.get("zone")
                vah = zone_info.get("vah")
                poc = zone_info.get("poc")
                val = zone_info.get("val")

                # ========== 支撐線選層 ==========
                support_l1 = select_support_l1(zone, vah, poc, val)
                proximity_filtered_support = False

                # 檢查 L1 是否因鄰近失效而降層
                if support_l1 is not None and atr is not None:
                    if is_line_too_close(close, support_l1, atr):
                        proximity_filtered_support = True
                        support_price = None  # L1 失效
                        support_layer = None
                    else:
                        support_price = support_l1
                        support_layer = "L1"
                        l1_count["support"] += 1
                elif support_l1 is not None:
                    support_price = support_l1
                    support_layer = "L1"
                    l1_count["support"] += 1
                else:
                    support_price = None
                    support_layer = None

                # L2：Fractal 低點（過去 period 日的最低點）
                if support_price is None and support_layer is None:
                    # 計算 L2
                    idx = dates_sorted.index(date)
                    start_idx = max(0, idx - period + 1)
                    values_in_range = []
                    for i in range(start_idx, idx + 1):
                        d = dates_sorted[i]
                        if d in indicators:
                            v = indicators[d].get("low")
                            if v is not None:
                                values_in_range.append(v)

                    if values_in_range:
                        support_price = min(values_in_range)
                        support_layer = "L2"
                        l2_count["support"] += 1
                    else:
                        support_layer = None

                # L3：MA 兜底（永遠有值）
                if support_price is None and support_layer is None:
                    ma_support = get_ma_support(close, ma5, ma20, ma60)
                    if ma_support:
                        support_price = ma_support[1]
                        support_layer = "L3"
                        l3_count["support"] += 1

                # ========== 壓力線選層 ==========
                resistance_l1 = select_resistance_l1(zone, vah, poc, val)
                proximity_filtered_resistance = False

                # 檢查 L1 是否因鄰近失效而降層
                if resistance_l1 is not None and atr is not None:
                    if is_line_too_close(close, resistance_l1, atr):
                        proximity_filtered_resistance = True
                        resistance_price = None  # L1 失效
                        resistance_layer = None
                    else:
                        resistance_price = resistance_l1
                        resistance_layer = "L1"
                        l1_count["resistance"] += 1
                elif resistance_l1 is not None:
                    resistance_price = resistance_l1
                    resistance_layer = "L1"
                    l1_count["resistance"] += 1
                else:
                    resistance_price = None
                    resistance_layer = None

                # L2：Fractal 高點（過去 period 日的最高點）
                if resistance_price is None and resistance_layer is None:
                    idx = dates_sorted.index(date)
                    start_idx = max(0, idx - period + 1)
                    values_in_range = []
                    for i in range(start_idx, idx + 1):
                        d = dates_sorted[i]
                        if d in indicators:
                            v = indicators[d].get("high")
                            if v is not None:
                                values_in_range.append(v)

                    if values_in_range:
                        resistance_price = max(values_in_range)
                        resistance_layer = "L2"
                        l2_count["resistance"] += 1
                    else:
                        resistance_layer = None

                # L3：MA 兜底
                if resistance_price is None and resistance_layer is None:
                    ma_resistance = get_ma_resistance(close, ma5, ma20, ma60)
                    if ma_resistance:
                        resistance_price = ma_resistance[1]
                        resistance_layer = "L3"
                        l3_count["resistance"] += 1

                # 記錄選層結果
                vp_proximity_filtered = proximity_filtered_support or proximity_filtered_resistance
                if vp_proximity_filtered:
                    proximity_filtered_count += 1

                layers[stock][date][f"period_{period}"] = {
                    "support": {
                        "price": support_price,
                        "layer": support_layer,
                        "proximity_filtered": proximity_filtered_support
                    },
                    "resistance": {
                        "price": resistance_price,
                        "layer": resistance_layer,
                        "proximity_filtered": proximity_filtered_resistance
                    },
                    "vp_proximity_filtered": vp_proximity_filtered
                }

        print(f"  [OK] 支撐L1: {l1_count['support']} | L2: {l2_count['support']} | L3: {l3_count['support']}")
        print(f"  [OK] 壓力L1: {l1_count['resistance']} | L2: {l2_count['resistance']} | L3: {l3_count['resistance']}")
        print(f"  [WARN] 鄰近失效: {proximity_filtered_count}")

    # 保存快取
    with open("cache_layers_selected.json", "w", encoding="utf-8") as f:
        json.dump(layers, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 選層完成，已保存: cache_layers_selected.json")

if __name__ == "__main__":
    process_layers()
    print("\n=== 選層結束 ===")
