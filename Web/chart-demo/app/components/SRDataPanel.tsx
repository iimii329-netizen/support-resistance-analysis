'use client';

import { useState } from 'react';
import { StockData, PeriodName } from '../types';

export type DataPeriod = PeriodName | 'all';

interface VPData { poc: number; vah: number; val: number; }
interface SRZone {
  type: string; low: number; high: number; components: string[]; ai_sentence: string;
}
interface SRLevelsStockData {
  name: string; close: number; change_pct: number;
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
}

const PERIOD_BADGE: Record<PeriodName, string> = {
  short:  'bg-yellow-100 text-yellow-700 border border-yellow-400',
  medium: 'bg-purple-100 text-purple-700 border border-purple-400',
  long:   'bg-blue-100   text-blue-700   border border-blue-400',
};
const PERIOD_LABEL: Record<PeriodName, string>    = { short: '短', medium: '中', long: '長' };
const PERIOD_FULLNAME: Record<PeriodName, string> = { short: '短期', medium: '中期', long: '長期' };
const PERIOD_COLOR: Record<PeriodName, string>    = { short: '#EAB308', medium: '#9333EA', long: '#2563EB' };
const PERIOD_AI_TEXT: Record<PeriodName, string>  = {
  short: 'text-yellow-700', medium: 'text-purple-700', long: 'text-blue-700',
};
const PERIOD_AI_BG: Record<PeriodName, string> = {
  short:  'bg-yellow-50 border-yellow-200',
  medium: 'bg-purple-50 border-purple-200',
  long:   'bg-blue-50   border-blue-200',
};

interface LevelRow   { name: string;   price: number; period: PeriodName; }
interface DisplayRow { names: string[]; price: number; period: PeriodName; }

function calcRoundNumbers(close: number): number[] {
  const step = close >= 1000 ? 100 : close >= 100 ? 50 : close >= 10 ? 5 : 1;
  const lo = close * 0.75, hi = close * 1.25;
  let n = Math.ceil(lo / step) * step;
  let nearestAbove: number | null = null;
  let nearestBelow: number | null = null;
  while (n <= hi) {
    if (Math.abs(n - close) / close > 0.005) {
      if (n > close && nearestAbove === null) nearestAbove = n;
      if (n <= close) nearestBelow = n;
    }
    n += step;
  }
  return [nearestBelow, nearestAbove].filter((x): x is number => x !== null);
}

function getIndicators(d: SRLevelsStockData, period: PeriodName): LevelRow[] {
  const ind = d.indicators;
  const vp  = d.vp;
  const base = (pairs: [string, number | undefined][]) =>
    pairs.filter(([, v]) => v != null && !isNaN(v as number))
         .map(([name, price]) => ({ name, price: price as number, period }));

  if (period === 'short') return base([
    ['上關',      ind['上關']],      ['下關',      ind['下關']],
    ['SAR',       ind['SAR']],       ['5日最高價',  ind['5日最高價']],
    ['5日最低價',  ind['5日最低價']],  ['10日最高價', ind['10日最高價']],
    ['10日最低價', ind['10日最低價']], ['MA5',       ind['MA5']],
    ['MA10',      ind['MA10']],      ['5日POC',    vp.period_5.poc],
    ['5日VAH',    vp.period_5.vah],  ['5日VAL',    vp.period_5.val],
  ]);
  if (period === 'medium') return base([
    ['布林通道上緣', ind['布林通道上緣']], ['布林通道下緣', ind['布林通道下緣']],
    ['20日最高價',   ind['20日最高價']],   ['20日最低價',   ind['20日最低價']],
    ['MA20',         ind['MA20']],         ['MA30',         ind['MA30']],
    ['20日POC',      vp.period_20.poc],    ['20日VAH',      vp.period_20.vah],
    ['20日VAL',      vp.period_20.val],
  ]);
  const rounds = calcRoundNumbers(d.close);
  return base([
    ['240日最高價', ind['240日最高價']], ['240日最低價', ind['240日最低價']],
    ['MA60',  ind['MA60']], ['MA120', ind['MA120']], ['MA240', ind['MA240']],
    ['60日POC', vp.period_60.poc], ['60日VAH', vp.period_60.vah], ['60日VAL', vp.period_60.val],
    ...rounds.map(r => [`整數${r}`, r] as [string, number]),
  ]);
}

function fmtPrice(p: number) {
  return p.toFixed(2);
}

