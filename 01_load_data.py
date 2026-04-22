# -*- coding: utf-8 -*-
"""
01_load_data.py
職責：加載 9 檔股票的原始資料（OHLCV、VP、指標、ADX），統一轉成快取格式
輸出：cache_raw_data.json
"""

import json
import os
from pathlib import Path
from glob import glob

# 9檔股票清單
ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
DATA_DIR = "DATA"

def find_file(stock_dir, patterns):
    """尋找符合任一模式的檔案"""
    for pattern in patterns:
        full_pattern = os.path.join(stock_dir, pattern)
        matches = glob(full_pattern)
        if matches:
            return matches[0]
    return None

def load_indicator_data(stock):
    """加載技術指標資料（OHLCV、MA等）"""
    stock_dir = Path(DATA_DIR) / stock

    # 嘗試多個可能的路徑
    patterns = [
        f"indicator_data_{stock.split('.')[0]}.json",
        f"indicator_data_*.json",
        f"{stock}-indicator_data*.json"
    ]

    filepath = find_file(str(stock_dir), patterns)

    if not filepath:
        print(f"  [WARN] 找不到 indicator_data: {stock}")
        return {}

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = {}
    for entry in data.get("data", []):
        date = entry.get("date")
        indicator = entry.get("indicators", {}).get("indicator", {})
        if date and indicator:
            result[date] = indicator

    print(f"  [OK] {stock} 技術指標: {len(result)} 筆")
    return result

def load_adx_data(stock):
    """加載 ADX/DI 資料"""
    stock_dir = Path(DATA_DIR) / stock

    patterns = [
        f"{stock.replace('.', '_')}-adx.json",
        f"*-adx.json",
        f"*_adx.json"
    ]

    filepath = find_file(str(stock_dir), patterns)

    if not filepath:
        print(f"  [WARN] 找不到 ADX 資料: {stock}")
        return {}

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = {}
    for entry in data.get("data", []):
        date = entry.get("date")
        if date:
            result[date] = {
                "adx": entry.get("adx"),
                "plus_di": entry.get("plus_di"),
                "minus_di": entry.get("minus_di")
            }

    print(f"  [OK] {stock} ADX 資料: {len(result)} 筆")
    return result

def load_volume_profile(stock):
    """加載 Volume Profile 資料（VAH/POC/VAL）"""
    stock_dir = Path(DATA_DIR) / stock

    # 先嘗試統一 VP 檔案（新格式）
    patterns_unified = [
        f"{stock}_volume_profile_*.json",
        f"{stock.replace('.', '_')}_volume_profile_*.json"
    ]

    filepath_unified = find_file(str(stock_dir), patterns_unified)

    if filepath_unified:
        return load_volume_profile_unified(filepath_unified)

    # 再嘗試分散 VP 檔案（舊格式）
    print(f"  [INFO] {stock} 使用分散 VP 格式")
    return load_volume_profile_periods(stock)

def load_volume_profile_unified(filepath):
    """加載統一格式的 VP（新格式）"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = {}
    vp_data = data.get("data", {})
    for date, periods in vp_data.items():
        if date not in result:
            result[date] = {}

        for period_key in ["period_5", "period_20", "period_60"]:
            if period_key in periods and periods[period_key] is not None:
                profile = periods[period_key].get("profile", {})
                period = profile.get("period")
                result[date][f"vp_{period}"] = {
                    "poc": profile.get("poc"),
                    "vah": profile.get("vah"),
                    "val": profile.get("val")
                }

    print(f"  [OK] 統一 VP 格式: {len(result)} 筆")
    return result

def load_volume_profile_periods(stock):
    """加載分散格式的 VP（舊格式：period5, period20, period60）"""
    stock_dir = Path(DATA_DIR) / stock
    result = {}

    for period in [5, 20, 60]:
        patterns = [
            f"{stock}-vp_period{period}.json",
            f"{stock}_vp_period{period}.json",
            f"*vp_period{period}*.json"
        ]

        filepath = find_file(str(stock_dir), patterns)
        if not filepath:
            print(f"  [WARN] 找不到 period{period} VP: {stock}")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 分散格式可能是直接的陣列或有其他結構
        vp_data = data
        if isinstance(vp_data, dict) and "data" in vp_data:
            vp_data = vp_data["data"]

        if isinstance(vp_data, list):
            # 陣列格式
            for entry in vp_data:
                date = entry.get("date")
                if date:
                    if date not in result:
                        result[date] = {}
                    result[date][f"vp_{period}"] = {
                        "poc": entry.get("poc"),
                        "vah": entry.get("vah"),
                        "val": entry.get("val")
                    }

    print(f"  [OK] 分散 VP 格式: {len(result)} 筆")
    return result

def load_all_data():
    """加載所有 9 檔股票的資料"""
    print("\n=== 開始加載原始資料 ===\n")

    cache = {}
    for stock in STOCKS:
        print(f"加載 {stock}:")

        cache[stock] = {
            "indicators": load_indicator_data(stock),
            "adx": load_adx_data(stock),
            "volume_profile": load_volume_profile(stock)
        }

    return cache

def save_cache(cache):
    """保存快取為 JSON"""
    output_path = "cache_raw_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    print(f"\n[OK] 快取已保存: {output_path}")

if __name__ == "__main__":
    cache = load_all_data()
    save_cache(cache)
    print("\n=== 資料加載完成 ===")
