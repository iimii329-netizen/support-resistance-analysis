# -*- coding: utf-8 -*-
"""
批次抓取 VP 資料到本地 JSON，支持斷點續跑
針對 5 檔股票、2 個時間段、3 個 period
預計 12,000 次 API 呼叫
"""

import sys
import os
import io
import json
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api_client import AIInsightAPIClient

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


class VPDataFetcher:
    """VP 資料批次抓取工具"""

    def __init__(self, symbols=None):
        self.client = AIInsightAPIClient(
            base_url="http://192.168.100.129/aiinsight2/",
            kline_base_url="https://mrtuat.xq.com.tw/sysjustMCP/"
        )
        self.symbols = symbols if symbols else ["2002.TW", "2317.TW", "2330.TW", "2615.TW", "2881.TW"]
        self.periods = [5, 20, 60]
        self.data_base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "VP_DATA")
        self.stats = {"fetched": 0, "skipped": 0, "errors": 0, "total": 0}

    def setup_directories(self):
        """建立資料夾結構"""
        for symbol in self.symbols:
            symbol_dir = os.path.join(self.data_base_dir, symbol)
            os.makedirs(symbol_dir, exist_ok=True)
        print(f"✓ 資料夾建立完成: {self.data_base_dir}")

    def get_trading_dates(self, date_from: str, date_to: str):
        """產生交易日期範圍（排除週末）"""
        dates = []
        current = datetime.strptime(date_from, "%Y%m%d")
        end = datetime.strptime(date_to, "%Y%m%d")

        while current <= end:
            if current.weekday() < 5:  # 週一到週五
                dates.append(current.strftime("%Y%m%d"))
            current += timedelta(days=1)

        return dates

    def get_vp_filepath(self, symbol: str, period: int):
        """取得 VP 資料檔案路徑"""
        return os.path.join(self.data_base_dir, symbol, f"vp_period{period}.json")

    def load_vp_data(self, symbol: str, period: int):
        """載入已存在的 VP 資料"""
        filepath = self.get_vp_filepath(symbol, period)
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠ 讀取檔案失敗 {filepath}: {e}")
                return {}
        return {}

    def save_vp_data(self, symbol: str, period: int, data: dict):
        """保存 VP 資料"""
        filepath = self.get_vp_filepath(symbol, period)
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"❌ 保存檔案失敗 {filepath}: {e}")

    def fetch_vp_for_date(self, symbol: str, period: int, date: str, retries=3):
        """抓取單日 VP 資料"""
        for attempt in range(retries):
            try:
                result = self.client.get_volume_profile(
                    symbol=symbol,
                    period=period,
                    date=date,
                    rows=50 if period == 5 else (100 if period == 20 else 150)
                )

                if "error" not in result:
                    if "profile" in result:
                        return result["profile"]
                    else:
                        return result
                else:
                    if attempt < retries - 1:
                        time.sleep(1)
                        continue
                    else:
                        return None

            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(1)
                    continue
                else:
                    print(f"❌ API 異常 {symbol} {period}日 {date}: {str(e)}")
                    return None

        return None

    def fetch_batch(self, symbol: str, period: int, dates: list, dry_run=False):
        """批次抓取單個股票、單個 period 的資料"""
        print(f"\n【{symbol} | period={period}日】")
        print(f"  時間範圍: {dates[0]} ~ {dates[-1]} ({len(dates)} 個交易日)")

        # 載入已存在的資料
        existing_data = self.load_vp_data(symbol, period)
        skip_count = len(existing_data)

        # 決定要抓取的日期
        dates_to_fetch = [d for d in dates if d not in existing_data]

        if not dates_to_fetch:
            print(f"✓ 全部已抓取 ({skip_count} 筆)")
            self.stats["skipped"] += skip_count
            self.stats["total"] += skip_count
            return

        print(f"  已有: {skip_count} 筆，待抓: {len(dates_to_fetch)} 筆")

        if dry_run:
            print(f"  [模擬模式] 不實際抓取")
            self.stats["total"] += len(dates_to_fetch)
            return

        # 抓取並保存
        new_data = existing_data.copy()
        failed_dates = []

        for i, date in enumerate(dates_to_fetch, 1):
            progress = f"[{i}/{len(dates_to_fetch)}]"

            vp_data = self.fetch_vp_for_date(symbol, period, date)

            if vp_data:
                new_data[date] = vp_data
                self.stats["fetched"] += 1

                # 每 10 筆保存一次
                if i % 10 == 0:
                    self.save_vp_data(symbol, period, new_data)
                    print(f"  {progress} {date} ✓ （已保存）")
                else:
                    print(f"  {progress} {date} ✓")

            else:
                self.stats["errors"] += 1
                failed_dates.append(date)
                print(f"  {progress} {date} ✗ 失敗")

            self.stats["total"] += 1

            # 每 100 筆暫停 1 秒，避免 API 壓力
            if i % 100 == 0:
                time.sleep(1)

        # 最後保存一次
        self.save_vp_data(symbol, period, new_data)

        if failed_dates:
            print(f"  ⚠ 失敗的日期 ({len(failed_dates)}): {', '.join(failed_dates[:5])}" +
                  (f"..." if len(failed_dates) > 5 else ""))
        else:
            print(f"  ✓ 全部完成")

    def run(self, dry_run=False):
        """主流程：批次抓取"""
        print("="*60)
        print("VP 資料批次抓取工具")
        print("="*60)

        if dry_run:
            print("📋 模擬模式（不實際發送 API 請求）\n")

        self.setup_directories()

        # 定義時間段
        time_ranges = [
            ("20210501", "20240630", "訓練區間"),
            ("20250101", "20260417", "樣本外")
        ]

        total_dates = 0
        for date_from, date_to, label in time_ranges:
            dates = self.get_trading_dates(date_from, date_to)
            total_dates += len(dates)
            print(f"\n📅 {label} ({date_from} ~ {date_to}): {len(dates)} 個交易日")

        print(f"\n總計: {total_dates} 個交易日 × {len(self.symbols)} 檔股票 × {len(self.periods)} 個 period")
        print(f"     = 約 {total_dates * len(self.symbols) * len(self.periods)} 次 API 呼叫")

        if dry_run:
            print("\n[模擬模式] 不實際發送 API 請求")
        else:
            print("\n開始抓取...\n")

        # 依序抓取
        for symbol in self.symbols:
            for period in self.periods:
                for date_from, date_to, label in time_ranges:
                    dates = self.get_trading_dates(date_from, date_to)
                    self.fetch_batch(symbol, period, dates, dry_run=dry_run)

        # 統計
        print("\n" + "="*60)
        print("抓取完成")
        print("="*60)
        print(f"✓ 新增: {self.stats['fetched']} 筆")
        print(f"⊘ 跳過: {self.stats['skipped']} 筆（已存在）")
        print(f"✗ 失敗: {self.stats['errors']} 筆")
        print(f"合計: {self.stats['total']} 筆")
        print(f"\n資料存放位置: {self.data_base_dir}")

    def close(self):
        """關閉連線"""
        self.client.close()


