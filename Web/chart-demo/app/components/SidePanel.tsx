'use client';

import { StockData, PeriodName, PeriodAnalysis, Band } from '../types';

interface Props {
  data: StockData;
  periodData: PeriodAnalysis;
  open: boolean;
  period: PeriodName;
  onToggle: () => void;
  onPeriodChange: (p: PeriodName) => void;
}

const PERIOD_LABELS: Record<PeriodName, string> = {
  short:  '短期',
  medium: '中期',
  long:   '長期',
};

// 距離顯示（帶方向符號）
function distLabel(pct: number): string {
  const sign = pct >= 0 ? '▲' : '▼';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

// 單條支撐/壓力卡片
function BandCard({
  band,
  type,
  currentPrice,
}: {
  band: Band;
  type: 'support' | 'resistance';
  currentPrice: number;
}) {
  const isSupport  = type === 'support';
  const labelPrice = band.price;
  const displayPrice = band.display || band.price.toString();

  const priceDiff = Number((labelPrice - currentPrice).toFixed(4));

  return (
    <div className={[
      'rounded border p-3 mb-2',
      isSupport
        ? 'border-blue-200 bg-blue-50'
        : 'border-red-200 bg-red-50',
    ].join(' ')}>

      {/* 標題列 */}
      <div className="flex items-center gap-2 mb-1">
        <span className={[
          'text-xs font-semibold px-1.5 py-0.5 rounded',
          isSupport
            ? 'bg-blue-600 text-white'
            : 'bg-red-500 text-white',
        ].join(' ')}>
          {isSupport ? '支撐' : '壓力'}
        </span>
        <span className={[
          'text-lg font-bold',
          isSupport ? 'text-blue-700' : 'text-red-600',
        ].join(' ')}>
          {displayPrice}
        </span>
      </div>

      {/* 差價 */}
      <div className="text-xs text-gray-500 mb-2 font-medium">
        距現價 {priceDiff >= 0 ? '+' : ''}{priceDiff} 元（{distLabel(band.distance_pct)}）
      </div>

      {/* AI 摘要 */}
      {band.summary && (
        <div className="text-xs text-gray-700 bg-white rounded px-2 py-1.5 mb-2 leading-relaxed border border-gray-100">
          {band.summary}
        </div>
      )}

      {/* 成員指標 */}
      <div className="flex flex-wrap items-center gap-1 mt-1">
        <span className="text-xs text-gray-500 font-medium mr-1">
          {band.members.length > 1 ? '共振指標' : '單一指標'}
        </span>
        {band.members.map((m) => (
          <span
            key={m}
            className="text-xs px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600"
          >
            {m}
          </span>
        ))}
      </div>

      {/* 區間說明（若有）*/}
      {band.range_low !== undefined && band.range_high !== undefined
        && band.range_low !== band.range_high && (
        <div className="text-xs text-gray-400 mt-1.5">
          共振區間 {band.range_low.toLocaleString()} ~ {band.range_high.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// 全部候選關卡（收折區塊）
function AllBandsSection({ bands, type }: { bands: Band[]; type: 'support' | 'resistance' }) {
  if (bands.length <= 1) return null;
  const isSupport = type === 'support';

  return (
    <details className="mt-1 mb-3">
      <summary className={[
        'text-xs cursor-pointer select-none',
        isSupport ? 'text-blue-500' : 'text-red-400',
      ].join(' ')}>
        其他{isSupport ? '支撐' : '壓力'}關卡（{bands.length - 1} 個）
      </summary>
      <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-100">
        {bands.slice(1).map((b, i) => (
          <div key={i} className="flex items-start justify-between text-xs py-1 gap-2">
            <span className="text-gray-700 font-medium whitespace-nowrap mt-0.5">
              {b.display || b.price.toString()}
            </span>
            <span className="text-gray-500 text-left flex-1 break-words leading-relaxed">
              {b.members.join('、')}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function SidePanel({ data, periodData, open, period, onToggle, onPeriodChange }: Props) {
  const analysis: PeriodAnalysis = periodData;

  return (
    <div className="flex">
      {/* 收合切換按鈕 */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-5 bg-gray-100 hover:bg-gray-200
                   border-l border-gray-200 transition-colors"
        title={open ? '收合' : '展開'}
      >
        <span className="text-gray-400 text-xs">{open ? '▶' : '◀'}</span>
      </button>

      {/* 面板本體 */}
      {open && (
        <div className="w-64 flex flex-col border-l border-gray-200 bg-white overflow-y-auto"
             style={{ maxHeight: '440px' }}>

          {/* Period tabs */}
          <div className="flex border-b border-gray-200">
            {(Object.keys(PERIOD_LABELS) as PeriodName[]).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={[
                  'flex-1 py-2 text-xs font-medium transition-colors',
                  period === p
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* 內容 */}
          <div className="flex-1 p-3">
            {/* 壓力 */}
            {analysis.resistance ? (
              <BandCard
                band={analysis.resistance}
                type="resistance"
                currentPrice={data.current_price}
              />
            ) : (
              <div className="text-xs text-gray-400 text-center py-3">暫無明顯壓力位</div>
            )}

            {/* 其他候選 - 壓力 */}
            <AllBandsSection bands={analysis.all_resistance} type="resistance" />

            {/* 支撐 */}
            {analysis.support ? (
              <BandCard
                band={analysis.support}
                type="support"
                currentPrice={data.current_price}
              />
            ) : (
              <div className="text-xs text-gray-400 text-center py-3">暫無明顯支撐位</div>
            )}

            {/* 其他候選 - 支撐 */}
            <AllBandsSection bands={analysis.all_support}    type="support"    />
          </div>
        </div>
      )}
    </div>
  );
}
