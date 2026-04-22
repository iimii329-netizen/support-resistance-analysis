# -*- coding: utf-8 -*-
"""
支撐壓力線選取演算法 v2.0 回測框架 — 多股票適配版
"""
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field

# ========== 股票設定 ==========
@dataclass
class StockConfig:
    """多股票適配設定"""
    symbol: str          # e.g. "2317.TW"
    data_dir: str        # 股票資料夾路徑（絕對或相對）
    ohlcv_file: str      # OHLCV 檔名
    vp_split: bool       # True = 2330 格式（三個分開檔），False = 2317 格式（單一合併檔）
    vp_file: str         # VP 檔名（vp_period5.json 或 2317.TW_volume_profile...json）
    indicator_file: str  # indicator_data 檔名
    adx_file: str        # adx.json 檔名

# ========== 資料結構定義 ==========
@dataclass
class Line:
    """支撐/壓力線"""
    date: str
    price: float
    type: str  # 'support' or 'resistance'
    period: int  # 5, 20, 60
    layer: str  # 'L1', 'L2', 'L3'
    layer_sub: str = ''  # 'POC', 'VAH', 'VAL', 'Fractal', 'MA', etc.
    market_state: str = ''  # 'TREND_UP', 'TREND_DOWN', 'RANGE', 'UNKNOWN'

@dataclass
class LineValidity:
    """線條有效性結果"""
    line: Line
    touched_date: Optional[str] = None
    touched_price: float = 0.0
    is_valid: bool = False
    days_to_touch: int = -1
    ma_value_at_touch: float = 0.0
    validation_date: Optional[str] = None

