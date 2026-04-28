'use client';

import { StockData, PeriodName, PeriodAnalysis } from '../types';

export type DataPeriod = PeriodName | 'all';

interface Props {
  data: StockData;
  contentData: any;
  srData: any;
  period: DataPeriod;
  onPeriodChange: (p: DataPeriod) => void;
}

const TABS: { key: DataPeriod; label: string }[] = [
  { key: 'short',  label: '短期' },
  { key: 'medium', label: '中期' },
  { key: 'long',   label: '長期' },
  { key: 'all',    label: '全部' },
];

const PERIOD_TAG: Record<PeriodName, string> = {
  short: '短',
  medium: '中',
  long: '長',
};

const PERIOD_TAG_COLOR: Record<PeriodName, string> = {
  short: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  medium: 'bg-purple-100 text-purple-700 border border-purple-300',
  long: 'bg-blue-100 text-blue-700 border border-blue-300',
};

function buildLevels(
  periodData: PeriodAnalysis,
  period: PeriodName,
  contentData: any
): { price: number; labels: string[] }[] {
  const levelMap = new Map<number, Set<string>>();
  const usedLabels = new Set<string>();

  const addLevel = (price: number | null | undefined, label: string) => {
    if (!price || usedLabels.has(label)) return;
    const rounded = parseFloat(price.toFixed(2));
    if (!levelMap.has(rounded)) levelMap.set(rounded, new Set());
    levelMap.get(rounded)!.add(label);
    usedLabels.add(label);
  };

  if (periodData?.support) {
    const rounded = parseFloat(periodData.support.price.toFixed(2));
    if (!levelMap.has(rounded)) levelMap.set(rounded, new Set());
    levelMap.get(rounded)!.add(periodData.support.members?.[0] || '支撐');
    usedLabels.add(periodData.support.members?.[0] || '支撐');
  }
  if (periodData?.resistance) {
    const rounded = parseFloat(periodData.resistance.price.toFixed(2));
    if (!levelMap.has(rounded)) levelMap.set(rounded, new Set());
    levelMap.get(rounded)!.add(periodData.resistance.members?.[0] || '壓力');
    usedLabels.add(periodData.resistance.members?.[0] || '壓力');
  }

  const vp = periodData?.vp;
  const ma = contentData?.moving_averages;
  const bband = contentData?.bollinger_bands;
  const maChannel = contentData?.ma_channel;
  const calc = contentData?.calculated;
  const priceRange = contentData?.price_range;

  if (period === 'short') {
    addLevel(priceRange?.high_5d, '5日高點');
    addLevel(priceRange?.low_5d, '5日低點');
    addLevel(ma?.ma5, 'MA5');
    addLevel(ma?.ma10, 'MA10');
    addLevel(bband?.upper, 'BBand上限');
    addLevel(bband?.lower, 'BBand下限');
    addLevel(calc?.upper_gate, '上關');
    addLevel(calc?.lower_gate, '下關');
    addLevel(calc?.cdp_chase_buy, 'CDP追買');
    addLevel(calc?.cdp_sell, 'CDP賣出');
    addLevel(calc?.cdp_buy, 'CDP買進');
    addLevel(calc?.cdp_chase_sell, 'CDP追賣');
    addLevel(vp?.poc, 'POC');
    addLevel(vp?.vah, 'VAH');
    addLevel(vp?.val, 'VAL');
  } else if (period === 'medium') {
    addLevel(priceRange?.high_10d, '10日高點');
    addLevel(priceRange?.low_10d, '10日低點');
    addLevel(priceRange?.high_20d, '20日高點');
    addLevel(priceRange?.low_20d, '20日低點');
    addLevel(ma?.ma20, 'MA20');
    addLevel(ma?.ma60, 'MA60');
    addLevel(bband?.upper, 'BBand上限');
    addLevel(bband?.lower, 'BBand下限');
    addLevel(maChannel?.upper, 'MA軌道上限');
    addLevel(maChannel?.lower, 'MA軌道下限');
    addLevel(vp?.poc, 'POC');
    addLevel(vp?.vah, 'VAH');
    addLevel(vp?.val, 'VAL');
  } else if (period === 'long') {
    addLevel(priceRange?.high_240d, '240日高點');
    addLevel(priceRange?.low_240d, '240日低點');
    addLevel(ma?.ma120, 'MA120');
    addLevel(ma?.ma240, 'MA240');
    addLevel(vp?.poc, 'POC');
    addLevel(vp?.vah, 'VAH');
    addLevel(vp?.val, 'VAL');
  }

  return Array.from(levelMap.entries())
    .map(([price, labels]) => ({ price, labels: Array.from(labels) }))
    .sort((a, b) => b.price - a.price);
}

