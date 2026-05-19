'use client';

import { useState } from 'react';
import { PeriodName } from '../types';

// ── New SR Levels format ───────────────────────────────────────────────────
interface NewSRIndicator {
  code: string; name: string; period: PeriodName; role: string;
  value: number; value_rounded: number;
}
interface NewSRAnalysisPeriod {
  ai_sentence: string;
  support_val: number | null;
  resistance_val: number | null;
  support_ind?: string;
  resistance_ind?: string;
}
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

function TooltipIcon({ colorCls }: { colorCls: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] font-bold cursor-help select-none opacity-50 hover:opacity-90 transition-opacity ${colorCls}`}>
        ?
      </span>
      {show && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 z-50 leading-relaxed whitespace-normal pointer-events-none">
          近4年歷史資料顯示，含括率為XX%，平均寬度XX%。含括率為收盤價落在支撐與壓力預估區間內的天數比例。平均寬度為支撐到壓力的平均價差範圍百分比。
        </div>
      )}
    </div>
  );
}

export default function SRDataPanel({ srData }: Props) {
  const [showPeriods, setShowPeriods] = useState<Record<PeriodName, boolean>>({
    short: true, medium: true, long: true,
  });

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

  const TOOLTIP_COLOR: Record<PeriodName, string> = {
    short:  'border-yellow-500 text-yellow-700',
    medium: 'border-purple-500 text-purple-700',
    long:   'border-blue-500   text-blue-700',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Period cards */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {(['short', 'medium', 'long'] as PeriodName[]).map(p => {
              const a = srData?.analysis[p];
              const checked = showPeriods[p];
              const noData = a != null && a.support_val == null && a.resistance_val == null;

              return (
                <div key={p}>
                  {/* Checkbox header */}
                  <label className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setShowPeriods(prev => ({ ...prev, [p]: !prev[p] }))}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: PERIOD_COLOR[p] }}
                    />
                    <span className={`text-sm font-bold px-2 py-0.5 rounded border ${PERIOD_BADGE[p]}`}>
                      {PERIOD_FULLNAME[p]}
                    </span>
                  </label>

                  {/* Expanded content */}
                  {checked && a && (
                    <div className={`mx-4 mb-3 rounded-lg border overflow-hidden ${PERIOD_AI_BG[p]}`}>
                      {/* AI sentence row */}
                      <div className={`flex items-start gap-2 px-4 py-2.5 ${PERIOD_AI_TEXT[p]}`}>
                        <span className="text-sm leading-relaxed flex-1">
                          {noData ? '數據不足，無法計算支撐壓力' : a.ai_sentence}
                        </span>
                        {!noData && <TooltipIcon colorCls={TOOLTIP_COLOR[p]} />}
                      </div>

                      {/* SR value rows */}
                      {!noData && (
                        <div className="border-t border-gray-200/50 bg-white/70 divide-y divide-gray-100/70">
                          {a.resistance_val != null && (
                            <div className="flex items-center gap-3 px-4 py-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              <span className="text-xs font-bold text-red-600 w-8 shrink-0">壓力</span>
                              <span className="font-bold text-sm tabular-nums text-red-600 w-16 text-right shrink-0">
                                {fmtRaw(a.resistance_val)}
                              </span>
                              {a.resistance_ind && (
                                <span className="text-xs text-gray-500 truncate">{a.resistance_ind}</span>
                              )}
                            </div>
                          )}
                          {a.support_val != null && (
                            <div className="flex items-center gap-3 px-4 py-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              <span className="text-xs font-bold text-blue-600 w-8 shrink-0">支撐</span>
                              <span className="font-bold text-sm tabular-nums text-blue-600 w-16 text-right shrink-0">
                                {fmtRaw(a.support_val)}
                              </span>
                              {a.support_ind && (
                                <span className="text-xs text-gray-500 truncate">{a.support_ind}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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

                {resistances.length === 0 && supports.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-8">
                    {Object.values(showPeriods).every(v => !v) ? '請選擇至少一個期別' : '無符合條件的支撐壓力位'}
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
