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
        if candidate < current_price and distance <= -distance_threshold:
            return True, distance
    else:
        if candidate > current_price and distance >= distance_threshold:
            return True, distance

    return False, distance

def get_integer_candidates(price, is_support):
    """根據價格區間和方向，取得整數候選列表"""
    candidates = []

    if price < 10:
        # <10元：0.1倍數
        if is_support:
            candidates = [i * 0.1 for i in range(1, int(price * 10)) if i * 0.1 < price]
        else:
            candidates = [i * 0.1 for i in range(int(price * 10) + 1, 100)]

    elif price < 50:
        # 10~50元：0.5倍數
        if is_support:
            candidates = [i * 0.5 for i in range(20, int(price * 2)) if i * 0.5 < price]
        else:
            candidates = [i * 0.5 for i in range(int(price * 2) + 1, 100)]

    elif price < 100:
        # 50~100元：5倍數
        if is_support:
            candidates = [int(price / 5) * 5 - 5 * i for i in range(1, 20) if int(price / 5) * 5 - 5 * i > 0]
            candidates.reverse()
        else:
            candidates = [int(price / 5) * 5 + 5 * i for i in range(1, 20)]

    elif price < 500:
        # 100~500元：0/5尾
        if is_support:
            base = int(price / 10) * 10
            candidates = [base, base - 5] if base < price else [base - 10, base - 15]
            candidates = [c for c in candidates if c > 0 and c < price]
        else:
            base = int(price / 10) * 10
            candidates = [base + 10, base + 5] if base >= price else [base + 10, base + 15]
            candidates = [c for c in candidates if c > price]

    elif price < 1000:
        # 500~1000元：50倍數
        if is_support:
            candidates = [int(price / 50) * 50 - 50 * i for i in range(1, 20) if int(price / 50) * 50 - 50 * i >= 500]
            candidates.reverse()
        else:
            candidates = [int(price / 50) * 50 + 50 * i for i in range(1, 20) if int(price / 50) * 50 + 50 * i <= 1000]

    else:
        # 1000元以上：100倍數
        if is_support:
            candidates = [int(price / 100) * 100 - 100 * i for i in range(1, 50) if int(price / 100) * 100 - 100 * i > 0]
            candidates.reverse()
        else:
            candidates = [int(price / 100) * 100 + 100 * i for i in range(1, 50)]

    return candidates

def calculate_integer_fence(current_price, tier_farthest_value, timeframe_days, is_support):
    """
    計算整數防線（Stage 6）

    參數：
    - current_price：當前價格
    - tier_farthest_value：Tier 1-5的最遠值
    - timeframe_days：時間框架（5, 20, 60）
    - is_support：是否為支撐

    返回：整數防線值，或None
    """
    if tier_farthest_value is None:
        return None

    # 根據時間框架設定距離上限
    if timeframe_days == 5:
        distance_limit = 0.05  # 5%
    elif timeframe_days == 20:
        distance_limit = 0.12  # 12%
    elif timeframe_days == 60:
        distance_limit = 0.18  # 18%
    else:
        return None

    # 計算搜索範圍
    if is_support:
        lower_bound = tier_farthest_value * (1 - distance_limit)
        upper_bound = tier_farthest_value
    else:
        lower_bound = tier_farthest_value
        upper_bound = tier_farthest_value * (1 + distance_limit)

    # 取得整數候選
    all_candidates = get_integer_candidates(current_price, is_support)

    # 過濾在範圍內的候選
    if is_support:
        in_range = [c for c in all_candidates if lower_bound <= c <= upper_bound and c < tier_farthest_value]
    else:
        in_range = [c for c in all_candidates if lower_bound <= c <= upper_bound and c > tier_farthest_value]

    if in_range:
        # 支撐：選最大（最接近Tier最遠值）
        # 壓力：選最小（最接近Tier最遠值）
        if is_support:
            return max(in_range)
        else:
            return min(in_range)

    # 範圍內無符合整數，允許超界選擇
    if is_support:
        valid = [c for c in all_candidates if c < lower_bound]
        return max(valid) if valid else None
    else:
        valid = [c for c in all_candidates if c > upper_bound]
        return min(valid) if valid else None

