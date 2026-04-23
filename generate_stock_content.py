# -*- coding: utf-8 -*-
"""
股票技術分析數據彙整腳本
從 DATA 資料夾提取各股票數據，計算技術指標，輸出 JSON 至 content 資料夾
"""

import json
import os
import glob
import sys
from pathlib import Path
import pandas as pd
from datetime import datetime

# 設定 UTF-8 輸出編碼
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# ============================================================================
# 設定
# ============================================================================

BASE_DIR = Path(__file__).parent  # 專案根目錄
DATA_DIR = BASE_DIR / "DATA"
CONTENT_DIR = BASE_DIR / "content"
STOCK_NAME_FILE = DATA_DIR / "股號vs股名.txt"

TARGET_SYMBOL = "2330.TW"
TARGET_DATE = "20260417"
OHLCV_START_DATE = "20251001"  # 篩選 OHLCV 的起始日期

# 允許透過命令列參數覆蓋預設值
import sys as _sys
if len(_sys.argv) > 1:
    TARGET_SYMBOL = _sys.argv[1]
if len(_sys.argv) > 2:
    TARGET_DATE = _sys.argv[2]
if len(_sys.argv) > 3:
    OHLCV_START_DATE = _sys.argv[3]

# 滾動期間
ROLLING_PERIODS = {
    "5d": 5,
    "10d": 10,
    "20d": 20,
    "240d": 240,
}


# ============================================================================
# 函式
# ============================================================================

