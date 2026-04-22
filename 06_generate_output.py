# -*- coding: utf-8 -*-
"""
06_generate_output.py
職責：生成最終 JSON 信號，含 v2.2 新欄位
輸出格式：
{
  "date": "線條生成日期（YYYYMMDD）",
  "symbol": "股票代號",
  "period": 5 | 20 | 60,
  "type": "support" | "resistance",
  "price": 支撐/壓力價格,
  "layer": "L1" | "L2" | "L3",
  "market_state": "TREND_UP" | "TREND_DOWN" | "RANGE" | "UNKNOWN",
  "price_zone": "ZONE_1" | "ZONE_2" | "ZONE_3" | "ZONE_4" | "ZONE_UNKNOWN",
  "close_at_generation": 生成當日收盤,
  "vah_at_generation": 生成當日 VAH,
  "poc_at_generation": 生成當日 POC,
  "val_at_generation": 生成當日 VAL,
  "atr_at_generation": 生成當日 ATR,
  "vp_proximity_filtered": true | false,
  "is_valid": true | false,
  "touched_date": "首次觸及日期或 null",
  "days_to_touch": 整數或 null,
  "validation_date": "確認日期或 null",
  "adx_at_generation": ADX 值,
  "di_plus_at_generation": +DI 值,
  "di_minus_at_generation": -DI 值,
  "vp_source": "VAH" | "POC" | "VAL" | null,
  "ma_source": "SMA5" | "SMA20" | "SMA60" | null
}
輸出：OUTPUT/backtest_v2.2_*.json
"""

import json
import os
from pathlib import Path

ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
PERIODS = [5, 20, 60]

def get_vp_source(support_l1, resistance_l1, vah, poc, val):
    """判斷 L1 的 VP 來源"""
    if support_l1 is not None:
        if abs(support_l1 - vah) < 0.01:
            return "VAH"
        elif abs(support_l1 - poc) < 0.01:
            return "POC"
        elif abs(support_l1 - val) < 0.01:
            return "VAL"
    if resistance_l1 is not None:
        if abs(resistance_l1 - vah) < 0.01:
            return "VAH"
        elif abs(resistance_l1 - poc) < 0.01:
            return "POC"
        elif abs(resistance_l1 - val) < 0.01:
            return "VAL"
    return None

def get_ma_source(price, ma5, ma20, ma60):
    """判斷 MA 來源"""
    if price is None:
        return None
    if ma5 is not None and abs(price - ma5) < 0.01:
        return "SMA5"
    elif ma20 is not None and abs(price - ma20) < 0.01:
        return "SMA20"
    elif ma60 is not None and abs(price - ma60) < 0.01:
        return "SMA60"
    return None