def select_support_or_resistance(data, timeframe_days, timeframe_key, is_support, distance_threshold, larger_timeframe_days=None, larger_timeframe_key=None):
    """根據決策框架選擇支撐或壓力線（7階段）"""
    current_price = data['price_range'].get('close', data.get('close'))

    if 'ohlcv' in data and data['ohlcv']:
        current_price = data['ohlcv'][-1]['close']

    vp_data = get_volume_profile_data(data, timeframe_key)

    # Tier 1 候選
    high_key = f'high_{timeframe_days}d'
    low_key = f'low_{timeframe_days}d'

    high_value = data['price_range'].get(high_key)
    low_value = data['price_range'].get(low_key)

    tier1_candidates = []

    if is_support:
        if vp_data['val'] is not None:
            tier1_candidates.append(('VAL', vp_data['val']))
        if low_value is not None:
            tier1_candidates.append((f'{timeframe_days}日低點', low_value))
    else:
        if vp_data['vah'] is not None:
            tier1_candidates.append(('VAH', vp_data['vah']))
        if high_value is not None:
            tier1_candidates.append((f'{timeframe_days}日高點', high_value))

    # Stage 1-2：尋找符合距離要求的 Tier 1-2 候選
    for tier_num in [1, 2]:
        if tier_num == 1:
            candidates_to_check = tier1_candidates
        else:  # tier_num == 2
            candidates_to_check = [('POC', vp_data['poc'])]

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

    # Stage 2：Tier 1 次選（無距離要求）
    if tier1_candidates:
        if is_support:
            valid_candidates = [(n, v) for n, v in tier1_candidates if v is not None and v < current_price]
            if valid_candidates:
                best = max(valid_candidates, key=lambda x: x[1])
                distance = calculate_distance_percent(current_price, best[1])
                tier_farthest = best[1]
                return {
                    'value': best[1],
                    'source': best[0],
                    'tier': 1,
                    'distance': distance,
                    'type': '次選',
                    '_farthest': tier_farthest
                }
        else:
            valid_candidates = [(n, v) for n, v in tier1_candidates if v is not None and v > current_price]
            if valid_candidates:
                best = min(valid_candidates, key=lambda x: x[1])
                distance = calculate_distance_percent(current_price, best[1])
                tier_farthest = best[1]
                return {
                    'value': best[1],
                    'source': best[0],
                    'tier': 1,
                    'distance': distance,
                    'type': '次選',
                    '_farthest': tier_farthest
                }

    # Stage 3：當前時間框架的區間高低點
    if is_support:
        if low_value is not None and low_value < current_price:
            distance = calculate_distance_percent(current_price, low_value)
            return {
                'value': low_value,
                'source': f'{timeframe_days}日低點',
                'tier': '3',
                'distance': distance,
                'type': '降級',
                '_farthest': low_value
            }
    else:
        if high_value is not None and high_value > current_price:
            distance = calculate_distance_percent(current_price, high_value)
            return {
                'value': high_value,
                'source': f'{timeframe_days}日高點',
                'tier': '3',
                'distance': distance,
                'type': '降級',
                '_farthest': high_value
            }

    # Stage 4：更大時間框架的區間高低點
    tier_farthest = None
    if larger_timeframe_days and larger_timeframe_key:
        larger_high_key = f'high_{larger_timeframe_days}d'
        larger_low_key = f'low_{larger_timeframe_days}d'
        larger_high = data['price_range'].get(larger_high_key)
        larger_low = data['price_range'].get(larger_low_key)

        if is_support:
            if larger_low is not None and larger_low < current_price:
                distance = calculate_distance_percent(current_price, larger_low)
                tier_farthest = larger_low
                return {
                    'value': larger_low,
                    'source': f'{larger_timeframe_days}日低點',
                    'tier': '4',
                    'distance': distance,
                    'type': '降級',
                    '_farthest': tier_farthest
                }
        else:
            if larger_high is not None and larger_high > current_price:
                distance = calculate_distance_percent(current_price, larger_high)
                tier_farthest = larger_high
                return {
                    'value': larger_high,
                    'source': f'{larger_timeframe_days}日高點',
                    'tier': '4',
                    'distance': distance,
                    'type': '降級',
                    '_farthest': tier_farthest
                }

    # Stage 5：60日級聯到120日、240日
    if timeframe_days == 60:
        for cascade_days in [120, 240]:
            high_key = f'high_{cascade_days}d'
            low_key = f'low_{cascade_days}d'
            high_value = data['price_range'].get(high_key)
            low_value = data['price_range'].get(low_key)

            if is_support:
                if low_value is not None and low_value < current_price:
                    distance = calculate_distance_percent(current_price, low_value)
                    tier_farthest = low_value
                    return {
                        'value': low_value,
                        'source': f'{cascade_days}日低點',
                        'tier': '5',
                        'distance': distance,
                        'type': '降級',
                        '_farthest': tier_farthest
                    }
            else:
                if high_value is not None and high_value > current_price:
                    distance = calculate_distance_percent(current_price, high_value)
                    tier_farthest = high_value
                    return {
                        'value': high_value,
                        'source': f'{cascade_days}日高點',
                        'tier': '5',
                        'distance': distance,
                        'type': '降級',
                        '_farthest': tier_farthest
                    }

    # Stage 6：整數防線
    # 取得前面最遠值
    all_candidates = []
    if tier1_candidates:
        for n, v in tier1_candidates:
            if v is not None:
                all_candidates.append(v)
    if low_value is not None:
        all_candidates.append(low_value)
    if high_value is not None:
        all_candidates.append(high_value)
    if larger_timeframe_days:
        larger_high_key = f'high_{larger_timeframe_days}d'
        larger_low_key = f'low_{larger_timeframe_days}d'
        larger_high = data['price_range'].get(larger_high_key)
        larger_low = data['price_range'].get(larger_low_key)
        if larger_low is not None:
            all_candidates.append(larger_low)
        if larger_high is not None:
            all_candidates.append(larger_high)

    if all_candidates:
        if is_support:
            tier_farthest = min([c for c in all_candidates if c < current_price]) if any(c < current_price for c in all_candidates) else None
        else:
            tier_farthest = max([c for c in all_candidates if c > current_price]) if any(c > current_price for c in all_candidates) else None

        if tier_farthest is not None:
            integer_fence = calculate_integer_fence(current_price, tier_farthest, timeframe_days, is_support)
            if integer_fence is not None:
                distance = calculate_distance_percent(current_price, integer_fence)
                return {
                    'value': integer_fence,
                    'source': '整數防線',
                    'tier': '6',
                    'distance': distance,
                    'type': '防線'
                }

    # Stage 7：最遠值（兜底）
    if all_candidates:
        if is_support:
            farthest = min(all_candidates)
        else:
            farthest = max(all_candidates)

        distance = calculate_distance_percent(current_price, farthest)
        return {
            'value': farthest,
            'source': '最遠值',
            'tier': '7',
            'distance': distance,
            'type': '最遠'
        }

    return None

def get_timeframe_info(timeframe_days):
    """根據天數返回時間框架信息"""
    if timeframe_days == 5:
        return '短期(5日)', 3.0
    elif timeframe_days == 20:
        return '中期(20日)', 7.0
    elif timeframe_days == 60:
        return '長期(60日)', 10.0
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

    # 短期(5日) → 中期(20日) → 長期(60日)
    for timeframe_days, timeframe_key, larger_days, larger_key in [
        (5, 'period_5', 20, 'period_20'),
        (20, 'period_20', 60, 'period_60'),
        (60, 'period_60', None, None)
    ]:
        timeframe_name, distance_threshold = get_timeframe_info(timeframe_days)

        support = select_support_or_resistance(data, timeframe_days, timeframe_key, True, distance_threshold, larger_days, larger_key)
        resistance = select_support_or_resistance(data, timeframe_days, timeframe_key, False, distance_threshold, larger_days, larger_key)

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