function LevelTable({
  levels,
  currentPrice,
  tag,
}: {
  levels: { price: number; labels: string[]; tag?: PeriodName }[];
  currentPrice: number;
  tag?: PeriodName;
}) {
  const resistances = levels.filter((l) => l.price > currentPrice);
  const supports = levels.filter((l) => l.price <= currentPrice);

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 壓力 */}
      <div>
        <div className="text-sm font-bold text-red-600 pb-1 mb-2 border-b-2 border-red-200">壓力</div>
        <div className="space-y-1">
          {resistances.length === 0 && (
            <div className="text-xs text-gray-400">無資料</div>
          )}
          {resistances.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-red-50 transition-colors group">
              <div className="flex items-center gap-2">
                {item.tag && (
                  <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${PERIOD_TAG_COLOR[item.tag]}`}>
                    {PERIOD_TAG[item.tag]}
                  </span>
                )}
                <span className="font-bold text-red-600 text-base tabular-nums">{item.price.toFixed(2)}</span>
              </div>
              <span className="text-xs text-red-400 text-right">{item.labels.join('、')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 支撐 */}
      <div>
        <div className="text-sm font-bold text-blue-600 pb-1 mb-2 border-b-2 border-blue-200">支撐</div>
        <div className="space-y-1">
          {supports.length === 0 && (
            <div className="text-xs text-gray-400">無資料</div>
          )}
          {supports.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-blue-50 transition-colors group">
              <div className="flex items-center gap-2">
                {item.tag && (
                  <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${PERIOD_TAG_COLOR[item.tag]}`}>
                    {PERIOD_TAG[item.tag]}
                  </span>
                )}
                <span className="font-bold text-blue-600 text-base tabular-nums">{item.price.toFixed(2)}</span>
              </div>
              <span className="text-xs text-blue-400 text-right">{item.labels.join('、')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SRDataPanel({ data, contentData, srData, period, onPeriodChange }: Props) {
  if (!data || !contentData) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        資料載入中…
      </div>
    );
  }

  const currentPrice = data.current_price;

  const renderContent = () => {
    if (period === 'all') {
      // 合併三個期別的所有水位
      const allLevels: { price: number; labels: string[]; tag: PeriodName }[] = [];

      (['short', 'medium', 'long'] as PeriodName[]).forEach((p) => {
        const pData = data.periods[p];
        if (!pData) return;
        const levels = buildLevels(pData, p, contentData);
        levels.forEach((l) => allLevels.push({ ...l, tag: p }));
      });

      // 合併相同價格（同一 tick 範圍內）
      const merged = new Map<string, { price: number; labels: string[]; tag: PeriodName }>();
      allLevels.forEach((item) => {
        const key = item.price.toFixed(2);
        if (!merged.has(key)) {
          merged.set(key, { ...item });
        } else {
          const existing = merged.get(key)!;
          existing.labels = [...new Set([...existing.labels, ...item.labels])];
        }
      });

      const sortedLevels = Array.from(merged.values()).sort((a, b) => b.price - a.price);
      return <LevelTable levels={sortedLevels} currentPrice={currentPrice} />;
    }

    const pData = data.periods[period];
    if (!pData) return <div className="text-xs text-gray-400">無資料</div>;

    const levels = buildLevels(pData, period, contentData);
    return <LevelTable levels={levels} currentPrice={currentPrice} />;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Sub-tabs */}
      <div className="flex bg-white border-b border-gray-200 px-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPeriodChange(key)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
              period === key
                ? key === 'all'
                  ? 'border-gray-800 text-gray-900'
                  : key === 'short'
                  ? 'border-yellow-500 text-yellow-700'
                  : key === 'medium'
                  ? 'border-purple-500 text-purple-700'
                  : 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
