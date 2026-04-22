# -*- coding: utf-8 -*-
"""
07_statistics_analysis.py
職責：統計分析回測結果
計算指標：
  - 整體有效率（所有線條）
  - 按週期分組有效率
  - 按層級分組有效率
  - 按市況分組有效率
  - 按區位分組有效率
  - 鄰近失效統計
輸出：REPORT_v2.2_*.md
"""

import json
from collections import defaultdict
from pathlib import Path

ALL_STOCKS = ["2330.TW", "2317.TW", "2382.TW", "2454.TW", "2887.TW", "2408.TW", "2412.TW", "1402.TW", "1301.TW"]
SINGLE_STOCK = None  # 只跑單個股票，設為 None 則跑全部
STOCKS = [SINGLE_STOCK] if SINGLE_STOCK else ALL_STOCKS
PERIODS = [5, 20, 60]
STOCK_NAMES = {
    "2330.TW": "台積電",
    "2317.TW": "鴻海",
    "2382.TW": "廣達",
    "2454.TW": "聯發科",
    "2887.TW": "台新金",
    "2408.TW": "南亞科",
    "2412.TW": "中華電",
    "1402.TW": "遠東新",
    "1301.TW": "台塑"
}

def analyze_signals():
    """分析回測信號"""
    print("\n=== 開始統計分析 ===\n")

    # 加載所有信號
    signals_by_stock = {}
    for stock in STOCKS:
        output_file = Path("OUTPUT") / f"backtest_v2.2_{stock.replace('.', '_')}.json"
        if output_file.exists():
            with open(output_file, "r", encoding="utf-8") as f:
                signals_by_stock[stock] = json.load(f)
        else:
            signals_by_stock[stock] = []

    # ========== 全股票統計 ==========
    report_lines = []
    report_lines.append("# XQ 全球贏家 — v2.2 回測統計報告")
    report_lines.append("")
    report_lines.append("**報告日期：** 2026-04-21")
    report_lines.append("**演算法版本：** v2.2（區位感知 + 鄰近失效）")
    report_lines.append("")

    # ========== 整體有效率 ==========
    report_lines.append("## 第一部分：整體有效率（All Lines）")
    report_lines.append("")

    overall_stats = []
    for stock in STOCKS:
        signals = signals_by_stock[stock]
        if not signals:
            continue

        total = len(signals)
        valid = sum(1 for s in signals if s.get("is_valid", False))
        valid_rate = (valid / total * 100) if total > 0 else 0

        support_signals = [s for s in signals if s["type"] == "support"]
        support_valid = sum(1 for s in support_signals if s.get("is_valid", False))
        support_rate = (support_valid / len(support_signals) * 100) if support_signals else 0

        resistance_signals = [s for s in signals if s["type"] == "resistance"]
        resistance_valid = sum(1 for s in resistance_signals if s.get("is_valid", False))
        resistance_rate = (resistance_valid / len(resistance_signals) * 100) if resistance_signals else 0

        overall_stats.append({
            "stock": stock,
            "total": total,
            "valid": valid,
            "valid_rate": valid_rate,
            "support_rate": support_rate,
            "resistance_rate": resistance_rate
        })

        print(f"{stock} ({STOCK_NAMES[stock]}): {valid_rate:.1f}% ({valid}/{total})")

    # 輸出表格
    report_lines.append("| 股票代號 | 公司名稱 | 有效/總筆 | 有效率 | 支撐有效率 | 壓力有效率 |")
    report_lines.append("|---------|--------|----------|--------|------------|------------|")
    for stat in overall_stats:
        report_lines.append(f"| {stat['stock']} | {STOCK_NAMES[stat['stock']]} | {stat['valid']}/{stat['total']} | **{stat['valid_rate']:.1f}%** | {stat['support_rate']:.1f}% | {stat['resistance_rate']:.1f}% |")

    avg_valid_rate = sum(s["valid_rate"] for s in overall_stats) / len(overall_stats) if overall_stats else 0
    report_lines.append(f"| **平均** | — | — | **{avg_valid_rate:.1f}%** | — | — |")

    # ========== 按週期分組 ==========
    report_lines.append("")
    report_lines.append("## 第二部分：按週期分組有效率")
    report_lines.append("")

    for period in PERIODS:
        report_lines.append(f"### {period} 日週期")
        report_lines.append("")
        report_lines.append("| 股票 | 有效率 | 支撐 | 壓力 |")
        report_lines.append("|------|--------|------|------|")

        period_stats = []
        for stock in STOCKS:
            signals = signals_by_stock[stock]
            period_signals = [s for s in signals if s["period"] == period]

            if not period_signals:
                continue

            total = len(period_signals)
            valid = sum(1 for s in period_signals if s.get("is_valid", False))
            valid_rate = (valid / total * 100) if total > 0 else 0

            support_signals = [s for s in period_signals if s["type"] == "support"]
            support_valid = sum(1 for s in support_signals if s.get("is_valid", False))
            support_rate = (support_valid / len(support_signals) * 100) if support_signals else 0

            resistance_signals = [s for s in period_signals if s["type"] == "resistance"]
            resistance_valid = sum(1 for s in resistance_signals if s.get("is_valid", False))
            resistance_rate = (resistance_valid / len(resistance_signals) * 100) if resistance_signals else 0

            period_stats.append({
                "stock": stock,
                "valid_rate": valid_rate,
                "support_rate": support_rate,
                "resistance_rate": resistance_rate
            })

            report_lines.append(f"| {stock} | {valid_rate:.1f}% | {support_rate:.1f}% | {resistance_rate:.1f}% |")

        if period_stats:
            avg_valid = sum(s["valid_rate"] for s in period_stats) / len(period_stats)
            avg_support = sum(s["support_rate"] for s in period_stats) / len(period_stats)
            avg_resistance = sum(s["resistance_rate"] for s in period_stats) / len(period_stats)
            report_lines.append(f"| **平均** | **{avg_valid:.1f}%** | **{avg_support:.1f}%** | **{avg_resistance:.1f}%** |")

        report_lines.append("")

    # ========== 按層級分組 ==========
    report_lines.append("## 第三部分：按層級分組有效率")
    report_lines.append("")

    for layer in ["L1", "L2", "L3"]:
        report_lines.append(f"### {layer} 層")
        report_lines.append("")
        report_lines.append("| 股票 | {layer} 有效率 |".replace("{layer}", layer))
        report_lines.append("|------|----------|")

        layer_stats = []
        for stock in STOCKS:
            signals = signals_by_stock[stock]
            layer_signals = [s for s in signals if s["layer"] == layer]

            if not layer_signals:
                report_lines.append(f"| {stock} | — |")
                continue

            total = len(layer_signals)
            valid = sum(1 for s in layer_signals if s.get("is_valid", False))
            valid_rate = (valid / total * 100) if total > 0 else 0

            layer_stats.append(valid_rate)
            report_lines.append(f"| {stock} | {valid_rate:.1f}% |")

        if layer_stats:
            avg_rate = sum(layer_stats) / len(layer_stats)
            report_lines.append(f"| **平均** | **{avg_rate:.1f}%** |")

        report_lines.append("")

    # ========== 按市況分組 ==========
    report_lines.append("## 第四部分：按市況分組有效率")
    report_lines.append("")

    for state in ["TREND_UP", "TREND_DOWN", "RANGE"]:
        report_lines.append(f"### {state}")
        report_lines.append("")
        report_lines.append("| 股票 | 整體 | 支撐 | 壓力 |")
        report_lines.append("|------|------|------|------|")

        state_stats = []
        for stock in STOCKS:
            signals = signals_by_stock[stock]
            state_signals = [s for s in signals if s["market_state"] == state]

            if not state_signals:
                report_lines.append(f"| {stock} | — | — | — |")
                continue

            total = len(state_signals)
            valid = sum(1 for s in state_signals if s.get("is_valid", False))
            valid_rate = (valid / total * 100) if total > 0 else 0

            support_signals = [s for s in state_signals if s["type"] == "support"]
            support_valid = sum(1 for s in support_signals if s.get("is_valid", False))
            support_rate = (support_valid / len(support_signals) * 100) if support_signals else 0

            resistance_signals = [s for s in state_signals if s["type"] == "resistance"]
            resistance_valid = sum(1 for s in resistance_signals if s.get("is_valid", False))
            resistance_rate = (resistance_valid / len(resistance_signals) * 100) if resistance_signals else 0

            state_stats.append({
                "valid": valid_rate,
                "support": support_rate,
                "resistance": resistance_rate
            })

            report_lines.append(f"| {stock} | {valid_rate:.1f}% | {support_rate:.1f}% | {resistance_rate:.1f}% |")

        if state_stats:
            avg_valid = sum(s["valid"] for s in state_stats) / len(state_stats)
            avg_support = sum(s["support"] for s in state_stats) / len(state_stats)
            avg_resistance = sum(s["resistance"] for s in state_stats) / len(state_stats)
            report_lines.append(f"| **平均** | **{avg_valid:.1f}%** | **{avg_support:.1f}%** | **{avg_resistance:.1f}%** |")

        report_lines.append("")

    # ========== 鄰近失效統計 ==========
    report_lines.append("## 第五部分：鄰近失效統計（v2.2）")
    report_lines.append("")
    report_lines.append("| 股票 | 鄰近失效數 | 佔 L1 比例 |")
    report_lines.append("|------|----------|----------|")

    for stock in STOCKS:
        signals = signals_by_stock[stock]
        proximity_filtered = sum(1 for s in signals if s.get("vp_proximity_filtered", False))
        l1_signals = [s for s in signals if s["layer"] == "L1"]
        l1_count = len(l1_signals)

        if l1_count > 0:
            proximity_rate = (proximity_filtered / l1_count * 100)
        else:
            proximity_rate = 0

        report_lines.append(f"| {stock} | {proximity_filtered} | {proximity_rate:.1f}% |")

    # 保存報告
    report_path = Path("OUTPUT") / "REPORT_v2.2_統計分析.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

    print(f"\n[OK] 統計分析完成，已保存: {report_path}")

if __name__ == "__main__":
    analyze_signals()
    print("\n=== 統計分析結束 ===")
