# -*- coding: utf-8 -*-
import requests
import json
from datetime import datetime, timedelta
import os

# 基礎設定
API_BASE_URL = "http://192.168.100.129/aiinsight2"
SYMBOL = "2330.TW"
DATE_FROM = "20250101"
DATE_TO = "20260420"
PERIODS = [5, 20, 60]
ROWS = 30
TIMEOUT = 10

# 建立台股交易日清單（簡化版：排除假日，實際應接API或讀交易日檔）
def get_trading_days(date_from_str, date_to_str):
    """取得交易日，排除週末與台灣國定假日"""
    start = datetime.strptime(date_from_str, "%Y%m%d")
    end = datetime.strptime(date_to_str, "%Y%m%d")

    # 台灣2025-2026年國定假日（格式：YYYYMMDD）
    holidays = {
        "20250101",  # 元旦
        "20250228",  # 228紀念日
        "20250401",  # 兒童節
        "20250402",  # 補假
        "20250604",  # 端午節
        "20250917",  # 中秋節
        "20250918",  # 補假
        "20251010",  # 雙十節
        "20260209",  # 農曆新年
        "20260210",  # 農曆新年
        "20260211",  # 農曆新年
        "20260212",  # 農曆新年
        "20260213",  # 農曆新年
        "20260228",  # 228紀念日
        "20260401",  # 兒童節
        "20260604",  # 端午節
        "20260917",  # 中秋節
        "20261010",  # 雙十節
    }

    trading_days = []
    current = start
    while current <= end:
        # 排除週末（5=六, 6=日）
        if current.weekday() < 5:
            date_str = current.strftime("%Y%m%d")
            if date_str not in holidays:
                trading_days.append(date_str)
        current += timedelta(days=1)

    return trading_days

def fetch_volume_profile(symbol, date, period, rows=30):
    """調用 API 取得 volume profile 資料"""
    url = f"{API_BASE_URL}/api/v1/volume-profile/{symbol}"
    params = {
        "date": date,
        "period": period,
        "rows": rows
    }

    try:
        response = requests.get(url, params=params, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] 錯誤 - {symbol}, {date}, period={period}: {e}")
        return None

def main():
    print(f"[*] 開始抓取 {SYMBOL} 的 Volume Profile 資料...")
    print(f"[*] 日期範圍：{DATE_FROM} - {DATE_TO}")
    print(f"[*] Period: {PERIODS}")
    print()

    # 取得交易日
    trading_days = get_trading_days(DATE_FROM, DATE_TO)
    print(f"[OK] 交易日數量：{len(trading_days)} 天")
    print()

    # 儲存所有資料
    all_data = {
        "symbol": SYMBOL,
        "date_range": {
            "from": DATE_FROM,
            "to": DATE_TO
        },
        "periods": PERIODS,
        "rows": ROWS,
        "trading_days_count": len(trading_days),
        "data": {}
    }

    # 逐日期、逐period調用API
    total_requests = len(trading_days) * len(PERIODS)
    completed = 0

    for date in trading_days:
        all_data["data"][date] = {}

        for period in PERIODS:
            result = fetch_volume_profile(SYMBOL, date, period, ROWS)
            all_data["data"][date][f"period_{period}"] = result

            completed += 1
            print(f"進度 [{completed}/{total_requests}] {date} - period={period}: ", end="")
            if result:
                print("[OK]")
            else:
                print("[FAIL]")

    # 輸出到檔案
    output_dir = f"DATA/{SYMBOL}"
    os.makedirs(output_dir, exist_ok=True)
    output_file = f"{output_dir}/{SYMBOL}_volume_profile_20250101_20260420.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print()
    print(f"[OK] 資料已儲存至：{output_file}")
    print(f"[INFO] 總筆數：{len(trading_days) * len(PERIODS)}")

if __name__ == "__main__":
    main()
