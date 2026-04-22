# -*- coding: utf-8 -*-
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://192.168.100.129/aiinsight2"
SYMBOL = "2887.TW"
DATE_FROM = "20250101"
DATE_TO = "20260420"
OUTPUT_FILE = "indicator_data_2887.json"

def get_trading_days(date_from_str, date_to_str):
    date_from = datetime.strptime(date_from_str, "%Y%m%d")
    date_to = datetime.strptime(date_to_str, "%Y%m%d")
    trading_days = []
    current = date_from
    while current <= date_to:
        if current.weekday() < 5:
            trading_days.append(current.strftime("%Y%m%d"))
        current += timedelta(days=1)
    return trading_days

def fetch_indicator_data(symbol, date):
    url = f"{BASE_URL}/api/v1/indicator/{symbol}"
    params = {"date": date}
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"[錯誤] {date} 查詢失敗: {e}")
        return None

def main():
    print(f"[開始] 抓取 {SYMBOL} 於 {DATE_FROM}-{DATE_TO} 的技術指標資料")
    trading_days = get_trading_days(DATE_FROM, DATE_TO)
    print(f"[資訊] 共 {len(trading_days)} 個交易日\n")
    results = {
        "symbol": SYMBOL,
        "date_range": {"from": DATE_FROM, "to": DATE_TO},
        "total_trading_days": len(trading_days),
        "data": []
    }
    success_count = 0
    for idx, date in enumerate(trading_days, 1):
        print(f"[進度] {idx}/{len(trading_days)} 抓取 {date}...", end=" ", flush=True)
        data = fetch_indicator_data(SYMBOL, date)
        if data:
            results["data"].append({"date": date, "indicators": data})
            print("[OK]")
            success_count += 1
        else:
            print("[FAIL]")
    print("\n" + "=" * 60)
    print("[輸出結果]")
    print("=" * 60)
    print(json.dumps(results, ensure_ascii=False, indent=2))
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[完成] 資料已存檔: {OUTPUT_FILE}")
    print(f"[統計] 總交易日: {len(trading_days)}, 成功取得: {success_count} 筆資料")

if __name__ == "__main__":
    main()
