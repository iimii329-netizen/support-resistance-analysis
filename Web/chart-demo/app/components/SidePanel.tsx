'use client';

import { StockData, PeriodName, PeriodAnalysis } from '../types';

interface Props {
  data: StockData;
  periodData: PeriodAnalysis;
  open: boolean;
  period: PeriodName;
  onToggle: () => void;
  onPeriodChange: (p: PeriodName) => void;
  contentData?: any;
  srData?: any;
}

const PERIOD_LABELS: Record<PeriodName, string> = {
  short:  '短期',
  medium: '中期',
  long:   '長期',
};

export default function SidePanel({ data, periodData, open, period, onToggle, onPeriodChange, contentData, srData }: Props) {
  const renderContent = () => {
    if (!periodData || !contentData || !data.periods) {
      return (
        <div className="text-xs text-gray-400 text-center py-4">
          數據加載中…
        </div>
      );
    }

    const currentPrice = data.current_price;
    const allPeriods = data.periods as any;

    // 使用 Map 儲存同價格的多個標籤
    const levelMap: Map<number, Set<string>> = new Map();

    // 記錄已添加的標籤名稱（避免重複添加 VAH、POC、VAL）
    const usedLabels = new Set<string>();

    // 添加該時間框架的support和resistance
    if (periodData.support) {
      const roundedPrice = parseFloat(periodData.support.price.toFixed(2));
      if (!levelMap.has(roundedPrice)) levelMap.set(roundedPrice, new Set());
      const label = periodData.support.members[0] || '支撐';
      levelMap.get(roundedPrice)!.add(label);
      usedLabels.add(label);
    }
    if (periodData.resistance) {
      const roundedPrice = parseFloat(periodData.resistance.price.toFixed(2));
      if (!levelMap.has(roundedPrice)) levelMap.set(roundedPrice, new Set());
      const label = periodData.resistance.members[0] || '壓力';
      levelMap.get(roundedPrice)!.add(label);
      usedLabels.add(label);
    }

    const vp = allPeriods[period]?.vp;
    const ma = contentData.moving_averages;
    const bband = contentData.bollinger_bands;
    const maChannel = contentData.ma_channel;
    const calc = contentData.calculated;
    const priceRange = contentData.price_range;

    // ========== 短期指標 (日線/5日) ==========
    if (period === 'short') {
      const addLevel = (price: number, label: string) => {
        if (usedLabels.has(label)) return;
        const roundedPrice = parseFloat(price.toFixed(2));
        if (!levelMap.has(roundedPrice)) levelMap.set(roundedPrice, new Set());
        levelMap.get(roundedPrice)!.add(label);
      };

      const ma = contentData.moving_averages;
      const bband = contentData.bollinger_bands;
      const maChannel = contentData.ma_channel;
      const calc = contentData.calculated;
      const priceRange = contentData.price_range;

      // 價格區間
      if (priceRange?.high_5d) addLevel(priceRange.high_5d, '5日高點');
      if (priceRange?.low_5d) addLevel(priceRange.low_5d, '5日低點');

      // 移動平均線
      if (ma?.ma5) addLevel(ma.ma5, 'MA5');
      if (ma?.ma10) addLevel(ma.ma10, 'MA10');

      // 布林帶
      if (bband?.upper) addLevel(bband.upper, 'BBand上限');
      if (bband?.lower) addLevel(bband.lower, 'BBand下限');

      // CDP點位（日線級別）
      if (calc?.upper_gate) addLevel(calc.upper_gate, '上關');
      if (calc?.lower_gate) addLevel(calc.lower_gate, '下關');
      if (calc?.cdp_chase_buy) addLevel(calc.cdp_chase_buy, 'CDP追買');
      if (calc?.cdp_sell) addLevel(calc.cdp_sell, 'CDP賣出');
      if (calc?.cdp_buy) addLevel(calc.cdp_buy, 'CDP買進');
      if (calc?.cdp_chase_sell) addLevel(calc.cdp_chase_sell, 'CDP追賣');

      // VP數據
      if (vp?.poc) addLevel(vp.poc, 'POC');
      if (vp?.vah) addLevel(vp.vah, 'VAH');
      if (vp?.val) addLevel(vp.val, 'VAL');
    }

    // ========== 中期指標 (10-20日) ==========
    else if (period === 'medium') {
      const addLevel = (price: number, label: string) => {
        if (usedLabels.has(label)) return;
        const roundedPrice = parseFloat(price.toFixed(2));
        if (!levelMap.has(roundedPrice)) levelMap.set(roundedPrice, new Set());
        levelMap.get(roundedPrice)!.add(label);
      };

      const ma = contentData.moving_averages;
      const bband = contentData.bollinger_bands;
      const maChannel = contentData.ma_channel;
      const calc = contentData.calculated;
      const priceRange = contentData.price_range;

      // 價格區間
      if (priceRange?.high_10d) addLevel(priceRange.high_10d, '10日高點');
      if (priceRange?.low_10d) addLevel(priceRange.low_10d, '10日低點');
      if (priceRange?.high_20d) addLevel(priceRange.high_20d, '20日高點');
      if (priceRange?.low_20d) addLevel(priceRange.low_20d, '20日低點');

      // 移動平均線
      if (ma?.ma20) addLevel(ma.ma20, 'MA20');
      if (ma?.ma60) addLevel(ma.ma60, 'MA60');

      // 布林帶
      if (bband?.upper) addLevel(bband.upper, 'BBand上限');
      if (bband?.lower) addLevel(bband.lower, 'BBand下限');

      // MA軌道
      if (maChannel?.upper) addLevel(maChannel.upper, 'MA軌道上限');
      if (maChannel?.lower) addLevel(maChannel.lower, 'MA軌道下限');

      // VP數據
      if (vp?.poc) addLevel(vp.poc, 'POC');
      if (vp?.vah) addLevel(vp.vah, 'VAH');
      if (vp?.val) addLevel(vp.val, 'VAL');
    }

    // ========== 長期指標 (60日+) ==========
    else if (period === 'long') {
      const addLevel = (price: number, label: string) => {
        if (usedLabels.has(label)) return;
        const roundedPrice = parseFloat(price.toFixed(2));
        if (!levelMap.has(roundedPrice)) levelMap.set(roundedPrice, new Set());
        levelMap.get(roundedPrice)!.add(label);
      };

      const ma = contentData.moving_averages;
      const bband = contentData.bollinger_bands;
      const calc = contentData.calculated;
      const priceRange = contentData.price_range;

      // 價格區間
      if (priceRange?.high_240d) addLevel(priceRange.high_240d, '240日高點');
      if (priceRange?.low_240d) addLevel(priceRange.low_240d, '240日低點');

      // 移動平均線
      if (ma?.ma120) addLevel(ma.ma120, 'MA120');
      if (ma?.ma240) addLevel(ma.ma240, 'MA240');

      // VP數據
      if (vp?.poc) addLevel(vp.poc, 'POC');
      if (vp?.vah) addLevel(vp.vah, 'VAH');
      if (vp?.val) addLevel(vp.val, 'VAL');
    }

    // 轉換 Map 為陣列並排序
    const allLevels = Array.from(levelMap.entries())
      .map(([price, labels]) => ({ price, labels: Array.from(labels) }))
      .sort((a, b) => b.price - a.price);

    // 分離壓力和支撐
    const resistances = allLevels.filter((l) => l.price > currentPrice);
    const supports = allLevels.filter((l) => l.price < currentPrice);

    return (
      <div className="space-y-3 h-full overflow-y-auto pr-2">
        {/* 壓力 */}
        {resistances.length > 0 && (
          <>
            <div className="font-bold text-red-600 text-base py-1 border-b-2 border-red-300">壓力</div>
            <div className="space-y-1">
              {resistances.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center hover:bg-red-50 px-1 py-1 rounded transition-colors">
                  <span className="text-red-600 font-semibold">{item.price.toFixed(2)}</span>
                  <span className="text-red-600 text-xs">{item.labels.join(', ')}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 支撐 */}
        {supports.length > 0 && (
          <>
            <div className="font-bold text-blue-600 text-base py-1 border-b-2 border-blue-300 mt-3">支撐</div>
            <div className="space-y-1">
              {supports.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center hover:bg-blue-50 px-1 py-1 rounded transition-colors">
                  <span className="text-blue-600 font-semibold">{item.price.toFixed(2)}</span>
                  <span className="text-blue-600 text-xs">{item.labels.join(', ')}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex">
      {/* 收合切換按鈕 */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-5 bg-gray-100 hover:bg-gray-200 border-l border-gray-200 transition-colors"
        title={open ? '收合' : '展開'}
      >
        <span className="text-gray-400 text-xs font-bold">{open ? '▶' : '◀'}</span>
      </button>

      {/* 面板本體 */}
      {open && (
        <div className="w-72 flex flex-col border-l border-gray-200 bg-white overflow-hidden">

          {/* Period tabs */}
          <div className="flex border-b-2 border-gray-300 bg-gray-50">
            {(['short', 'medium', 'long'] as PeriodName[]).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${
                  period === p
                    ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* 內容 */}
          <div className="flex-1 px-3 py-3 overflow-y-auto min-h-0">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}
