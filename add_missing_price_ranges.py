# -*- coding: utf-8 -*-
import json
import os

def calculate_price_ranges(data):
    """計算缺失的高低點數據（60日、120日）"""
    ohlcv = data['ohlcv']

    # 計算 60 日高低點
    recent_60 = ohlcv[-60:] if len(ohlcv) >= 60 else ohlcv
    high_60d = max([candle['high'] for candle in recent_60])
    low_60d = min([candle['low'] for candle in recent_60])

    # 計算 120 日高低點
    recent_120 = ohlcv[-120:] if len(ohlcv) >= 120 else ohlcv
    high_120d = max([candle['high'] for candle in recent_120])
    low_120d = min([candle['low'] for candle in recent_120])

    # 更新 price_range
    data['price_range']['high_60d'] = high_60d
    data['price_range']['low_60d'] = low_60d
    data['price_range']['high_120d'] = high_120d
    data['price_range']['low_120d'] = low_120d

    return data

def process_stock_file(symbol):
    """處理單檔股票文件"""
    file_path = f"./content/{symbol}_20260417.json"

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 計算缺失的高低點
    data = calculate_price_ranges(data)

    # 保存回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"已更新 {symbol}")
    print(f"  60d: high={data['price_range']['high_60d']}, low={data['price_range']['low_60d']}")
    print(f"  120d: high={data['price_range']['high_120d']}, low={data['price_range']['low_120d']}")

if __name__ == '__main__':
    os.chdir(r"c:\Users\millychou\Desktop\Project-AI Inside Technical Analysis\Claude-AI Inside Technical Analysis\Support Resistance Analysis20260428")

    symbols = ['2317.TW', '2330.TW', '2382.TW', '2454.TW', '2887.TW']

    for symbol in symbols:
        try:
            process_stock_file(symbol)
        except Exception as e:
            print(f"錯誤: {symbol} - {e}")

    print("\n已完成所有更新")
