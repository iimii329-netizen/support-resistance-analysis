'use client';

import { useState } from 'react';
import { PeriodName } from '../types';

// ── New SR Levels format ───────────────────────────────────────────────────
interface NewSRIndicator {
  code: string; name: string; period: PeriodName; role: string;
  value: number; value_rounded: number;
}
interface NewSRAnalysisPeriod { ai_sentence: string; support_val: number | null; resistance_val: number | null; }
export interface NewSRStockData {
  name: string; close: number; change_pct: number; trend: string;
  indicators: NewSRIndicator[];
  analysis: { short?: NewSRAnalysisPeriod; medium?: NewSRAnalysisPeriod; long?: NewSRAnalysisPeriod };
}

interface Props { srData: NewSRStockData | null; }

// ── Style constants ────────────────────────────────────────────────────────
const PERIOD_BADGE: Record<PeriodName, string> = {
  short:  'bg-yellow-100 text-yellow-700 border border-yellow-300',
  medium: 'bg-purple-100 text-purple-700 border border-purple-300',
  long:   'bg-blue-100   text-blue-700   border border-blue-300',
};
const PERIOD_LABEL: Record<PeriodName, string>    = { short: '短', medium: '中', long: '長' };
const PERIOD_FULLNAME: Record<PeriodName, string> = { short: '短期', medium: '中期', long: '長期' };
const PERIOD_COLOR: Record<PeriodName, string>    = { short: '#EAB308', medium: '#9333EA', long: '#2563EB' };
const PERIOD_AI_BG: Record<PeriodName, string>    = {
  short:  'bg-yellow-50 border-yellow-200',
  medium: 'bg-purple-50 border-purple-200',
  long:   'bg-blue-50   border-blue-200',
};
const PERIOD_AI_TEXT: Record<PeriodName, string> = {
  short: 'text-yellow-800', medium: 'text-purple-800', long: 'text-blue-800',
};

const EXCLUDED_NAMES = new Set([
  'CDP追買點', 'CDP追賣點', 'CDP買進點', 'CDP賣出點', '線性回歸值',
]);

function fmtRaw(v: number): string {
  return v.toFixed(2);
}

export default function SRDataPanel({ srData }: Props) {
  const [showPeriods, setShowPeriods] = useState<Record<PeriodName, boolean>>({
    short: true, medium: true, long: true,
  });
  const [aiExpanded, setAiExpanded] = useState(false);

  const close    = srData?.close ?? 0;
  const filtered = (srData?.indicators ?? [])
    .filter(ind => showPeriods[ind.period])
    .filter(ind => !EXCLUDED_NAMES.has(ind.name));

  const resistances = filtered
    .filter(ind => ind.value >= close)
    .sort((a, b) => b.value - a.value);

  const supports = filtered
    .filter(ind => ind.value < close)
    .sort((a, b) => b.value - a.value);

  const renderRow = (ind: NewSRIndicator, isResistance: boolean) => (
    <div
      key={`${ind.period}-${ind.code}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${PERIOD_BADGE[ind.period]}`}>
        {PERIOD_LABEL[ind.period]}
      </span>
      <span className={`font-bold text-sm tabular-nums shrink-0 w-16 text-right ${isResistance ? 'text-red-600' : 'text-blue-600'}`}>
        {fmtRaw(ind.value)}
      </span>
      <span className="text-sm text-gray-500 min-w-0 truncate">{ind.name}</span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

      {/* Period filter */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* AI 判讀 collapsible */}
          {srData && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">AI 判讀</h3>
                <button
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  onClick={() => setAiExpanded(v => !v)}
                >
                  {aiExpanded ? '▲ 收合' : '▼ 展開'}
                </button>
              </div>
              <div className="px-5 py-3 space-y-2.5">
                {srData.analysis.short && (
                  <div className={`text-sm leading-relaxed px-4 py-2.5 rounded-lg border ${PERIOD_AI_BG.short} ${PERIOD_AI_TEXT.short}`}>
                    {srData.analysis.short.support_val == null && srData.analysis.short.resistance_val == null
                      ? '數據不足，無法計算支撐壓力'
                      : srData.analysis.short.ai_sentence}
                  </div>
                )}
                {aiExpanded && (['medium', 'long'] as PeriodName[]).map(p => {
                  const a = srData.analysis[p];
                  if (!a) return null;
                  return (
                    <div key={p} className={`text-sm leading-relaxed px-4 py-2.5 rounded-lg border ${PERIOD_AI_BG[p]} ${PERIOD_AI_TEXT[p]}`}>
                      {a.support_val == null && a.resistance_val == null
                        ? '數據不足，無法計算支撐壓力'
                        : a.ai_sentence}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SR level list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            {!srData ? (
              <div className="text-sm text-gray-400 text-center py-8">資料載入中…</div>
            ) : (
              <>
                {resistances.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-100">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="text-xs font-bold text-red-600">壓力</span>
                      <span className="text-xs text-red-300">({resistances.length})</span>
                    </div>
                    <div className="space-y-0.5">
                      {resistances.map(ind => renderRow(ind, true))}
                    </div>
                  </div>
                )}

                {supports.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-xs font-bold text-blue-600">支撐</span>
                      <span className="text-xs text-blue-300">({supports.length})</span>
                    </div>
                    <div className="space-y-0.5">
                      {supports.map(ind => renderRow(ind, false))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
