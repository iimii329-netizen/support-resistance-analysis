# -*- coding: utf-8 -*-
import requests
import json
from datetime import datetime, timedelta

# 基礎設定
BASE_URL = "http://192.168.100.129/aiinsight2"
SYMBOL = "2330.TW"
PERIODS = [
    ("20250101", "20250916"),
    ("20260318", "20260417")
]
OUTPUT_FILE = "indicator_data_v2.json"

# 台股交易日篩選（排除週末）
def get_trading_days(date_from_str, date_to_str):
    """取得台股交易日（排除週末）"""
    date_from = datetime.strptime(date_from_str, "%Y%m%d")
    date_to = datetime.strptime(date_to_str, "%Y%m%d")

    trading_days = []
    current = date_from

    while current <= date_to:
        # 0=Monday, 6=Sunday
        if current.weekday() < 5:  # 週一至週五
            trading_days.append(current.strftime("%Y%m%d"))
        current += timedelta(days=1)

    return trading_days

# 抓取指標資料
def fetch_indicator_data(symbol, date):
    """向 API 抓取指定日期的指標資料"""
    url = f"{BASE_URL}/api/v1/indicator/{symbol}"
    params = {"date": date}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"[錯誤] {date} 查詢失敗: {e}")
        return None

# 主程式
def main():
    print(f"[開始] 抓取 {SYMBOL} 在多個時段的技術指標資料\n")

    all_data = []
    total_trading_days = 0
    total_success = 0

    # 處理每個時間段
    for idx, (date_from, date_to) in enumerate(PERIODS, 1):
        print(f"[時段 {idx}] {date_from} - {date_to}")

        # 獲取交易日列表
        trading_days = get_trading_days(date_from, date_to)
        print(f"  共 {len(trading_days)} 個交易日")

        period_data = []

        # 抓取資料
        for day_idx, date in enumerate(trading_days, 1):
            print(f"  [進度] {day_idx}/{len(trading_days)} 抓取 {date}...", end=" ", flush=True)

            data = fetch_indicator_data(SYMBOL, date)
            if data:
                period_data.append({
                    "date": date,
                    "indicators": data
                })
                print("[OK]")
                total_success += 1
            else:
                print("[FAIL]")

        all_data.append({
            "period": f"{date_from}-{date_to}",
            "trading_days": len(trading_days),
            "data": period_data
        })

        total_trading_days += len(trading_days)
        print()

    # 組合最終結果
    results = {
        "symbol": SYMBOL,
        "periods": [period["period"] for period in all_data],
        "total_trading_days": total_trading_days,
        "total_success": total_success,
        "periods_data": all_data
    }

    # 打印輸出
    print("=" * 60)
    print("[輸出結果]")
    print("=" * 60)
    print(json.dumps(results, ensure_ascii=False, indent=2))

    # 存檔
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n[完成] 資料已存檔: {OUTPUT_FILE}")
    print(f"[統計] 總交易日: {total_trading_days}, 成功取得: {total_success} 筆資料")

if __name__ == "__main__":
    main()
