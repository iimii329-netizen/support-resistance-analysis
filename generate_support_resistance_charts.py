# -*- coding: utf-8 -*-
import json
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime
import glob
import os

# 支撐壓力數據（從5檔個股分析.md提取）
sr_data = {
    "2330.TW": {
        "5日": {"支撐": 1970.00, "壓力": 2031.25},
        "20日": {"支撐": 1980.99, "壓力": 2100.00},
        "60日": {"支撐": 1939.00, "壓力": 2100.00},
    },
    "2317.TW": {
        "5日": {"支撐": 198.50, "壓力": 206.08},
        "20日": {"支撐": 195.90, "壓力": 207.10},
        "60日": {"支撐": 201.80, "壓力": 215.00},
    },
    "2382.TW": {
        "5日": {"支撐": 317.13, "壓力": 324.63},
        "20日": {"支撐": 314.20, "壓力": 329.50},
        "60日": {"支撐": 297.99, "壓力": 329.50},
    },
    "2454.TW": {
        "5日": {"支撐": 1837.75, "壓力": 1949.41},
        "20日": {"支撐": 1718.75, "壓力": 1955.00},
        "60日": {"支撐": 1782.50, "壓力": 1947.50},
    },
    "2887.TW": {
        "5日": {"支撐": 24.16, "壓力": 24.32},
        "20日": {"支撐": 23.10, "壓力": 25.10},
        "60日": {"支撐": 23.14, "壓力": 24.53},
    },
}

# 顏色配置
colors = {
    "5日支撐": "#FF6B6B",      # 紅色
    "5日壓力": "#FF8C8C",      # 淺紅色
    "20日支撐": "#4ECDC4",     # 青色
    "20日壓力": "#45B7AA",     # 深青色
    "60日支撐": "#FFD93D",     # 黃色
    "60日壓力": "#FFC107",     # 深黃色
}

def load_ohlcv_data(stock_id):
    """讀取股票OHLCV數據"""
    pattern = f"DATA/{stock_id}/{stock_id}-OHLCV-*.txt"
    files = glob.glob(pattern)

    if not files:
        print(f"Error reading {stock_id}: No OHLCV file found")
        return None

    file_path = files[0]

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        df = pd.DataFrame(data['data'])
        df['date'] = pd.to_datetime(df['date'], format='%Y%m%d')
        df['open'] = df['open'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)
        df['close'] = df['close'].astype(float)
        df['volume'] = df['volume'].astype(int)

        return df.sort_values('date')
    except Exception as e:
        print(f"Error reading {stock_id}: {e}")
        return None

def generate_chart(stock_id, df):
    """生成包含支撐壓力線的K線圖"""

    # 創建圖表
    fig = go.Figure()

    # 添加K線
    fig.add_trace(go.Candlestick(
        x=df['date'],
        open=df['open'],
        high=df['high'],
        low=df['low'],
        close=df['close'],
        name='K線',
        increasing_line_color='#FF6B6B',
        decreasing_line_color='#4ECDC4'
    ))

    # 添加支撐壓力線
    sr = sr_data[stock_id]

    # 5日支撐線
    fig.add_hline(
        y=sr["5日"]["支撐"],
        line_dash="dash",
        line_color=colors["5日支撐"],
        annotation_text=f"5日支撐: {sr['5日']['支撐']:.2f}",
        annotation_position="right",
        annotation_font_size=10,
        annotation_font_color=colors["5日支撐"]
    )

    # 5日壓力線
    fig.add_hline(
        y=sr["5日"]["壓力"],
        line_dash="dash",
        line_color=colors["5日壓力"],
        annotation_text=f"5日壓力: {sr['5日']['壓力']:.2f}",
        annotation_position="right",
        annotation_font_size=10,
        annotation_font_color=colors["5日壓力"]
    )

    # 20日支撐線
    fig.add_hline(
        y=sr["20日"]["支撐"],
        line_dash="dot",
        line_color=colors["20日支撐"],
        annotation_text=f"20日支撐: {sr['20日']['支撐']:.2f}",
        annotation_position="right",
        annotation_font_size=10,
        annotation_font_color=colors["20日支撐"]
    )

    # 20日壓力線
    fig.add_hline(
        y=sr["20日"]["壓力"],
        line_dash="dot",
        line_color=colors["20日壓力"],
        annotation_text=f"20日壓力: {sr['20日']['壓力']:.2f}",
        annotation_position="right",
        annotation_font_size=10,
        annotation_font_color=colors["20日壓力"]
    )

    # 60日支撐線
    fig.add_hline(
        y=sr["60日"]["支撐"],
        line_dash="solid",
        line_color=colors["60日支撐"],
        line_width=2,
        annotation_text=f"60日支撐: {sr['60日']['支撐']:.2f}",
        annotation_position="right",
        annotation_font_size=10,
        annotation_font_color=colors["60日支撐"]
    )

    # 60日壓力線
    fig.add_hline(
        y=sr["60日"]["壓力"],
        line_dash="solid",
        line_color=colors["60日壓力"],
        line_width=2,
        annotation_text=f"60日壓力: {sr['60日']['壓力']:.2f}",
        annotation_position="right",
        annotation_font_size=10,
        annotation_font_color=colors["60日壓力"]
    )

    # 更新佈局
    fig.update_layout(
        title=f"{stock_id} — 2026-04-17 支撐壓力分析",
        yaxis_title="股價",
        xaxis_title="日期",
        template="plotly_white",
        height=700,
        xaxis_rangeslider_visible=False,
        hovermode='x unified',
        font=dict(family="Microsoft YaHei, Arial", size=12)
    )

    # 設定X軸範圍（顯示最近200天）
    if len(df) > 200:
        start_idx = len(df) - 200
        fig.update_xaxes(range=[df.iloc[start_idx]['date'], df.iloc[-1]['date']])

    return fig

def main():
    """主程序"""
    stocks = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW"]

    for stock_id in stocks:
        print(f"Processing {stock_id}...")

        # 讀取數據
        df = load_ohlcv_data(stock_id)
        if df is None:
            continue

        # 生成圖表
        fig = generate_chart(stock_id, df)

        # 保存為HTML
        output_file = f"繪圖/{stock_id}_support_resistance.html"
        fig.write_html(output_file)
        print(f"[OK] {stock_id} saved to {output_file}")

    print("\nAll charts generated successfully!")

if __name__ == "__main__":
    main()
