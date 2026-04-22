# -*- coding: utf-8 -*-
"""
calc_adx_multi.py — 批量計算多檔股票的 ADX
"""

import json
import math
import os

ADX_PERIOD = 14

def calc_adx(records, period=14):
    """手動實作 Wilder's ADX(period)"""
    n = len(records)
    result = []

    highs  = [float(r["high"])  for r in records]
    lows   = [float(r["low"])   for r in records]
    closes = [float(r["close"]) for r in records]
    dates  = [r["date"]         for r in records]

    tr_list      = [None] * n
    plus_dm_list = [None] * n
    minus_dm_list= [None] * n

    for i in range(1, n):
        h, l, pc = highs[i], lows[i], closes[i - 1]
        tr = max(h - l, abs(h - pc), abs(l - pc))
        up_move   = h - highs[i - 1]
        down_move = lows[i - 1] - l
        plus_dm  = up_move   if (up_move > down_move and up_move > 0)   else 0.0
        minus_dm = down_move if (down_move > up_move and down_move > 0) else 0.0

        tr_list[i]       = tr
        plus_dm_list[i]  = plus_dm
        minus_dm_list[i] = minus_dm

    start = period
    if n <= start:
        for i in range(n):
            result.append({"date": dates[i], "adx": None, "plus_di": None, "minus_di": None})
        return result

    atr_w      = sum(tr_list[1 : period + 1])
    plus_dm_w  = sum(plus_dm_list[1 : period + 1])
    minus_dm_w = sum(minus_dm_list[1 : period + 1])

    def safe_di(dm_w, atr_w):
        return 100.0 * dm_w / atr_w if atr_w != 0 else 0.0

    plus_di_series  = [None] * n
    minus_di_series = [None] * n
    dx_series       = [None] * n

    plus_di_series[period]  = safe_di(plus_dm_w, atr_w)
    minus_di_series[period] = safe_di(minus_dm_w, atr_w)

    di_sum  = plus_di_series[period] + minus_di_series[period]
    di_diff = abs(plus_di_series[period] - minus_di_series[period])
    dx_series[period] = 100.0 * di_diff / di_sum if di_sum != 0 else 0.0

    for i in range(period + 1, n):
        atr_w      = atr_w      - (atr_w / period)      + tr_list[i]
        plus_dm_w  = plus_dm_w  - (plus_dm_w / period)  + plus_dm_list[i]
        minus_dm_w = minus_dm_w - (minus_dm_w / period) + minus_dm_list[i]

        plus_di_series[i]  = safe_di(plus_dm_w, atr_w)
        minus_di_series[i] = safe_di(minus_dm_w, atr_w)

        di_sum  = plus_di_series[i] + minus_di_series[i]
        di_diff = abs(plus_di_series[i] - minus_di_series[i])
        dx_series[i] = 100.0 * di_diff / di_sum if di_sum != 0 else 0.0

    adx_start = 2 * period - 1
    adx_series = [None] * n

    if n <= adx_start:
        for i in range(n):
            result.append({"date": dates[i], "adx": None,
                           "plus_di": plus_di_series[i], "minus_di": minus_di_series[i]})
        return result

    adx_val = sum(dx_series[period : adx_start + 1]) / period
    adx_series[adx_start] = adx_val

    for i in range(adx_start + 1, n):
        adx_val = (adx_val * (period - 1) + dx_series[i]) / period
        adx_series[i] = adx_val

    for i in range(n):
        adx_raw     = adx_series[i]
        plus_raw    = plus_di_series[i]
        minus_raw   = minus_di_series[i]

        result.append({
            "date":      dates[i],
            "adx":       round(adx_raw,  4) if adx_raw  is not None else None,
            "plus_di":   round(plus_raw, 4) if plus_raw is not None else None,
            "minus_di":  round(minus_raw,4) if minus_raw is not None else None,
        })

    return result


def process_symbol(symbol, ohlcv_file):
    """處理單檔股票"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, symbol, ohlcv_file)

    if not os.path.exists(input_path):
        print(f"  [ERROR] {symbol}: 找不到 {ohlcv_file}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    records = raw["data"]
    print(f"  [INFO] {symbol}: {len(records)} 筆 K 線資料")

    adx_data = calc_adx(records, period=ADX_PERIOD)
    valid_count = sum(1 for r in adx_data if r["adx"] is not None)
    none_count  = len(adx_data) - valid_count

    output_path = os.path.join(script_dir, symbol, f"{symbol.replace('.', '_')}-adx.json")
    output = {
        "symbol":      symbol,
        "adx_period":  ADX_PERIOD,
        "total":       len(adx_data),
        "note":        f"前 {none_count} 筆為暖機期，adx/plus_di/minus_di 為 null",
        "data":        adx_data
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  [OK] 輸出：{output_path}")


if __name__ == "__main__":
    print("[批量計算 ADX]\n")

    # 原始 4 檔
    process_symbol("2382.TW", "2382.TW-OHLCV-20250101-20260420.txt")
    process_symbol("2454.TW", "2454.TW-OHLCV-20250101-20260420.txt")

    # 擴展 5 檔
    process_symbol("2412.TW", "2412.TW-OHLCV-20250101-20260420.txt")
    process_symbol("1402.TW", "1402.TW-OHLCV-20250101-20260420.txt")
    process_symbol("2408.TW", "2408.TW-OHLCV-20250101-20260420.txt")
    process_symbol("2887.TW", "2887.TW-OHLCV-20250101-20260420.txt")
    process_symbol("1301.TW", "1301.TW-OHLCV-20250101-20260420.txt")

    print("\n[完成]")
