# -*- coding: utf-8 -*-
import json
import sys

# 讀取支撐壓力數據
with open('Web/chart-demo/public/data/support-resistance.json', 'r', encoding='utf-8') as f:
    sr_data = json.load(f)

# 讀取stocks.json
with open('Web/chart-demo/public/data/stocks.json', 'r', encoding='utf-8') as f:
    stocks_data = json.load(f)

# 為每個股票更新periods數據
for stock_id, sr_info in sr_data.items():
    if stock_id not in stocks_data:
        print(f'警告: {stock_id} 不在 stocks.json 中')
        continue

    stock = stocks_data[stock_id]

    # 為每個時間框架（short, medium, long）更新
    for period_name in ['short', 'medium', 'long']:
        if period_name not in sr_info:
            continue

        period_sr = sr_info[period_name]

        # 確保periods結構存在
        if 'periods' not in stock:
            stock['periods'] = {}
        if period_name not in stock['periods']:
            stock['periods'][period_name] = {}

        period = stock['periods'][period_name]

        # 更新support（保留原有的members，但用新的price）
        if 'support' not in period:
            period['support'] = {}

        support_sr = period_sr['support']
        period['support']['price'] = support_sr['value']
        period['support']['display'] = f"{int(support_sr['value'])}"
        period['support']['summary'] = f"支撐位於 {support_sr['value']} ({support_sr['source']})"
        period['support']['members'] = [support_sr['source']]

        # 更新resistance
        if 'resistance' not in period:
            period['resistance'] = {}

        resistance_sr = period_sr['resistance']
        period['resistance']['price'] = resistance_sr['value']
        period['resistance']['display'] = f"{int(resistance_sr['value'])}"
        period['resistance']['summary'] = f"壓力位於 {resistance_sr['value']} ({resistance_sr['source']})"
        period['resistance']['members'] = [resistance_sr['source']]

        # 添加整數防線信息
        period['integer_levels'] = period_sr['integer_level']

print('正在保存更新後的 stocks.json...')

# 保存更新後的stocks.json
with open('Web/chart-demo/public/data/stocks.json', 'w', encoding='utf-8') as f:
    json.dump(stocks_data, f, ensure_ascii=False, indent=2)

print('✓ stocks.json 已更新完成')
