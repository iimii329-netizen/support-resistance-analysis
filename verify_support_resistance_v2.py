# -*- coding: utf-8 -*-
import json
import os
from pathlib import Path

def load_stock_data(symbol):
    """載入股票JSON數據"""
    file_path = f"./content/{symbol}_20260417.json"
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_volume_profile_data(data, timeframe_key):
    """提取指定時間框架的體積輪廓數據"""
    vp = data['volume_profile'].get(timeframe_key, {})
    return {
        'val': vp.get('val'),
        'poc': vp.get('poc'),
        'vah': vp.get('vah'),
    }

def calculate_distance_percent(current_price, candidate):
    """計算距離百分比"""
    if candidate is None or current_price is None:
        return None
    return (candidate - current_price) / current_price * 100

def check_candidate(candidate, current_price, is_support, distance_threshold):
    """檢查候選值是否符合條件"""
    if candidate is None:
        return False, None

    distance = calculate_distance_percent(current_price, candidate)

    if is_support:
        # 支撐線：candidate < current_price，距離 < 0
        if candidate < current_price and distance <= -distance_threshold:
            return True, distance
    else:
        # 壓力線：candidate > current_price，距離 > 0
        if candidate > current_price and distance >= distance_threshold:
            return True, distance

    return False, distance

def select_support_or_resistance(data, timeframe_days, timeframe_key, is_support, distance_threshold):
    """根據決策框架選擇支撐或壓力線"""
    current_price = data['price_range'].get('close', data.get('close'))

    # 從最後一個OHLCV記錄取得當前價格
    if 'ohlcv' in data and data['ohlcv']:
        current_price = data['ohlcv'][-1]['close']

    vp_data = get_volume_profile_data(data, timeframe_key)

    # 定義Tier 1候選
    high_key = f'high_{timeframe_days}d'
    low_key = f'low_{timeframe_days}d'

    high_value = data['price_range'].get(high_key)
    low_value = data['price_range'].get(low_key)

    tier1_candidates = []

    if is_support:
        # 支撐：VAL 和 低點
        if vp_data['val'] is not None:
            tier1_candidates.append(('VAL', vp_data['val']))
        if low_value is not None:
            tier1_candidates.append((f'{timeframe_days}日低點', low_value))
    else:
        # 壓力：VAH 和 高點
        if vp_data['vah'] is not None:
            tier1_candidates.append(('VAH', vp_data['vah']))
        if high_value is not None:
            tier1_candidates.append((f'{timeframe_days}日高點', high_value))

    # 第一階段：尋找符合距離要求的候選
    for tier_num in range(1, 6):
        if tier_num == 1:
            candidates_to_check = tier1_candidates
        elif tier_num == 2:
            candidates_to_check = [('POC', vp_data['poc'])]
        else:
            break  # 簡化版本，只檢查Tier 1-2

        for name, candidate in candidates_to_check:
            passed, distance = check_candidate(candidate, current_price, is_support, distance_threshold)
            if passed:
                return {
                    'value': candidate,
                    'source': name,
                    'tier': tier_num,
                    'distance': distance,
                    'type': '首選'
                }

    # 第二階段：降級尋找（選擇邏輯正確的Tier 1候選）
    if tier1_candidates:
        if is_support:
            # 支撐：選擇「小於價格」的最高值（最接近但仍在下方）
            valid_candidates = [(n, v) for n, v in tier1_candidates if v is not None and v < current_price]
            if valid_candidates:
                best = max(valid_candidates, key=lambda x: x[1])
            else:
                return None
        else:
            # 壓力：選擇「大於價格」的最低值（最接近但仍在上方）
            valid_candidates = [(n, v) for n, v in tier1_candidates if v is not None and v > current_price]
            if valid_candidates:
                best = min(valid_candidates, key=lambda x: x[1])
            else:
                return None

        if best[1] is not None:
            distance = calculate_distance_percent(current_price, best[1])
            return {
                'value': best[1],
                'source': best[0],
                'tier': 1,
                'distance': distance,
                'type': '次選'
            }

    return None

def get_timeframe_info(timeframe_days):
    """根據天數返回時間框架信息"""
    if timeframe_days == 5:
        return '短期(5日)', 3.0
    elif timeframe_days == 20:
        return '中期(20日)', 7.0
    elif timeframe_days == 60:
        return '長期(60日)', 15.0
    return f'{timeframe_days}日', None

def analyze_stock(symbol):
    """分析單檔股票"""
    lines = []
    lines.append("\n" + "="*80)
    lines.append(f"分析股票: {symbol}")
    lines.append("="*80)

    data = load_stock_data(symbol)

    # 從OHLCV取得當前價格
    current_price = data['ohlcv'][-1]['close']
    lines.append(f"當前價格: {current_price}")

    results = {}

    for timeframe_days, timeframe_key in [(5, 'period_5'), (20, 'period_20'), (60, 'period_60')]:
        timeframe_name, distance_threshold = get_timeframe_info(timeframe_days)

        support = select_support_or_resistance(data, timeframe_days, timeframe_key, True, distance_threshold)
        resistance = select_support_or_resistance(data, timeframe_days, timeframe_key, False, distance_threshold)

        lines.append(f"\n{timeframe_name}:")

        if support:
            lines.append(f"  支撐: {support['value']:.2f} (來源: {support['source']}, {support['type']}, 距離: {support['distance']:.2f}%)")
        else:
            lines.append(f"  支撐: 無")

        if resistance:
            lines.append(f"  壓力: {resistance['value']:.2f} (來源: {resistance['source']}, {resistance['type']}, 距離: {resistance['distance']:.2f}%)")
        else:
            lines.append(f"  壓力: 無")

        results[timeframe_name] = {
            'support': support,
            'resistance': resistance
        }

    return results, lines

if __name__ == '__main__':
    os.chdir(r"c:\Users\millychou\Desktop\Project-AI Inside Technical Analysis\Claude-AI Inside Technical Analysis\Support Resistance Analysis20260428")

    symbols = ['2317.TW', '2330.TW', '2382.TW', '2454.TW', '2887.TW']

    all_results = {}
    all_lines = []
    for symbol in symbols:
        try:
            results, lines = analyze_stock(symbol)
            all_results[symbol] = results
            all_lines.extend(lines)
        except Exception as e:
            all_lines.append(f"\n錯誤: {symbol} - {e}")

    all_lines.append("\n" + "="*80)
    all_lines.append("分析完成")
    all_lines.append("="*80)

    # 保存到文件
    output_text = '\n'.join(all_lines)
    with open('支撐壓力線驗證結果.txt', 'w', encoding='utf-8') as f:
        f.write(output_text)

    print(output_text)
