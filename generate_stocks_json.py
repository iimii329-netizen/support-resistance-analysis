# -*- coding: utf-8 -*-
import json
import os
from pathlib import Path
from datetime import datetime

# 支持壓力數據（從5stock.md手動提取）
SUPPORT_RESISTANCE_DATA = {
    "2330.TW": {
        "short": {"support": 1975.00, "resistance": 2031.25},
        "medium": {"support": 1980.99, "resistance": 2100.00},
        "long": {"support": 1939.00, "resistance": 2100.00},
    },
    "2317.TW": {
        "short": {"support": 198.50, "resistance": 206.08},
        "medium": {"support": 195.90, "resistance": 207.10},
        "long": {"support": 201.80, "resistance": 215.00},
    },
    "2382.TW": {
        "short": {"support": 317.13, "resistance": 324.63},
        "medium": {"support": 314.20, "resistance": 329.50},
        "long": {"support": 297.99, "resistance": 329.50},
    },
    "2454.TW": {
        "short": {"support": 1837.75, "resistance": 1949.41},
        "medium": {"support": 1718.75, "resistance": 1955.00},
        "long": {"support": 1782.50, "resistance": 1947.50},
    },
    "2887.TW": {
        "short": {"support": 24.16, "resistance": 24.32},
        "medium": {"support": 23.10, "resistance": 25.10},
        "long": {"support": 23.14, "resistance": 24.53},
    },
}

def create_period_analysis(json_data, sr_data, period_name, period_key):
    """為指定期間創建 PeriodAnalysis 數據"""
    vp_data = json_data.get("volume_profile", {}).get(period_key, {})

    support_price = sr_data["support"]
    resistance_price = sr_data["resistance"]

    # 計算距離百分比（以最後一根K棒的收盤價為基準）
    ohlcv = json_data.get("ohlcv", [])
    if ohlcv:
        current_price = ohlcv[-1]["close"]
    else:
        current_price = 100

    support_distance = ((support_price - current_price) / current_price) * 100
    resistance_distance = ((resistance_price - current_price) / current_price) * 100

    # 創建支撐和壓力 Band
    support = {
        "price": support_price,
        "display": f"{int(support_price)}" if support_price > 100 else f"{support_price:.2f}",
        "distance_pct": support_distance,
        "strength": 1,
        "members": ["price_action"],
        "summary": f"支撐位於 {support_price}",
        "range_low": support_price - 0.5,
        "range_high": support_price + 0.5,
    }

    resistance = {
        "price": resistance_price,
        "display": f"{int(resistance_price)}" if resistance_price > 100 else f"{resistance_price:.2f}",
        "distance_pct": resistance_distance,
        "strength": 1,
        "members": ["price_action"],
        "summary": f"壓力位於 {resistance_price}",
        "range_low": resistance_price - 0.5,
        "range_high": resistance_price + 0.5,
    }

    # 創建 VP 數據
    vp = {
        "poc": vp_data.get("poc"),
        "vah": vp_data.get("vah"),
        "val": vp_data.get("val"),
        "tick": 0.01 if json_data["symbol"] == "2887.TW" else 1,
        "bins": [
            {
                "price": (bucket["price_low"] + bucket["price_high"]) / 2,
                "volume": bucket["volume"],
                "width": 1.0,  # 標準化
            }
            for bucket in vp_data.get("buckets", [])
        ],
        "valid": bool(vp_data),
    }

    return {
        "support": support,
        "resistance": resistance,
        "vp": vp,
        "all_support": [support],
        "all_resistance": [resistance],
    }

def process_json_file(json_path, sr_data):
    """處理單個 JSON 文件，返回 StockData"""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    symbol = data["symbol"]
    name = data["name"]

    # 獲取最後的收盤價和漲跌幅
    ohlcv = data.get("ohlcv", [])
    if ohlcv:
        current_price = ohlcv[-1]["close"]
        # 簡單計算漲跌幅（與第一根K棒比較）
        change_pct = ((current_price - ohlcv[0]["open"]) / ohlcv[0]["open"]) * 100
    else:
        current_price = 0
        change_pct = 0

    # 準備 Bar 數據（只支持 1d）
    bars_1d = []
    for ohlc in ohlcv:
        date_str = ohlc["date"]
        # 轉換日期格式: YYYYMMDD -> YYYY/MM/DD
        formatted_date = f"{date_str[:4]}/{date_str[4:6]}/{date_str[6:8]}"

        bar = {
            "time": formatted_date,
            "open": ohlc["open"],
            "high": ohlc["high"],
            "low": ohlc["low"],
            "close": ohlc["close"],
            "volume": ohlc["volume"],
            "ma20": data.get("moving_averages", {}).get("ma20"),
        }
        bars_1d.append(bar)

    # 創建 periods 數據
    periods = {
        "short": create_period_analysis(data, sr_data["short"], "short", "period_5"),
        "medium": create_period_analysis(data, sr_data["medium"], "medium", "period_20"),
        "long": create_period_analysis(data, sr_data["long"], "long", "period_60"),
    }

    # 構建 StockData
    stock_data = {
        "stock_id": symbol,
        "name": name,
        "current_price": current_price,
        "change_pct": change_pct,
        "klines": {
            "5m": [],
            "15m": [],
            "60m": [],
            "1d": bars_1d,
            "1w": [],
        },
        "periods": periods,
    }

    return symbol, stock_data

def main():
    # 定義路徑
    content_dir = Path("content")
    web_data_dir = Path("Web/chart-demo/public/data")

    # 確保輸出目錄存在
    web_data_dir.mkdir(parents=True, exist_ok=True)

    stocks_json = {}

    # 處理每個股票文件
    stock_files = [
        "2317.TW_20260417.json",
        "2330.TW_20260417.json",
        "2382.TW_20260417.json",
        "2454.TW_20260417.json",
        "2887.TW_20260417.json",
    ]

    for filename in stock_files:
        json_path = content_dir / filename

        if not json_path.exists():
            print(f"[WARN] 找不到文件: {json_path}")
            continue

        # 提取股票代號（從文件名）
        symbol = filename.split("_")[0]

        if symbol not in SUPPORT_RESISTANCE_DATA:
            print(f"[WARN] 找不到支撐壓力數據: {symbol}")
            continue

        try:
            stock_id, stock_data = process_json_file(
                json_path, SUPPORT_RESISTANCE_DATA[symbol]
            )
            stocks_json[stock_id] = stock_data
            print(f"[OK] 已處理: {symbol}")
        except Exception as e:
            print(f"[ERROR] 錯誤處理 {symbol}: {e}")

    # 輸出 stocks.json
    output_path = web_data_dir / "stocks.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(stocks_json, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 已生成: {output_path}")
    print(f"  包含 {len(stocks_json)} 檔股票")

if __name__ == "__main__":
    main()
