# -*- coding: utf-8 -*-
import json
import os

# 讀取支撐壓力數據
sr_path = 'Web/chart-demo/public/data/support-resistance.json'
with open(sr_path, 'r', encoding='utf-8') as f:
    sr_data = json.load(f)

# content資料夾路徑
content_dir = 'content'
stock_ids = ['2317.TW', '2330.TW', '2382.TW', '2454.TW', '2887.TW']

for stock_id in stock_ids:
    content_path = os.path.join(content_dir, f'{stock_id}_20260417.json')

    # 讀取content JSON
    with open(content_path, 'r', encoding='utf-8') as f:
        content = json.load(f)

    # 獲取該股票的支撐壓力數據
    if stock_id in sr_data:
        content['support_resistance'] = sr_data[stock_id]

    # 保存更新後的JSON
    with open(content_path, 'w', encoding='utf-8') as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

    print(f'已更新: {stock_id}')

print('所有content文件已更新')
