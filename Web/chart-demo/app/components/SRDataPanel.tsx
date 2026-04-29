'use client';

import { useState } from 'react';
import { StockData, PeriodName } from '../types';

export type DataPeriod = PeriodName | 'all';

interface VPData { poc: number; vah: number; val: number; }
interface SRZone {
  type: string;
  low: number;
  high: number;
  components: string[];
  ai_sentence: string;
}
interface SRLevelsStockData {
  name: string;
  close: number;
  change_pct: number;
  indicators: Record<string, number>;
  vp: { period_5: VPData; period_20: VPData; period_60: VPData };
  analysis: {
    short_term:  { resistance: SRZone; support: SRZone };
    medium_term: { resistance: SRZone; support: SRZone };
    long_term:   { resistance: SRZone; support: SRZone };
  };
}

interface Props {
  data: StockData;
  srLevelsData: SRLevelsStockData | null;
  period: DataPeriod;
  onPeriodChange: (p: DataPeriod) => void;
}

const TABS: { key: DataPeriod; label: string; color: string; activeCls: string }[] = [
  { key: 'short',  label: '短期', color: 'yellow', activeCls: 'border-yellow-500 text-yellow-700 bg-yellow-50' },
  { key: 'medium', label: '中期', color: 'purple', activeCls: 'border-purple-500 text-purple-700 bg-purple-50' },
  { key: 'long',   label: '長期', color: 'blue',   activeCls: 'border-blue-500  text-blue-700  bg-blue-50'   },
  { key: 'all',    label: '全部', color: 'gray',   activeCls: 'border-gray-700  text-gray-800  bg-gray-50'   },
];

const PERIOD_BADGE: Record<PeriodName, string> = {
  short:  'bg-yellow-100 text-yellow-700 border border-yellow-300',
  medium: 'bg-purple-100 text-purple-700 border border-purple-300',
  long:   'bg-blue-100   text-blue-700   border border-blue-300',
};
const PERIOD_LABEL: Record<PeriodName, string> = { short: '短', medium: '中', long: '長' };

interface LevelRow { name: string; price: number; period?: PeriodName }

function calcRoundNumbers(close: number): number[] {
  const lo = close * 0.75;
  const hi = close * 1.25;
  const step = close >= 1000 ? 100 : close >= 100 ? 50 : close >= 10 ? 5 : 1;
  const results: number[] = [];
  let n = Math.ceil(lo / step) * step;
  while (n <= hi) {
    if (Math.abs(n - close) / close > 0.005) results.push(n);
    n += step;
  }
  return results;
}

function getIndicators(
  d: SRLevelsStockData,
  period: PeriodName
): LevelRow[] {
  const ind = d.indicators;
  const vp = d.vp;
  if (period === 'short') return [
    { name: '上關',     price: ind['上關'] },
    { name: '下關',     price: ind['下關'] },
    { name: 'SAR',      price: ind['SAR'] },
    { name: '5日最高價', price: ind['5日最高價'] },
    { name: '5日最低價', price: ind['5日最低價'] },
    { name: '10日最高價',price: ind['10日最高價'] },
    { name: '10日最低價',price: ind['10日最低價'] },
    { name: 'MA5',      price: ind['MA5'] },
    { name: 'MA10',     price: ind['MA10'] },
    { name: '5日POC',   price: vp.period_5.poc },
    { name: '5日VAH',   price: vp.period_5.vah },
    { name: '5日VAL',   price: vp.period_5.val },
  ].filter(x => x.price != null && !isNaN(x.price));

  if (period === 'medium') return [
    { name: '布林通道上緣', price: ind['布林通道上緣'] },
    { name: '布林通道下緣', price: ind['布林通道下緣'] },
    { name: '20日最高價',   price: ind['20日最高價'] },
    { name: '20日最低價',   price: ind['20日最低價'] },
    { name: 'MA20',         price: ind['MA20'] },
    { name: 'MA30',         price: ind['MA30'] },
    { name: '20日POC',      price: vp.period_20.poc },
    { name: '20日VAH',      price: vp.period_20.vah },
    { name: '20日VAL',      price: vp.period_20.val },
  ].filter(x => x.price != null && !isNaN(x.price));

  if (period === 'long') {
    const rounds = calcRoundNumbers(d.close);
    return [
      { name: '240日最高價', price: ind['240日最高價'] },
      { name: '240日最低價', price: ind['240日最低價'] },
      { name: 'MA60',        price: ind['MA60'] },
      { name: 'MA120',       price: ind['MA120'] },
      { name: 'MA240',       price: ind['MA240'] },
      { name: '60日POC',     price: vp.period_60.poc },
      { name: '60日VAH',     price: vp.period_60.vah },
      { name: '60日VAL',     price: vp.period_60.val },
      ...rounds.map(r => ({ name: `整數${r}`, price: r })),
    ].filter(x => x.price != null && !isNaN(x.price));
  }
  return [];
}

