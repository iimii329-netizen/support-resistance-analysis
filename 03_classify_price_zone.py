# -*- coding: utf-8 -*-
"""
03_classify_price_zone.py
職責：價格區位判定（★v2.2 新增★）
邏輯：根據 Close 與 VAH/POC/VAL 的相對位置分類
  - Zone 1: Close > VAH（突破價值區上緣）
  - Zone 2: VAH ≥ Close > POC（價值區上半）
  - Zone 3: POC ≥ Close > VAL（價值區下半）
  - Zone 4: Close ≤ VAL（跌破價值區下緣）
  - ZONE_UNKNOWN: VP 缺失
輸出：cache_price_zone.json
"""

import json

ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
PERIODS = [5, 20, 60]

def classify_price_zone(close, vah, poc, val):
    """根據 Close 與 VP 位置分類 Zone"""
    # VP 缺失
    if vah is None or poc is None or val is None:
        return "ZONE_UNKNOWN"

    # 檢查資料有效性（VAH > POC > VAL）
    if not (vah > poc > val):
        return "ZONE_UNKNOWN"

    if close > vah:
        return "ZONE_1"
    elif close > poc:
        return "ZONE_2"
    elif close > val:
        return "ZONE_3"
    else:
        return "ZONE_4"

def process_price_zone():
    """處理所有股票和週期的價格區位判定"""
    print("\n=== 開始價格區位判定 ===\n")

    # 加載原始資料
    with open("cache_raw_data.json", "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    price_zone = {}

    for stock in STOCKS:
        print(f"處理 {stock}:")

        indicators = raw_data[stock]["indicators"]
        vp = raw_data[stock]["volume_profile"]

        price_zone[stock] = {}

        zone_counts = {p: {"ZONE_1": 0, "ZONE_2": 0, "ZONE_3": 0, "ZONE_4": 0, "ZONE_UNKNOWN": 0} for p in PERIODS}

        for date, indicator in indicators.items():
            close = indicator.get("close")

            if date not in price_zone[stock]:
                price_zone[stock][date] = {}

            # 針對每個週期判定
            for period in PERIODS:
                vp_key = f"vp_{period}"

                if date in vp and vp_key in vp[date]:
                    vp_info = vp[date][vp_key]
                    vah = vp_info.get("vah")
                    poc = vp_info.get("poc")
                    val = vp_info.get("val")

                    zone = classify_price_zone(close, vah, poc, val)
                else:
                    zone = "ZONE_UNKNOWN"
                    vah = poc = val = None

                price_zone[stock][date][f"zone_{period}"] = {
                    "zone": zone,
                    "close": close,
                    "vah": vah,
                    "poc": poc,
                    "val": val
                }

                zone_counts[period][zone] += 1

        # 統計輸出
        for period in PERIODS:
            counts = zone_counts[period]
            total = sum(counts.values())
            zone_1_pct = (counts["ZONE_1"] / total * 100) if total > 0 else 0
            zone_2_pct = (counts["ZONE_2"] / total * 100) if total > 0 else 0
            zone_3_pct = (counts["ZONE_3"] / total * 100) if total > 0 else 0
            zone_4_pct = (counts["ZONE_4"] / total * 100) if total > 0 else 0
            unknown_pct = (counts["ZONE_UNKNOWN"] / total * 100) if total > 0 else 0

            print(f"  {period}日: Z1={counts['ZONE_1']}({zone_1_pct:.1f}%) Z2={counts['ZONE_2']}({zone_2_pct:.1f}%) Z3={counts['ZONE_3']}({zone_3_pct:.1f}%) Z4={counts['ZONE_4']}({zone_4_pct:.1f}%) UK={counts['ZONE_UNKNOWN']}({unknown_pct:.1f}%)")

    # 保存快取
    with open("cache_price_zone.json", "w", encoding="utf-8") as f:
        json.dump(price_zone, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 價格區位判定完成，已保存: cache_price_zone.json")

if __name__ == "__main__":
    process_price_zone()
    print("\n=== 價格區位判定結束 ===")
