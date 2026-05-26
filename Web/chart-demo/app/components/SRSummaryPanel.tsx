'use client';

import { useState } from 'react';
import { SRSummaryData, SRKeyLevel, SRIndicator } from '../types';

interface Props {
  data: SRSummaryData | null;
}

const PERIOD_LABELS: Record<string, string> = {
  short:  '短期 (5日)',
  medium: '中期 (20日)',
  long:   '長期 (60日)',
};

const LAYER_STYLE: Record<string, string> = {
  L1: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  L2: 'bg-gray-100  text-gray-600   border border-gray-300',
  L3: 'bg-blue-50   text-blue-600   border border-blue-200',
};

function DistBadge({ pct, isResistance }: { pct: number; isResistance: boolean }) {
  const color = isResistance ? 'text-red-600' : 'text-blue-600';
  const sign  = pct > 0 ? '+' : '';
  return (
    <span className={`font-mono text-sm font-semibold ${color}`}>
      {sign}{pct.toFixed(2)}%
    </span>
  );
}

function HitrateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-400">—</span>;
  const cls = rate >= 70
    ? 'text-green-700 font-bold'
    : 'text-gray-500';
  return <span className={cls}>{rate.toFixed(1)}%</span>;
}

function IndicatorTable({ indicators }: { indicators: SRIndicator[] }) {
  return (
    <table className="w-full text-sm border-collapse mt-2">
      <thead>
        <tr className="text-xs text-gray-500 border-b border-gray-100">
          <th className="text-left py-1 pl-2 font-medium">指標</th>
          <th className="text-right py-1 font-medium">數值</th>
          <th className="text-right py-1 font-medium">距現價</th>
          <th className="text-right py-1 pr-2 font-medium">命中率</th>
        </tr>
      </thead>
      <tbody>
        {indicators.map((item, i) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
            <td className="py-1.5 pl-2 text-gray-700">{item.name}</td>
            <td className="py-1.5 text-right font-mono text-gray-800">
              {item.value !== null ? item.value.toLocaleString() : '—'}
            </td>
            <td className="py-1.5 text-right">
              {item.distance_pct !== null ? (
                <span className={
                  item.distance_pct > 0
                    ? 'text-red-500 font-mono'
                    : item.distance_pct < 0
                      ? 'text-blue-500 font-mono'
                      : 'text-gray-500 font-mono'
                }>
                  {item.distance_pct > 0 ? '+' : ''}{item.distance_pct.toFixed(2)}%
                </span>
              ) : <span className="text-gray-400">—</span>}
            </td>
            <td className="py-1.5 pr-2 text-right">
              <HitrateCell rate={item.hitrate} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KeyLevelCard({
  level,
  isResistance,
  expandKey,
  expanded,
  onToggle,
}: {
  level: SRKeyLevel | null;
  isResistance: boolean;
  expandKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  if (!level) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-400">
        {isResistance ? '壓力' : '支撐'}資料不足
      </div>
    );
  }

  const dirLabel    = isResistance ? '壓力' : '支撐';
  const headerColor = isResistance
    ? 'bg-red-50 border-red-100'
    : 'bg-blue-50 border-blue-100';
  const priceColor  = isResistance ? 'text-red-700' : 'text-blue-700';

  return (
    <div className={`rounded-lg border ${headerColor} overflow-hidden`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:brightness-95 transition-all"
        onClick={() => onToggle(expandKey)}
      >
        <span className={`text-xs font-semibold px-2 py-0.5 rounded
          ${isResistance ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          {dirLabel}
        </span>

        <span className={`text-xl font-bold font-mono ${priceColor}`}>
          {level.price.toLocaleString()}
        </span>

        <span className="text-sm text-gray-600 bg-white/60 px-2 py-0.5 rounded">
          {level.label}
        </span>

        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${LAYER_STYLE[level.layer] || ''}`}>
          {level.layer}
        </span>

        <span className="flex-1" />

        <DistBadge pct={level.distance_pct} isResistance={isResistance} />

        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Accordion body */}
      {expanded && (
        <div className="border-t border-gray-100 bg-white px-4 pb-3">
          <IndicatorTable indicators={level.indicators} />
        </div>
      )}
    </div>
  );
}

export default function SRSummaryPanel({ data }: Props) {
  const [activePeriod, setActivePeriod] = useState<'short' | 'medium' | 'long'>('short');
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-8">
        三期關鍵位資料載入中…
      </div>
    );
  }

  const periodData = data.periods[activePeriod];

  return (
    <div className="flex-1 bg-gray-50 p-4 flex flex-col gap-4">

      {/* 股票標題列 */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-3 flex items-center gap-4 shadow-sm">
        <span className="text-base font-bold text-gray-800">{data.symbol}</span>
        <span className="text-xl font-bold text-gray-900 font-mono">
          {data.current_price.toLocaleString()}
        </span>
        <span className="text-xs text-gray-400">資料日期：{data.date}</span>
      </div>

      {/* 期別 Tab */}
      <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
        {(['short', 'medium', 'long'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setActivePeriod(p)}
            className={`flex-1 py-2 text-sm font-semibold rounded transition-all ${
              activePeriod === p
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 壓力卡 */}
      <KeyLevelCard
        level={periodData?.resistance ?? null}
        isResistance={true}
        expandKey={`${activePeriod}-resistance`}
        expanded={expanded.has(`${activePeriod}-resistance`)}
        onToggle={toggleExpand}
      />

      {/* 支撐卡 */}
      <KeyLevelCard
        level={periodData?.support ?? null}
        isResistance={false}
        expandKey={`${activePeriod}-support`}
        expanded={expanded.has(`${activePeriod}-support`)}
        onToggle={toggleExpand}
      />

      {/* 底部說明 */}
      <p className="text-xs text-gray-400 text-center pb-2">
        Layer：L1 = VP 關鍵區（最高信心）／L2 = 波段高低點／L3 = 均線兜底
        命中率 ≥ 70% 以綠色標示
      </p>
    </div>
  );
}