export default function SRDataPanel({ data, srLevelsData }: Props) {
  const [showPeriods, setShowPeriods] = useState<Record<PeriodName, boolean>>({
    short: true, medium: true, long: true,
  });
  const [aiExpanded, setAiExpanded] = useState(false);

  const currentPrice = data.current_price;

  // Build deduped price map
  const allRows: LevelRow[] = [];
  (['short', 'medium', 'long'] as PeriodName[]).forEach(p => {
    if (!showPeriods[p] || !srLevelsData) return;
    getIndicators(srLevelsData, p).forEach(r => allRows.push(r));
  });
  const priceMap = new Map<string, DisplayRow>();
  allRows.forEach(r => {
    const key = r.price.toFixed(2);
    const existing = priceMap.get(key);
    if (!existing) {
      priceMap.set(key, { names: [r.name], price: r.price, period: r.period });
    } else {
      existing.names.push(r.name);
    }
  });

  const resistances = Array.from(priceMap.values())
    .filter(r => r.price > currentPrice)
    .sort((a, b) => b.price - a.price);
  const supports = Array.from(priceMap.values())
    .filter(r => r.price <= currentPrice)
    .sort((a, b) => b.price - a.price);

  // AI text helpers
  const getAIText = (period: PeriodName): string => {
    if (!srLevelsData) return '';
    const termKey = period === 'short' ? 'short_term' : period === 'medium' ? 'medium_term' : 'long_term';
    const term = srLevelsData.analysis[termKey as keyof typeof srLevelsData.analysis];
    return [term?.resistance?.ai_sentence, term?.support?.ai_sentence].filter(Boolean).join('　');
  };

  const renderRow = (item: DisplayRow, isResistance: boolean) => (
    <div
      key={item.price.toFixed(2)}
      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2 py-1.5 rounded-lg"
    >
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${PERIOD_BADGE[item.period]}`}>
        {PERIOD_LABEL[item.period]}
      </span>
      <span className={`font-bold text-base tabular-nums shrink-0 ${isResistance ? 'text-red-600' : 'text-blue-600'}`}>
        {fmtPrice(item.price)}
      </span>
      <span className="text-xs text-gray-400 font-medium min-w-0">{item.names.join('、')}</span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

      {/* Filter bar — 期別 only */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">期別</span>
        {(['short', 'medium', 'long'] as PeriodName[]).map(p => (
          <label key={p} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPeriods[p]}
              onChange={() => setShowPeriods(prev => ({ ...prev, [p]: !prev[p] }))}
              className="w-4 h-4 rounded"
              style={{ accentColor: PERIOD_COLOR[p] }}
            />
            <span className={`text-sm font-bold px-2 py-0.5 rounded border ${PERIOD_BADGE[p]}`}>
              {PERIOD_FULLNAME[p]}
            </span>
          </label>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* AI 判讀摘要 — 短期預設顯示，展開後顯示中/長期 */}
          {srLevelsData && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header with expand toggle */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">AI 判讀摘要</h3>
                <button
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  onClick={() => setAiExpanded(v => !v)}
                >
                  {aiExpanded ? '▲ 收合' : '▼ 展開'}
                </button>
              </div>

              <div className="px-5 pb-4 space-y-2.5 pt-3">
                {/* Short-term always visible */}
                {(() => {
                  const text = getAIText('short');
                  if (!text) return null;
                  return (
                    <div className={`text-sm leading-relaxed px-4 py-2.5 rounded-lg border ${PERIOD_AI_BG.short} ${PERIOD_AI_TEXT.short}`}>
                      <span className="font-bold">短期：</span>{text}
                    </div>
                  );
                })()}

                {/* Medium + Long visible when expanded */}
                {aiExpanded && (['medium', 'long'] as PeriodName[]).map(p => {
                  const text = getAIText(p);
                  if (!text) return null;
                  return (
                    <div key={p} className={`text-sm leading-relaxed px-4 py-2.5 rounded-lg border ${PERIOD_AI_BG[p]} ${PERIOD_AI_TEXT[p]}`}>
                      <span className="font-bold">{PERIOD_FULLNAME[p]}：</span>{text}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SR Levels — 單一垂直清單 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            {!srLevelsData ? (
              <div className="text-sm text-gray-400 text-center py-8">資料載入中…</div>
            ) : (
              <div>
                {/* Resistances */}
                {resistances.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-100">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="text-xs font-bold text-red-600">壓力</span>
                      <span className="text-xs text-red-400">({resistances.length})</span>
                    </div>
                    <div className="space-y-0.5">
                      {resistances.map(item => renderRow(item, true))}
                    </div>
                  </div>
                )}

                {/* Supports */}
                {supports.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-xs font-bold text-blue-600">支撐</span>
                      <span className="text-xs text-blue-400">({supports.length})</span>
                    </div>
                    <div className="space-y-0.5">
                      {supports.map(item => renderRow(item, false))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