def load_stock_names():
    """讀取股號 vs 股名對照表，返回 dict: {symbol: name}"""
    stock_map = {}
    with open(STOCK_NAME_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2:
                symbol = parts[-2]  # 倒數第二個為股號
                name = parts[-1]    # 最後一個為股名
                stock_map[symbol] = name
    return stock_map


def find_file_by_pattern(directory, pattern):
    """用 glob 模糊比對找檔案，返回第一筆符合的完整路徑，或 None"""
    matches = glob.glob(os.path.join(directory, pattern), recursive=False)
    return matches[0] if matches else None


def load_ohlcv_txt(filepath):
    """
    讀取 OHLCV txt 檔（JSON 格式）
    返回 DataFrame，columns: date, open, high, low, close, volume (數值型)
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    df = pd.DataFrame(data['data'])

    # 轉換資料型態：str -> float/int
    df['date'] = df['date'].astype(str)
    df['open'] = pd.to_numeric(df['open'], errors='coerce')
    df['high'] = pd.to_numeric(df['high'], errors='coerce')
    df['low'] = pd.to_numeric(df['low'], errors='coerce')
    df['close'] = pd.to_numeric(df['close'], errors='coerce')
    df['volume'] = pd.to_numeric(df['volume'], errors='coerce')

    df = df.sort_values('date').reset_index(drop=True)
    return df


def load_indicator_data(filepath):
    """
    讀取 indicator_data JSON 檔
    返回 DataFrame，columns: date, open, high, low, close, volume, ma5, ma10, ..., bband_upper, bband_lower
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    records = []
    for item in data['data']:
        record = {
            'date': item['date'],
            **item['indicators']['indicator']  # 展開 indicator 中的所有欄位
        }
        records.append(record)

    df = pd.DataFrame(records)
    df = df.sort_values('date').reset_index(drop=True)
    return df


def load_volume_profile(filepath):
    """
    讀取 volume profile JSON 檔
    返回 dict，key 為日期，value 為 {period_5, period_20, period_60}
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return data['data']


def calculate_rolling_high_low(df, periods_dict):
    """
    計算滾動高低價
    df: DataFrame with columns: date, high, low
    periods_dict: {label: days}
    返回 dict，key 為 label，value 為對應日期的滾動高/低價
    """
    result = {}
    for label, days in periods_dict.items():
        rolling_high = df['high'].rolling(window=days).max()
        rolling_low = df['low'].rolling(window=days).min()
        result[f"{label}_high"] = rolling_high
        result[f"{label}_low"] = rolling_low

    return result, rolling_high.iloc[-1], rolling_low.iloc[-1]


def get_target_date_data(df, target_date):
    """從 DataFrame 中取得目標日期的資料，返回 dict"""
    row = df[df['date'] == target_date]
    if row.empty:
        raise ValueError(f"找不到日期 {target_date} 的資料")
    return row.iloc[0].to_dict()


def get_previous_date_data(df, target_date):
    """從 DataFrame 中取得目標日期前一日的資料"""
    idx = df[df['date'] == target_date].index[0]
    if idx == 0:
        return None
    return df.iloc[idx - 1].to_dict()


def filter_ohlcv_by_date_range(df, start_date, end_date):
    """篩選指定日期範圍的 OHLCV 資料"""
    mask = (df['date'] >= start_date) & (df['date'] <= end_date)
    return df[mask].copy()


def calculate_round_price_levels(close_price, range_pct=0.20, step=50):
    """
    計算整數關卡點
    以 close_price 為基準，±range_pct% 範圍內，計算 step 的倍數
    """
    lower_bound = close_price * (1 - range_pct)
    upper_bound = close_price * (1 + range_pct)

    levels = []
    current = (int(lower_bound / step) * step)
    while current <= upper_bound:
        if current > 0:  # 只取正數
            levels.append(round(current, 2))
        current += step

    return levels


def calculate_cdp_points(prev_high, prev_low, prev_close):
    """
    計算 CDP（反向操作點）
    使用前一日 H/L/C 計算今日的四個關鍵點
    """
    ahv = (prev_high + prev_low + prev_close * 2) / 4
    range_val = prev_high - prev_low

    return {
        'cdp_chase_buy': ahv + range_val,      # CDP追買點
        'cdp_sell': 2 * ahv - prev_low,        # CDP賣出點
        'cdp_buy': 2 * ahv - prev_high,        # CDP買進點
        'cdp_chase_sell': ahv - range_val,     # CDP追賣點
    }


def generate_stock_content(symbol, target_date):
    """
    主函式：彙整指定個股、日期的內容
    """
    print(f"処理 {symbol} - {target_date}...")

    # -------------------------------------------------------
    # 1. 讀取股名
    # -------------------------------------------------------
    stock_names = load_stock_names()
    if symbol not in stock_names:
        raise ValueError(f"找不到股票 {symbol} 的名稱")
    stock_name = stock_names[symbol]
    print(f"  股票名稱: {stock_name}")

    # -------------------------------------------------------
    # 2. 定位股票資料夾
    # -------------------------------------------------------
    symbol_dir = DATA_DIR / symbol
    if not symbol_dir.exists():
        raise FileNotFoundError(f"找不到資料夾: {symbol_dir}")

    # -------------------------------------------------------
    # 3. 尋找並讀取 OHLCV 檔
    # -------------------------------------------------------
    ohlcv_file = find_file_by_pattern(str(symbol_dir), "*OHLCV*.txt")
    if not ohlcv_file:
        raise FileNotFoundError(f"找不到 OHLCV 檔在 {symbol_dir}")
    print(f"  OHLCV 檔: {Path(ohlcv_file).name}")

    df_ohlcv = load_ohlcv_txt(ohlcv_file)
    print(f"    - 共 {len(df_ohlcv)} 筆交易日")

    # -------------------------------------------------------
    # 4. 讀取 indicator_data 檔
    # -------------------------------------------------------
    indicator_file = find_file_by_pattern(str(symbol_dir), "indicator_data*.json")
    if not indicator_file:
        raise FileNotFoundError(f"找不到 indicator_data 檔在 {symbol_dir}")
    print(f"  indicator_data 檔: {Path(indicator_file).name}")

    df_indicators = load_indicator_data(indicator_file)
    print(f"    - 共 {len(df_indicators)} 筆交易日")

    # -------------------------------------------------------
    # 5. 讀取 volume_profile 檔
    # -------------------------------------------------------
    vp_file = find_file_by_pattern(str(symbol_dir), "*volume_profile*.json")
    if not vp_file:
        raise FileNotFoundError(f"找不到 volume_profile 檔在 {symbol_dir}")
    print(f"  volume_profile 檔: {Path(vp_file).name}")

    volume_profile_data = load_volume_profile(vp_file)
    if target_date not in volume_profile_data:
        raise ValueError(f"找不到 {target_date} 的 volume profile 資料")

    # -------------------------------------------------------
    # 6. 檢查目標日期是否存在
    # -------------------------------------------------------
    if target_date not in df_ohlcv['date'].values:
        raise ValueError(f"找不到 {target_date} 在 OHLCV 資料中")

    if target_date not in df_indicators['date'].values:
        raise ValueError(f"找不到 {target_date} 在 indicator_data 中")

    # -------------------------------------------------------
    # 7. 計算滾動高低價
    # -------------------------------------------------------
    rolling_data, h_240, l_240 = calculate_rolling_high_low(df_ohlcv, ROLLING_PERIODS)

    # 對應日期的索引
    target_idx = df_ohlcv[df_ohlcv['date'] == target_date].index[0]

    price_range = {
        'high_5d': float(rolling_data['5d_high'].iloc[target_idx]),
        'low_5d': float(rolling_data['5d_low'].iloc[target_idx]),
        'high_10d': float(rolling_data['10d_high'].iloc[target_idx]),
        'low_10d': float(rolling_data['10d_low'].iloc[target_idx]),
        'high_20d': float(rolling_data['20d_high'].iloc[target_idx]),
        'low_20d': float(rolling_data['20d_low'].iloc[target_idx]),
        'high_240d': float(rolling_data['240d_high'].iloc[target_idx]),
        'low_240d': float(rolling_data['240d_low'].iloc[target_idx]),
    }
    print(f"  滾動高低價計算完成")

    # -------------------------------------------------------
    # 8. 取得目標日期和前一日的指標資料
    # -------------------------------------------------------
    target_data = get_target_date_data(df_indicators, target_date)
    prev_data = get_previous_date_data(df_indicators, target_date)

    if prev_data is None:
        print("  警告: 找不到前一日資料，部份計算可能為 None")

    # -------------------------------------------------------
    # 9. 組織輸出資料
    # -------------------------------------------------------
    output = {
        'symbol': symbol,
        'name': stock_name,
        'date': target_date,
        'price_range': price_range,
        'moving_averages': {
            'ma5': float(target_data.get('ma5', 0)),
            'ma10': float(target_data.get('ma10', 0)),
            'ma20': float(target_data.get('ma20', 0)),
            'ma60': float(target_data.get('ma60', 0)),
            'ma120': float(target_data.get('ma120', 0)),
            'ma240': float(target_data.get('ma240', 0)),
        },
        'bollinger_bands': {
            'upper': float(target_data.get('bband_upper', 0)),
            'lower': float(target_data.get('bband_lower', 0)),
        },
    }

    # MA 軌道
    ma10 = float(target_data.get('ma10', 0))
    output['ma_channel'] = {
        'upper': ma10 * 1.03,
        'lower': ma10 * 0.97,
    }

    # -------------------------------------------------------
    # 10. 篩選 OHLCV 資料（20251001 至目標日期）
    # -------------------------------------------------------
    df_filtered_ohlcv = filter_ohlcv_by_date_range(df_ohlcv, OHLCV_START_DATE, target_date)
    output['ohlcv'] = [
        {
            'date': row['date'],
            'open': float(row['open']),
            'high': float(row['high']),
            'low': float(row['low']),
            'close': float(row['close']),
            'volume': int(row['volume']),
        }
        for _, row in df_filtered_ohlcv.iterrows()
    ]
    print(f"  OHLCV 篩選完成: {len(output['ohlcv'])} 筆")

    # -------------------------------------------------------
    # 11. 提取 Volume Profile
    # -------------------------------------------------------
    vp = volume_profile_data[target_date]
    output['volume_profile'] = {
        'period_5': {
            'poc': float(vp['period_5']['profile']['poc']),
            'vah': float(vp['period_5']['profile']['vah']),
            'val': float(vp['period_5']['profile']['val']),
            'buckets': [
                {
                    'price_low': float(b['price_low']),
                    'price_high': float(b['price_high']),
                    'volume': float(b['volume']),
                }
                for b in vp['period_5']['profile']['buckets']
            ]
        },
        'period_20': {
            'poc': float(vp['period_20']['profile']['poc']),
            'vah': float(vp['period_20']['profile']['vah']),
            'val': float(vp['period_20']['profile']['val']),
            'buckets': [
                {
                    'price_low': float(b['price_low']),
                    'price_high': float(b['price_high']),
                    'volume': float(b['volume']),
                }
                for b in vp['period_20']['profile']['buckets']
            ]
        },
        'period_60': {
            'poc': float(vp['period_60']['profile']['poc']),
            'vah': float(vp['period_60']['profile']['vah']),
            'val': float(vp['period_60']['profile']['val']),
            'buckets': [
                {
                    'price_low': float(b['price_low']),
                    'price_high': float(b['price_high']),
                    'volume': float(b['volume']),
                }
                for b in vp['period_60']['profile']['buckets']
            ]
        }
    }
    print(f"  Volume Profile 提取完成")

    # -------------------------------------------------------
    # 12. 計算關鍵點
    # -------------------------------------------------------
    calculated = {}
    calculated['ma_channel_upper'] = output['ma_channel']['upper']
    calculated['ma_channel_lower'] = output['ma_channel']['lower']

    if prev_data is not None:
        prev_high = float(prev_data.get('high', 0))
        prev_low = float(prev_data.get('low', 0))
        prev_close = float(prev_data.get('close', 0))

        # 上關 / 下關
        range_val = prev_high - prev_low
        calculated['upper_gate'] = prev_low + range_val * 1.382
        calculated['lower_gate'] = prev_high - range_val * 1.382

        # CDP 四點
        cdp = calculate_cdp_points(prev_high, prev_low, prev_close)
        calculated.update(cdp)
    else:
        calculated['upper_gate'] = None
        calculated['lower_gate'] = None
        calculated['cdp_chase_buy'] = None
        calculated['cdp_sell'] = None
        calculated['cdp_buy'] = None
        calculated['cdp_chase_sell'] = None

    # 整數關卡點
    target_close = float(target_data.get('close', 0))
    calculated['round_price_levels'] = calculate_round_price_levels(target_close)

    output['calculated'] = calculated
    print(f"  計算完成")

    # -------------------------------------------------------
    # 13. 輸出 JSON
    # -------------------------------------------------------
    CONTENT_DIR.mkdir(exist_ok=True)

    output_file = CONTENT_DIR / f"{symbol}_{target_date}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✓ 輸出完成: {output_file}")
    return output_file


# ============================================================================
# 主程式
# ============================================================================

if __name__ == "__main__":
    try:
        output_path = generate_stock_content(TARGET_SYMBOL, TARGET_DATE)
        print(f"\n成功完成！輸出檔案: {output_path}")
    except Exception as e:
        print(f"\n錯誤: {e}")
        import traceback
        traceback.print_exc()