# ========== 演算法實現 ==========
class SRAlgorithm:
    def __init__(self, config: StockConfig):
        self.config = config
        self.data_dir = config.data_dir
        self.ohlcv_df = None
        self.indicator_df = None
        self.vp_data = {5: {}, 20: {}, 60: {}}
        self.adx_data = None
        self.load_data()

    def load_data(self):
        """載入所有必要資料 — 支援多股票格式"""
        print(f"[載入資料] {self.config.symbol} OHLCV...")
        ohlcv_path = f'{self.data_dir}/{self.config.ohlcv_file}'
        with open(ohlcv_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
            self.ohlcv_df = pd.DataFrame(raw['data'])
            self.ohlcv_df['date'] = pd.to_datetime(self.ohlcv_df['date'], format='%Y%m%d')
            self.ohlcv_df = self.ohlcv_df.astype({
                'open': float, 'high': float, 'low': float, 'close': float, 'volume': float
            }).reset_index(drop=True)
            self.ohlcv_df.set_index('date', inplace=True)

        print("[載入資料] 指標資料...")
        ind_path = f'{self.data_dir}/{self.config.indicator_file}'
        with open(ind_path, 'r', encoding='utf-8') as f:
            ind = json.load(f)
            rows = []

            # 格式判定：2330 有 periods_data，2317 直接 data[]
            if 'periods_data' in ind:
                # 2330 v2 格式
                for period_data in ind['periods_data']:
                    for item in period_data['data']:
                        row = item['indicators']['indicator'].copy()
                        row['date_str'] = row['date']
                        rows.append(row)
            else:
                # 2317 格式：data 是陣列，每筆有 indicators.indicator
                for item in ind['data']:
                    row = item['indicators']['indicator'].copy()
                    row['date_str'] = row['date']
                    rows.append(row)

            self.indicator_df = pd.DataFrame(rows)
            self.indicator_df['date'] = pd.to_datetime(self.indicator_df['date'], format='%Y%m%d')
            self.indicator_df = self.indicator_df.sort_values('date').reset_index(drop=True)
            self.indicator_df.set_index('date', inplace=True)

        print("[載入資料] Volume Profile...")
        if self.config.vp_split:
            # 2330 格式：三個分開檔案
            for period in [5, 20, 60]:
                vp_path = f'{self.data_dir}/2330.TW-vp_period{period}.json'
                with open(vp_path, 'r', encoding='utf-8') as f:
                    self.vp_data[period] = json.load(f)
        else:
            # 2317 格式：單一檔案，內有 period_5/period_20/period_60
            vp_path = f'{self.data_dir}/{self.config.vp_file}'
            with open(vp_path, 'r', encoding='utf-8') as f:
                raw_vp = json.load(f)
                # raw_vp['data'] 是 {date: {period_5: {profile...}, period_20: {...}, ...}}
                for date_key, day_data in raw_vp['data'].items():
                    for period in [5, 20, 60]:
                        pkey = f'period_{period}'
                        if pkey in day_data and day_data[pkey] is not None and 'profile' in day_data[pkey]:
                            prof = day_data[pkey]['profile']
                            self.vp_data[period][date_key] = {
                                'poc': prof.get('poc'),
                                'vah': prof.get('vah'),
                                'val': prof.get('val')
                            }

        print("[載入資料] ADX...")
        adx_path = f'{self.data_dir}/{self.config.adx_file}'
        with open(adx_path, 'r', encoding='utf-8') as f:
            self.adx_data = json.load(f)

        print(f"[完成] {self.config.symbol} — {len(self.ohlcv_df)} 交易日")

    def get_bar_data(self, date_str: str) -> Optional[pd.Series]:
        """取得日期對應的 bar 資料"""
        try:
            date = pd.to_datetime(date_str, format='%Y%m%d')
            if date in self.ohlcv_df.index:
                return self.ohlcv_df.loc[date]
            return None
        except:
            return None

    def get_bar_index(self, date_str: str) -> int:
        """取得日期對應的位置 index（用於向前向後推算）"""
        try:
            date = pd.to_datetime(date_str, format='%Y%m%d')
            return self.ohlcv_df.index.get_loc(date) if date in self.ohlcv_df.index else -1
        except:
            return -1

    def get_adx_state(self, date_str: str) -> Dict:
        """判定市況 (RANGE/TREND_UP/TREND_DOWN/BREAKOUT)"""
        # 簡化版：根據 ADX > 25 判斷趨勢，根據 MA 判斷方向
        date = pd.to_datetime(date_str, format='%Y%m%d')
        if date not in self.indicator_df.index:
            return {'state': 'UNKNOWN', 'adx': None}

        row = self.indicator_df.loc[date]
        ma5 = row.get('ma5')
        ma20 = row.get('ma20')
        close = row.get('close')

        # 先判是否有趨勢資料（ADX）
        adx_idx = self.get_adx_index(date_str)
        if adx_idx < 0 or adx_idx >= len(self.adx_data['data']):
            state = 'RANGE'
            adx = None
        else:
            adx_row = self.adx_data['data'][adx_idx]
            adx = adx_row.get('adx')

            if adx is None or adx < 25:
                state = 'RANGE'
            elif close > ma5 > ma20:
                state = 'TREND_UP'
            elif close < ma5 < ma20:
                state = 'TREND_DOWN'
            else:
                state = 'RANGE'

        return {'state': state, 'adx': adx}

    def get_adx_index(self, date_str: str) -> int:
        """在 ADX 數據中找到日期的 index"""
        for i, item in enumerate(self.adx_data['data']):
            if item['date'] == date_str:
                return i
        return -1

    def get_vp_candidates(self, date_str: str, period: int) -> Dict[str, float]:
        """取得 VP 候選線 (POC, VAH, VAL)"""
        vp_dict = self.vp_data[period]
        if date_str in vp_dict:
            vp = vp_dict[date_str]
            return {
                'POC': vp.get('poc'),
                'VAH': vp.get('vah'),
                'VAL': vp.get('val')
            }
        return {'POC': None, 'VAH': None, 'VAL': None}

    def distance_check(self, candidate_price: float, current_price: float, period: int) -> bool:
        """檢查距離門檻"""
        if candidate_price is None or current_price is None:
            return False
        dist = abs(candidate_price - current_price) / current_price
        thresholds = {5: 0.05, 20: 0.10, 60: 0.18}
        return dist <= thresholds.get(period, 0.18)

    def get_l1_candidates(self, date_str: str, period: int) -> Tuple[Optional[float], Optional[float]]:
        """Layer 1 - Volume Profile"""
        date = pd.to_datetime(date_str, format='%Y%m%d')
        bar_data = self.get_bar_data(date_str)
        if bar_data is None:
            return None, None

        current_price = bar_data['close']
        state = self.get_adx_state(date_str)['state']
        vp = self.get_vp_candidates(date_str, period)

        # 根據市況決定優先指標
        r_cand = None
        s_cand = None

        if state == 'RANGE':
            r_cand = vp.get('VAH')
            s_cand = vp.get('VAL')
        elif state == 'TREND_UP':
            r_cand = vp.get('VAH')
            s_cand = vp.get('VAH')  # 前期 VAH（簡化版）
        elif state == 'TREND_DOWN':
            r_cand = vp.get('VAL')  # 前期 VAL（簡化版）
            s_cand = vp.get('VAL')

        # 距離篩選
        if r_cand and not self.distance_check(r_cand, current_price, period):
            r_cand = None
        if s_cand and not self.distance_check(s_cand, current_price, period):
            s_cand = None

        return r_cand, s_cand

    def get_l2_candidates(self, date_str: str, period: int) -> Tuple[Optional[float], Optional[float]]:
        """Layer 2 - Fractal (簡化版：取近期高低)"""
        bar_data = self.get_bar_data(date_str)
        if bar_data is None:
            return None, None

        current_price = bar_data['close']
        idx = self.get_bar_index(date_str)
        if idx < 0:
            return None, None

        n_lookback = {5: 2, 20: 3, 60: 5}.get(period, 3)

        # 簡化：取過去 n 根 K 棒的高低
        start_idx = max(0, idx - n_lookback)
        highs = self.ohlcv_df.iloc[start_idx:idx]['high'].max()
        lows = self.ohlcv_df.iloc[start_idx:idx]['low'].min()

        r_cand = highs if self.distance_check(highs, current_price, period) else None
        s_cand = lows if self.distance_check(lows, current_price, period) else None

        return r_cand, s_cand

    def get_l3_candidates(self, date_str: str, period: int) -> Tuple[float, float]:
        """Layer 3 - Moving Average (必有結果)"""
        date = pd.to_datetime(date_str, format='%Y%m%d')
        if date not in self.indicator_df.index:
            return None, None

        row = self.indicator_df.loc[date]
        current_price = row['close']

        ma_params = {5: ('ma5', 'ma10'), 20: ('ma20', 'ma60'), 60: ('ma60', 'ma120')}
        ma_names = ma_params.get(period, ('ma20', 'ma60'))

        mas = [row.get(name) for name in ma_names if name in row and pd.notna(row[name])]

        mas_above = [m for m in mas if m > current_price]
        mas_below = [m for m in mas if m < current_price]

        r_cand = min(mas_above) if mas_above else None
        s_cand = max(mas_below) if mas_below else None

        # 備用：整數關卡
        precision = {5: 1, 20: 5, 60: 10}.get(period, 5)
        if r_cand is None:
            r_cand = np.ceil(current_price / precision) * precision
        if s_cand is None:
            s_cand = np.floor(current_price / precision) * precision

        return r_cand, s_cand

    def _select_support(self, date_str: str, period: int, state: str) -> Tuple[Optional[float], str, str]:
        """支撐線獨立選層：按市況決定 L1/L2/L3 優先順序

        Returns:
            (price, layer, layer_sub) — 價格、層級、子類型；若無則返回 (None, None, None)
        """
        if state == 'TREND_UP':
            # 多頭：優先 L1（VAH 成地板）→ L2 → L3
            r_l1, s_l1 = self.get_l1_candidates(date_str, period)
            if s_l1 is not None:
                return s_l1, 'L1', 'VP'

            r_l2, s_l2 = self.get_l2_candidates(date_str, period)
            if s_l2 is not None:
                return s_l2, 'L2', 'Fractal'

        elif state == 'TREND_DOWN':
            # 空頭：優先 L2（Fractal 低點）→ L3 → L1（備用）
            r_l2, s_l2 = self.get_l2_candidates(date_str, period)
            if s_l2 is not None:
                return s_l2, 'L2', 'Fractal'

        else:  # RANGE 或 UNKNOWN
            # 盤整：優先 L1（VAL）→ L2 → L3
            r_l1, s_l1 = self.get_l1_candidates(date_str, period)
            if s_l1 is not None:
                return s_l1, 'L1', 'VP'

            r_l2, s_l2 = self.get_l2_candidates(date_str, period)
            if s_l2 is not None:
                return s_l2, 'L2', 'Fractal'

        # 最後兜底：L3（永遠有值）
        r_l3, s_l3 = self.get_l3_candidates(date_str, period)
        if s_l3 is not None:
            return s_l3, 'L3', 'MA'

        return None, None, None

    def _select_resistance(self, date_str: str, period: int, state: str) -> Tuple[Optional[float], str, str]:
        """壓力線獨立選層：按市況決定 L1/L2/L3 優先順序

        Returns:
            (price, layer, layer_sub) — 價格、層級、子類型；若無則返回 (None, None, None)
        """
        if state == 'TREND_UP':
            # 多頭：優先 L2（Fractal 高點）→ L3 → L1（備用）
            # 為了避免支撐和壓力同價，多頭不優先用 L1 VP-VAH
            r_l2, s_l2 = self.get_l2_candidates(date_str, period)
            if r_l2 is not None:
                return r_l2, 'L2', 'Fractal'

        elif state == 'TREND_DOWN':
            # 空頭：優先 L1（VAL 成天花板）→ L2 → L3
            r_l1, s_l1 = self.get_l1_candidates(date_str, period)
            if r_l1 is not None:
                return r_l1, 'L1', 'VP'

            r_l2, s_l2 = self.get_l2_candidates(date_str, period)
            if r_l2 is not None:
                return r_l2, 'L2', 'Fractal'

        else:  # RANGE 或 UNKNOWN
            # 盤整：優先 L1（VAH）→ L2 → L3
            r_l1, s_l1 = self.get_l1_candidates(date_str, period)
            if r_l1 is not None:
                return r_l1, 'L1', 'VP'

            r_l2, s_l2 = self.get_l2_candidates(date_str, period)
            if r_l2 is not None:
                return r_l2, 'L2', 'Fractal'

        # 最後兜底：L3（永遠有值）
        r_l3, s_l3 = self.get_l3_candidates(date_str, period)
        if r_l3 is not None:
            return r_l3, 'L3', 'MA'

        return None, None, None

    def get_support_resistance(self, date_str: str, period: int) -> Tuple[Optional[Line], Optional[Line]]:
        """取得當日的支撐壓力線 — 市況感知的獨立選層版本 (v2.1)"""
        idx = self.get_bar_index(date_str)
        if idx < 0:
            return None, None

        state = self.get_adx_state(date_str)['state']

        # 支撐和壓力獨立選層
        support_price, support_layer, support_sub = self._select_support(date_str, period, state)
        resist_price, resist_layer, resist_sub = self._select_resistance(date_str, period, state)

        support_line = None
        resist_line = None

        if support_price is not None:
            support_line = Line(date_str, support_price, 'support', period, support_layer, support_sub, state)

        if resist_price is not None:
            resist_line = Line(date_str, resist_price, 'resistance', period, resist_layer, resist_sub, state)

        # 永遠同時返回兩條線（透過 L3 的必有值保證）
        return support_line, resist_line

    def check_line_validity(self, line: Line) -> LineValidity:
        """檢查線條有效性 — 兩階段：① 觸線日 ② 確認日"""
        date = pd.to_datetime(line.date, format='%Y%m%d')
        if date not in self.indicator_df.index:
            return LineValidity(line, is_valid=False)

        windows = {'5': 2, '20': 5, '60': 10}
        thresholds = {'5': 0.015, '20': 0.025, '60': 0.03 if line.type == 'support' else 0.035}

        period_str = str(line.period)
        window = windows.get(period_str, 5)
        threshold = thresholds.get(period_str, 0.025)

        # 取得觸碰當天的均線基準
        ma_names = {'5': 'ma5', '20': 'ma20', '60': 'ma60'}
        ma_name = ma_names.get(period_str, 'ma20')
        ma_base = self.indicator_df.loc[date].get(ma_name)

        if ma_base is None:
            return LineValidity(line, is_valid=False)

        idx = self.get_bar_index(line.date)
        if idx < 0:
            return LineValidity(line, is_valid=False)

        # 第一階段：掃描 window 天內的觸線日
        touch_idx = None
        touch_date = None
        touch_price = None

        for offset in range(1, window + 1):
            future_idx = idx + offset
            if future_idx >= len(self.ohlcv_df):
                break

            future_row = self.ohlcv_df.iloc[future_idx]

            if line.type == 'support':
                # 支撐：最低價觸線
                if future_row['low'] <= line.price * 1.005:
                    touch_idx = future_idx
                    touch_date = self.ohlcv_df.index[future_idx].strftime('%Y%m%d')
                    touch_price = future_row['low']
                    break
            else:  # resistance
                # 壓力：最高價觸線
                if future_row['high'] >= line.price * 0.995:
                    touch_idx = future_idx
                    touch_date = self.ohlcv_df.index[future_idx].strftime('%Y%m%d')
                    touch_price = future_row['high']
                    break

        # 第二階段：從觸線日起，掃描 window 天內的收盤確認
        if touch_idx is not None:
            target_ma = ma_base * (1 + threshold) if line.type == 'support' else ma_base * (1 - threshold)

            for confirm_offset in range(0, window + 1):
                confirm_idx = touch_idx + confirm_offset
                if confirm_idx >= len(self.ohlcv_df):
                    break

                confirm_row = self.ohlcv_df.iloc[confirm_idx]
                future_close = confirm_row['close']
                confirm_date = self.ohlcv_df.index[confirm_idx].strftime('%Y%m%d')

                if line.type == 'support':
                    # 支撐有效：收盤站上 MA×(1+threshold)
                    if future_close >= target_ma:
                        return LineValidity(
                            line,
                            touched_date=touch_date,
                            touched_price=touch_price,
                            is_valid=True,
                            days_to_touch=touch_idx - idx,
                            ma_value_at_touch=ma_base,
                            validation_date=confirm_date
                        )
                else:  # resistance
                    # 壓力有效：收盤跌破 MA×(1-threshold)
                    if future_close <= target_ma:
                        return LineValidity(
                            line,
                            touched_date=touch_date,
                            touched_price=touch_price,
                            is_valid=True,
                            days_to_touch=touch_idx - idx,
                            ma_value_at_touch=ma_base,
                            validation_date=confirm_date
                        )

        return LineValidity(line, is_valid=False)

# ========== 主程式 ==========
def main(symbol: str = "2317.TW", test_days: int = 150):
    """回測入口

    Args:
        symbol: 股票代號（2330.TW 或 2317.TW）
        test_days: 測試天數
    """
    base_dir = r'c:\Users\millychou\Desktop\【專案】[AI Inside]技術分析\[Claude]AI Inside技術分析\商品盤勢新增圖片20260428\DATA'

    # 根據 symbol 選擇設定
    if symbol == "2330.TW":
        config = StockConfig(
            symbol="2330.TW",
            data_dir=f"{base_dir}/2330.TW",
            ohlcv_file="2330.tw-OHLCV-20250101-20260417.txt",
            vp_split=True,
            vp_file="2330.TW-vp_period5.json",  # 實際用三個分開檔，此為示意
            indicator_file="2330.TW-indicator_data_v2.json",
            adx_file="2330_TW-adx.json"
        )
    elif symbol == "2317.TW":
        config = StockConfig(
            symbol="2317.TW",
            data_dir=f"{base_dir}/2317.TW",
            ohlcv_file="2317.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="2317.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_2317.json",
            adx_file="2317_TW-adx.json"
        )
    elif symbol == "2382.TW":
        config = StockConfig(
            symbol="2382.TW",
            data_dir=f"{base_dir}/2382.TW",
            ohlcv_file="2382.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="2382.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_2382.json",
            adx_file="2382_TW-adx.json"
        )
    elif symbol == "2454.TW":
        config = StockConfig(
            symbol="2454.TW",
            data_dir=f"{base_dir}/2454.TW",
            ohlcv_file="2454.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="2454.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_2454.json",
            adx_file="2454_TW-adx.json"
        )
    elif symbol == "2412.TW":
        config = StockConfig(
            symbol="2412.TW",
            data_dir=f"{base_dir}/2412.TW",
            ohlcv_file="2412.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="2412.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_2412.json",
            adx_file="2412_TW-adx.json"
        )
    elif symbol == "1402.TW":
        config = StockConfig(
            symbol="1402.TW",
            data_dir=f"{base_dir}/1402.TW",
            ohlcv_file="1402.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="1402.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_1402.json",
            adx_file="1402_TW-adx.json"
        )
    elif symbol == "2408.TW":
        config = StockConfig(
            symbol="2408.TW",
            data_dir=f"{base_dir}/2408.TW",
            ohlcv_file="2408.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="2408.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_2408.json",
            adx_file="2408_TW-adx.json"
        )
    elif symbol == "2887.TW":
        config = StockConfig(
            symbol="2887.TW",
            data_dir=f"{base_dir}/2887.TW",
            ohlcv_file="2887.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="2887.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_2887.json",
            adx_file="2887_TW-adx.json"
        )
    elif symbol == "1301.TW":
        config = StockConfig(
            symbol="1301.TW",
            data_dir=f"{base_dir}/1301.TW",
            ohlcv_file="1301.TW-OHLCV-20250101-20260420.txt",
            vp_split=False,
            vp_file="1301.TW_volume_profile_20250101_20260420.json",
            indicator_file="indicator_data_1301.json",
            adx_file="1301_TW-adx.json"
        )
    else:
        raise ValueError(f"不支援的股票：{symbol}")

    algo = SRAlgorithm(config)

    print("\n" + "="*80)
    print("開始回測...")
    print("="*80 + "\n")

    results = {
        'all_lines': [],
        'validity_results': [],
        'stats_by_period': {},
        'stats_by_layer': {},
        'stats_by_type': {}
    }

    dates = algo.ohlcv_df.index[:test_days]  # 測試指定天數

    for date_obj in dates:
        date_str = date_obj.strftime('%Y%m%d')

        for period in [5, 20, 60]:
            support, resistance = algo.get_support_resistance(date_str, period)

            if support:
                results['all_lines'].append(support)
                validity_s = algo.check_line_validity(support)
                results['validity_results'].append(validity_s)

            if resistance:
                results['all_lines'].append(resistance)
                validity_r = algo.check_line_validity(resistance)
                results['validity_results'].append(validity_r)

    # ── 統計函式 ──
    def calc_stat(subset):
        total = len(subset)
        if total == 0:
            return None
        valid = sum(1 for v in subset if v.is_valid)
        return {'total': total, 'valid': valid, 'rate': round(valid / total * 100, 1)}

    vr = results['validity_results']

    # 按週期
    for period in [5, 20, 60]:
        results['stats_by_period'][period] = calc_stat(
            [v for v in vr if v.line.period == period])

    # 按層級
    for layer in ['L1', 'L2', 'L3']:
        results['stats_by_layer'][layer] = calc_stat(
            [v for v in vr if v.line.layer == layer])

    # 按線條類型
    for line_type in ['support', 'resistance']:
        results['stats_by_type'][line_type] = calc_stat(
            [v for v in vr if v.line.type == line_type])

    # 按市況（路徑A — 核心新增維度）
    states = ['TREND_UP', 'TREND_DOWN', 'RANGE', 'UNKNOWN']
    stats_by_state = {}
    for state in states:
        subset = [v for v in vr if v.line.market_state == state]
        if subset:
            stat = calc_stat(subset)
            # 再細分支撐/壓力
            stat['support'] = calc_stat([v for v in subset if v.line.type == 'support'])
            stat['resistance'] = calc_stat([v for v in subset if v.line.type == 'resistance'])
            stats_by_state[state] = stat

    # 週期 × 類型 × 市況 三維交叉
    cross_stats = {}
    for period in [5, 20, 60]:
        cross_stats[period] = {}
        for state in states:
            cross_stats[period][state] = {
                'support': calc_stat([v for v in vr
                    if v.line.period == period and v.line.market_state == state
                    and v.line.type == 'support']),
                'resistance': calc_stat([v for v in vr
                    if v.line.period == period and v.line.market_state == state
                    and v.line.type == 'resistance'])
            }

    overall_valid = sum(1 for v in vr if v.is_valid)
    overall_total = len(vr)
    overall_rate = round(overall_valid / overall_total * 100, 1) if overall_total > 0 else 0

    # ── 印出結果 ──
    sep = "-" * 60
    print(sep)
    print("【整體】")
    print(f"  有效率 = {overall_valid}/{overall_total} ({overall_rate}%)")

    print(sep)
    print("【按週期】")
    for period in [5, 20, 60]:
        s = results['stats_by_period'][period]
        if s:
            print(f"  {period}日 = {s['valid']}/{s['total']} ({s['rate']}%)")

    print(sep)
    print("【按層級】")
    for layer in ['L1', 'L2', 'L3']:
        s = results['stats_by_layer'][layer]
        if s:
            print(f"  {layer} = {s['valid']}/{s['total']} ({s['rate']}%)")

    print(sep)
    print("【按線條類型】")
    for line_type, label in [('support', '支撐'), ('resistance', '壓力')]:
        s = results['stats_by_type'][line_type]
        if s:
            print(f"  {label} = {s['valid']}/{s['total']} ({s['rate']}%)")

    print(sep)
    print("【按市況分組 — 路徑A 核心結果】")
    state_labels = {'TREND_UP': '多頭', 'TREND_DOWN': '空頭', 'RANGE': '盤整', 'UNKNOWN': '未知'}
    for state in states:
        if state not in stats_by_state:
            continue
        s = stats_by_state[state]
        label = state_labels.get(state, state)
        print(f"\n  [{label}] 整體 = {s['valid']}/{s['total']} ({s['rate']}%)")
        if s['support']:
            ss = s['support']
            print(f"    支撐 = {ss['valid']}/{ss['total']} ({ss['rate']}%)")
        if s['resistance']:
            sr = s['resistance']
            print(f"    壓力 = {sr['valid']}/{sr['total']} ({sr['rate']}%)")

    print(sep)
    print("【週期 × 市況 × 類型 交叉】")
    for period in [5, 20, 60]:
        print(f"\n  {period}日週期：")
        for state in states:
            if state not in stats_by_state:
                continue
            label = state_labels.get(state, state)
            cs = cross_stats[period][state]
            sup = cs['support']
            res = cs['resistance']
            sup_str = f"{sup['valid']}/{sup['total']}({sup['rate']}%)" if sup else "N/A"
            res_str = f"{res['valid']}/{res['total']}({res['rate']}%)" if res else "N/A"
            print(f"    {label}: 支撐={sup_str}  壓力={res_str}")

    # ── 保存結果 ──
    output = {
        'symbol': symbol,
        'test_days': test_days,
        'overall': {'valid': overall_valid, 'total': overall_total, 'rate': overall_rate},
        'stats_by_period': results['stats_by_period'],
        'stats_by_layer': results['stats_by_layer'],
        'stats_by_type': results['stats_by_type'],
        'stats_by_market_state': stats_by_state,
        'cross_stats': cross_stats
    }

    # 輸出檔名
    symbol_short = symbol.replace('.', '_').replace('TW', '')
    output_file = f'{base_dir}/{symbol_short}-backtest_results_v2.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n結果已保存至 {output_file}")

if __name__ == '__main__':
    import sys
    symbol = sys.argv[1] if len(sys.argv) > 1 else "2317.TW"
    test_days = int(sys.argv[2]) if len(sys.argv) > 2 else 150
    main(symbol=symbol, test_days=test_days)