def generate_signals():
    """生成最終信號"""
    print("\n=== 開始生成輸出信號 ===\n")

    # 建立輸出目錄
    output_dir = Path("OUTPUT")
    output_dir.mkdir(exist_ok=True)

    # 加載所有中間結果
    with open("cache_raw_data.json", "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    with open("cache_market_state.json", "r", encoding="utf-8") as f:
        market_state = json.load(f)

    with open("cache_price_zone.json", "r", encoding="utf-8") as f:
        price_zone = json.load(f)

    with open("cache_layers_selected.json", "r", encoding="utf-8") as f:
        layers = json.load(f)

    with open("cache_signals_verified.json", "r", encoding="utf-8") as f:
        verified = json.load(f)

    # 生成每檔股票的信號
    for stock in STOCKS:
        print(f"生成 {stock} 的信號：")

        indicators = raw_data[stock]["indicators"]
        signals = []

        for date in sorted(indicators.keys()):
            if date not in layers[stock]:
                continue

            indicator = indicators[date]
            close = indicator.get("close")
            ma5 = indicator.get("ma5")
            ma20 = indicator.get("ma20")
            ma60 = indicator.get("ma60")
            atr = indicator.get("atr") if "atr" in indicator else None

            market_info = market_state[stock].get(date, {})
            market_state_value = market_info.get("state", "UNKNOWN")
            adx = market_info.get("adx")
            plus_di = market_info.get("plus_di")
            minus_di = market_info.get("minus_di")

            for period in PERIODS:
                zone_info = price_zone[stock].get(date, {}).get(f"zone_{period}", {})
                zone = zone_info.get("zone")
                vah = zone_info.get("vah")
                poc = zone_info.get("poc")
                val = zone_info.get("val")

                period_layers = layers[stock][date].get(f"period_{period}", {})
                support_info = period_layers.get("support", {})
                resistance_info = period_layers.get("resistance", {})

                period_verified = verified[stock].get(date, {}).get(f"period_{period}", {})
                support_verified = period_verified.get("support", {})
                resistance_verified = period_verified.get("resistance", {})

                # ========== 支撐信號 ==========
                support_price = support_info.get("price")
                support_layer = support_info.get("layer")
                support_proximity_filtered = support_info.get("proximity_filtered", False)
                support_is_valid = support_verified.get("is_valid", False)
                support_touched = support_verified.get("touched_date")
                support_days = support_verified.get("days_to_touch")
                support_validation = support_verified.get("validation_date")

                if support_price is not None and support_layer is not None:
                    support_signal = {
                        "date": date,
                        "symbol": stock,
                        "period": period,
                        "type": "support",
                        "price": support_price,
                        "layer": support_layer,
                        "market_state": market_state_value,
                        "price_zone": zone,
                        "close_at_generation": close,
                        "vah_at_generation": vah,
                        "poc_at_generation": poc,
                        "val_at_generation": val,
                        "atr_at_generation": atr,
                        "vp_proximity_filtered": support_proximity_filtered,
                        "is_valid": support_is_valid,
                        "touched_date": support_touched,
                        "days_to_touch": support_days,
                        "validation_date": support_validation,
                        "adx_at_generation": adx,
                        "di_plus_at_generation": plus_di,
                        "di_minus_at_generation": minus_di,
                        "vp_source": get_vp_source(support_price, None, vah, poc, val) if support_layer == "L1" else None,
                        "ma_source": get_ma_source(support_price, ma5, ma20, ma60) if support_layer == "L3" else None
                    }
                    signals.append(support_signal)

                # ========== 壓力信號 ==========
                resistance_price = resistance_info.get("price")
                resistance_layer = resistance_info.get("layer")
                resistance_proximity_filtered = resistance_info.get("proximity_filtered", False)
                resistance_is_valid = resistance_verified.get("is_valid", False)
                resistance_touched = resistance_verified.get("touched_date")
                resistance_days = resistance_verified.get("days_to_touch")
                resistance_validation = resistance_verified.get("validation_date")

                if resistance_price is not None and resistance_layer is not None:
                    resistance_signal = {
                        "date": date,
                        "symbol": stock,
                        "period": period,
                        "type": "resistance",
                        "price": resistance_price,
                        "layer": resistance_layer,
                        "market_state": market_state_value,
                        "price_zone": zone,
                        "close_at_generation": close,
                        "vah_at_generation": vah,
                        "poc_at_generation": poc,
                        "val_at_generation": val,
                        "atr_at_generation": atr,
                        "vp_proximity_filtered": resistance_proximity_filtered,
                        "is_valid": resistance_is_valid,
                        "touched_date": resistance_touched,
                        "days_to_touch": resistance_days,
                        "validation_date": resistance_validation,
                        "adx_at_generation": adx,
                        "di_plus_at_generation": plus_di,
                        "di_minus_at_generation": minus_di,
                        "vp_source": get_vp_source(None, resistance_price, vah, poc, val) if resistance_layer == "L1" else None,
                        "ma_source": get_ma_source(resistance_price, ma5, ma20, ma60) if resistance_layer == "L3" else None
                    }
                    signals.append(resistance_signal)

        # 保存該股票的信號
        output_file = output_dir / f"backtest_v2.2_{stock.replace('.', '_')}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(signals, f, ensure_ascii=False, indent=2)

        print(f"  [OK] 生成 {len(signals)} 條信號，已保存: {output_file}")

    print(f"\n[OK] 信號生成完成，已保存至 OUTPUT/ 目錄")

if __name__ == "__main__":
    generate_signals()
    print("\n=== 信號生成結束 ===")
