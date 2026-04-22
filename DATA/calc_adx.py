"""
calc_adx.py
-----------
從 OHLCV JSON 計算 ADX(14)，輸出新的 JSON 檔案。

使用方式（CMD）：
    python calc_adx.py

輸入檔案（需與本腳本放在同一目錄）：
    2330_tw-OHLCV-20250101-20260417.txt

輸出檔案（自動產生在同一目錄）：
    2330_TW-adx.json

依賴套件：
    pip install pandas
    （不需要 pandas-ta，ADX 為手動實作，無額外依賴）
"""

import json
import math
import os

# ── 設定 ────────────────────────────────────────────────
INPUT_FILE  = "2330.tw-OHLCV-20250101-20260417.txt"
OUTPUT_FILE = "2330_TW-adx.json"
ADX_PERIOD  = 14   # 標準參數，可修改
# ────────────────────────────────────────────────────────


def calc_adx(records, period=14):
    """
    手動實作 Wilder's ADX(period)。
    輸入：list of dict，每筆含 date / high / low / close（字串或數字皆可）
    輸出：list of dict，{ date, adx, plus_di, minus_di }
          前 (2*period - 1) 筆因暖機不足，adx/plus_di/minus_di 為 None
    """

    n = len(records)
    result = []

    # 轉成 float
    highs  = [float(r["high"])  for r in records]
    lows   = [float(r["low"])   for r in records]
    closes = [float(r["close"]) for r in records]
    dates  = [r["date"]         for r in records]

    # 第一輪：計算逐根的 TR / +DM / -DM
    tr_list      = [None] * n
    plus_dm_list = [None] * n
    minus_dm_list= [None] * n

    for i in range(1, n):
        h, l, pc = highs[i], lows[i], closes[i - 1]

        # True Range
        tr = max(h - l, abs(h - pc), abs(l - pc))

        # Directional Movement
        up_move   = h - highs[i - 1]
        down_move = lows[i - 1] - l

        plus_dm  = up_move   if (up_move > down_move and up_move > 0)   else 0.0
        minus_dm = down_move if (down_move > up_move and down_move > 0) else 0.0

        tr_list[i]       = tr
        plus_dm_list[i]  = plus_dm
        minus_dm_list[i] = minus_dm

    # 第二輪：Wilder 平滑（初始值用前 period 根的簡單加總）
    # 最早可用的起始 index
    start = period  # index period（從 1 開始算，取 1..period 共 period 根）

    if n <= start:
        # 資料太少
        for i in range(n):
            result.append({"date": dates[i], "adx": None, "plus_di": None, "minus_di": None})
        return result

    # 初始 Wilder 加總
    atr_w      = sum(tr_list[1 : period + 1])
    plus_dm_w  = sum(plus_dm_list[1 : period + 1])
    minus_dm_w = sum(minus_dm_list[1 : period + 1])

    def safe_di(dm_w, atr_w):
        return 100.0 * dm_w / atr_w if atr_w != 0 else 0.0

    # 計算第一個 +DI / -DI（index = period）
    plus_di_series  = [None] * n
    minus_di_series = [None] * n
    dx_series       = [None] * n

    plus_di_series[period]  = safe_di(plus_dm_w, atr_w)
    minus_di_series[period] = safe_di(minus_dm_w, atr_w)

    # DX
    di_sum  = plus_di_series[period] + minus_di_series[period]
    di_diff = abs(plus_di_series[period] - minus_di_series[period])
    dx_series[period] = 100.0 * di_diff / di_sum if di_sum != 0 else 0.0

    # 繼續 Wilder 滾動
    for i in range(period + 1, n):
        atr_w      = atr_w      - (atr_w / period)      + tr_list[i]
        plus_dm_w  = plus_dm_w  - (plus_dm_w / period)  + plus_dm_list[i]
        minus_dm_w = minus_dm_w - (minus_dm_w / period) + minus_dm_list[i]

        plus_di_series[i]  = safe_di(plus_dm_w, atr_w)
        minus_di_series[i] = safe_di(minus_dm_w, atr_w)

        di_sum  = plus_di_series[i] + minus_di_series[i]
        di_diff = abs(plus_di_series[i] - minus_di_series[i])
        dx_series[i] = 100.0 * di_diff / di_sum if di_sum != 0 else 0.0

    # 第三輪：ADX = Wilder 平滑的 DX
    # 初始 ADX = 前 period 個有效 DX 的平均
    # 有效 DX 從 index=period 開始，取 period 個 → index period ~ 2*period-1
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

    # 組合輸出
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


def main():
    # ── 讀取 OHLCV ──
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, INPUT_FILE)

    if not os.path.exists(input_path):
        print(f"[ERROR] 找不到輸入檔案：{input_path}")
        print("        請確認 OHLCV 檔案與本腳本放在同一目錄。")
        return

    print(f"讀取：{input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    records = raw["data"]
    print(f"載入 {len(records)} 筆 K 線資料（{records[0]['date']} → {records[-1]['date']}）")

    # ── 計算 ADX ──
    print(f"計算 ADX({ADX_PERIOD})...")
    adx_data = calc_adx(records, period=ADX_PERIOD)

    # 統計有效筆數
    valid_count = sum(1 for r in adx_data if r["adx"] is not None)
    none_count  = len(adx_data) - valid_count
    print(f"  有效筆數：{valid_count}  |  暖機期（None）：{none_count} 筆")

    # ── 印出最後 5 筆確認 ──
    print()
    print("最後 5 筆結果：")
    print(f"  {'date':<12} {'ADX':>8} {'+ DI':>8} {'- DI':>8}")
    print(f"  {'-'*12} {'-'*8} {'-'*8} {'-'*8}")
    for r in adx_data[-5:]:
        adx_str    = f"{r['adx']:8.2f}"    if r['adx']      is not None else "    None"
        pdi_str    = f"{r['plus_di']:8.2f}" if r['plus_di']  is not None else "    None"
        mdi_str    = f"{r['minus_di']:8.2f}"if r['minus_di'] is not None else "    None"
        print(f"  {r['date']:<12} {adx_str} {pdi_str} {mdi_str}")

    # ── 寫出 JSON ──
    output_path = os.path.join(script_dir, OUTPUT_FILE)
    output = {
        "symbol":      raw.get("stockID", "2330.TW"),
        "adx_period":  ADX_PERIOD,
        "total":       len(adx_data),
        "note":        f"前 {none_count} 筆為暖機期，adx/plus_di/minus_di 為 null",
        "data":        adx_data
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print()
    print(f"輸出完成：{output_path}")


if __name__ == "__main__":
    main()