def main():
    """主函數"""
    parser = argparse.ArgumentParser(
        description="VP 資料批次抓取工具（支持斷點續跑）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
範例：
  python fetch_vp_data.py --symbol 2330.TW --dry-run    （模擬 2330.TW 的抓取）
  python fetch_vp_data.py --symbol 2330.TW              （實際抓取 2330.TW）
  python fetch_vp_data.py --all --dry-run              （模擬全部股票）
  python fetch_vp_data.py --all                        （實際抓取全部股票）
        """
    )
    parser.add_argument(
        "--symbol",
        type=str,
        default=None,
        help="指定股票代碼（格式：2330.TW），不指定則需加 --all 抓全部"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="抓取全部 5 檔股票"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模擬模式，不實際發送 API 請求"
    )

    args = parser.parse_args()

    # 驗證參數
    if not args.symbol and not args.all:
        parser.print_help()
        print("\n❌ 請指定 --symbol 或 --all")
        sys.exit(1)

    symbols = None
    if args.symbol:
        symbols = [args.symbol]
        print(f"📍 單股票模式: {args.symbol}\n")
    else:
        print(f"📍 全部股票模式\n")

    fetcher = VPDataFetcher(symbols=symbols)

    try:
        if args.dry_run:
            print("▶ 模擬模式\n")
        else:
            print("▶ 實際抓取模式\n")

        fetcher.run(dry_run=args.dry_run)

    except Exception as e:
        print(f"\n❌ 發生錯誤: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        fetcher.close()


if __name__ == "__main__":
    main()