function LevelTable({
  rows,
  currentPrice,
  showPeriodTag,
}: {
  rows: LevelRow[];
  currentPrice: number;
  showPeriodTag?: boolean;
}) {
  const resistances = rows.filter(r => r.price > currentPrice).sort((a, b) => a.price - b.price);
  const supports    = rows.filter(r => r.price <= currentPrice).sort((a, b) => b.price - a.price);

  const ResRow = ({ item, colorCls }: { item: LevelRow; colorCls: string }) => (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-opacity-70 transition-colors group border border-transparent hover:border-gray-100">
      <div className="flex items-center gap-2">
        {showPeriodTag && item.period && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PERIOD_BADGE[item.period]}`}>
            {PERIOD_LABEL[item.period]}
          </span>
        )}
        <span className={`font-bold text-base tabular-nums ${colorCls}`}>
          {item.price < 100 ? item.price.toFixed(2) : item.price.toFixed(item.price >= 1000 ? 0 : 1)}
        </span>
      </div>
      <span className="text-xs text-gray-400 font-medium">{item.name}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-red-200">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm font-bold text-red-600 tracking-wide">壓力</span>
          <span className="text-xs text-red-400">({resistances.length})</span>
        </div>
        <div className="space-y-0.5">
          {resistances.length === 0
            ? <div className="text-xs text-gray-400 px-3 py-2">無資料</div>
            : resistances.map((item, i) => <ResRow key={i} item={item} colorCls="text-red-600" />)
          }
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-blue-200">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-bold text-blue-600 tracking-wide">支撐</span>
          <span className="text-xs text-blue-400">({supports.length})</span>
        </div>
        <div className="space-y-0.5">
          {supports.length === 0
            ? <div className="text-xs text-gray-400 px-3 py-2">無資料</div>
            : supports.map((item, i) => <ResRow key={i} item={item} colorCls="text-blue-600" />)
          }
        </div>
      </div>
    </div>
  );
}

function AISentenceBadge({ sentence, colorCls }: { sentence: string; colorCls: string }) {
  if (!sentence) return null;
  return (
    <div className={`text-sm leading-relaxed px-4 py-2.5 rounded-lg border ${colorCls} mb-4`}>
      {sentence}
    </div>
  );
}

export default function SRDataPanel({ data, srLevelsData, period, onPeriodChange }: Props) {
  const currentPrice = data.current_price;

  const renderContent = () => {
    if (!srLevelsData) {
      return <div className="text-sm text-gray-400 text-center py-8">資料載入中…</div>;
    }

    if (period === 'all') {
      const allRows: LevelRow[] = [];
      (['short', 'medium', 'long'] as PeriodName[]).forEach(p => {
        getIndicators(srLevelsData, p).forEach(r => allRows.push({ ...r, period: p }));
      });
      const seen = new Map<string, LevelRow>();
      allRows.forEach(r => {
        const key = r.price.toFixed(2);
        if (!seen.has(key)) seen.set(key, r);
      });
      return <LevelTable rows={Array.from(seen.values())} currentPrice={currentPrice} showPeriodTag />;
    }

    const rows = getIndicators(srLevelsData, period as PeriodName);
    const analysis = srLevelsData.analysis;
    const termKey = period === 'short' ? 'short_term' : period === 'medium' ? 'medium_term' : 'long_term';
    const termData = analysis[termKey as keyof typeof analysis];

    const aiRes = termData.resistance.ai_sentence;
    const aiSup = termData.support.ai_sentence;

    return (
      <div className="space-y-4">
        {aiRes && (
          <AISentenceBadge
            sentence={aiRes}
            colorCls={period === 'short' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' : period === 'medium' ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-blue-50 border-blue-200 text-blue-900'}
          />
        )}
        {aiSup && aiSup !== aiRes && (
          <AISentenceBadge
            sentence={aiSup}
            colorCls={period === 'short' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' : period === 'medium' ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-blue-50 border-blue-200 text-blue-900'}
          />
        )}
        <LevelTable rows={rows} currentPrice={currentPrice} />
      </div>
    );
  };

  const changePct = data.change_pct ?? (srLevelsData?.change_pct ?? 0);
  const isPositive = changePct >= 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Price header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">
            {currentPrice < 100 ? currentPrice.toFixed(2) : currentPrice >= 1000 ? currentPrice.toFixed(0) : currentPrice.toFixed(1)}
          </span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded ${isPositive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
          </span>
        </div>
        <span className="text-xs text-gray-400">2026-04-17 收盤</span>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-white border-b border-gray-200 px-6">
        {TABS.map(({ key, label, activeCls }) => (
          <button
            key={key}
            onClick={() => onPeriodChange(key)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
              period === key
                ? activeCls
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
