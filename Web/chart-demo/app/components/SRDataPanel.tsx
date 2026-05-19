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
  short:  'bg-yellow-50',
  medium: 'bg-purple-50',
  long:   'bg-blue-50',
};
const PERIOD_AI_TEXT: Record<PeriodName, string> = {
  short: 'text-yellow-800', medium: 'text-purple-800', long: 'text-blue-800',
};
const PERIOD_DIVIDER: Record<PeriodName, string> = {
  short: 'border-yellow-100', medium: 'border-purple-100', long: 'border-blue-100',
};
const TOOLTIP_COLOR: Record<PeriodName, string> = {
  short:  'border-yellow-500 text-yellow-700',
  medium: 'border-purple-500 text-purple-700',
  long:   'border-blue-500   text-blue-700',
};

const EXCLUDED_NAMES = new Set([
  'CDP追買點', 'CDP追賣點', 'CDP買進點', 'CDP賣出點', '線性回歸值',
]);

// ── Candidate lookup (mirrors ManualPage §4-2) ─────────────────────────────
// Maps JSON display names → CANDIDATES code keys
const NAME_TO_CODE: Record<string, string> = {
  '5日最高價': 'high_5d',    '5日最高': 'high_5d',
  '5日最低價': 'low_5d',     '5日最低': 'low_5d',
  '10日最高價': 'high_10d',  '10日最高': 'high_10d',
  '10日最低價': 'low_10d',   '10日最低': 'low_10d',
  '20日最高價': 'high_20d',  '20日最高': 'high_20d',
  '20日最低價': 'low_20d',   '20日最低': 'low_20d',
  '240日最高價': 'high_240d','240日最高': 'high_240d',
  '240日最低價': 'low_240d', '240日最低': 'low_240d',
  'MA5': 'ma5', 'MA10': 'ma10', 'MA20': 'ma20', 'MA30': 'ma30',
  'MA60': 'ma60', 'MA120': 'ma120', 'MA240': 'ma240',
  '5日POC': 'vp5_poc',   '5日VAH': 'vp5_vah',   '5日VAL': 'vp5_val',
  '20日POC': 'vp20_poc', '20日VAH': 'vp20_vah', '20日VAL': 'vp20_val',
  '60日POC': 'vp60_poc', '60日VAH': 'vp60_vah', '60日VAL': 'vp60_val',
  '布林通道上緣(2σ)': 'bbands_upper_2std', 'BB上緣(2σ)': 'bbands_upper_2std',
  '布林通道下緣(2σ)': 'bbands_lower_2std', 'BB下緣(2σ)': 'bbands_lower_2std',
  'MA軌道上限': 'ma_track_upper',   'MA軌道下限': 'ma_track_lower',
  '上檔量密集成交區': 'vol_dense_upper', '上檔量密集區': 'vol_dense_upper',
  '下檔量密集成交區': 'vol_dense_lower', '下檔量密集區': 'vol_dense_lower',
  '上關': 'upper_gate', '下關': 'lower_gate',
};

type CandInfo = { sup: string; res: string; cont: string; width: string };

const CAND_SHORT: CandInfo[] = [
  { sup:'vp5_val', res:'high_5d',  cont:'77–84%', width:'~5–6%' },
  { sup:'low_5d',  res:'vp5_vah',  cont:'73–79%', width:'~4–5%' },
  { sup:'low_5d',  res:'high_5d',  cont:'~90%',   width:'~7.5%' },
  { sup:'low_10d', res:'high_10d', cont:'~93%',   width:'~11%'  },
];
const CAND_MID: Record<string, CandInfo[]> = {
  bull: [
    { sup:'ma20',            res:'vol_dense_upper', cont:'98.38%', width:'~4.9%'  },
    { sup:'vol_dense_lower', res:'vol_dense_upper', cont:'98.35%', width:'~5.7%'  },
    { sup:'ma_track_lower',  res:'vol_dense_upper', cont:'96.58%', width:'~5.8%'  },
    { sup:'ma30',            res:'vol_dense_upper', cont:'96.32%', width:'~6.4%'  },
    { sup:'vp20_val',        res:'vol_dense_upper', cont:'96.23%', width:'~6.9%'  },
    { sup:'ma20',            res:'high_20d',        cont:'96.04%', width:'~8.6%'  },
    { sup:'vol_dense_lower', res:'high_20d',        cont:'96.01%', width:'~9.4%'  },
    { sup:'low_20d',         res:'high_20d',        cont:'96.04%', width:'~15.1%' },
  ],
  bear: [
    { sup:'vol_dense_lower', res:'ma20',            cont:'99.66%', width:'~4.3%'  },
    { sup:'vol_dense_lower', res:'vp20_vah',        cont:'99.28%', width:'~8.2%'  },
    { sup:'vol_dense_lower', res:'vol_dense_upper', cont:'99.05%', width:'~6.9%'  },
    { sup:'vol_dense_lower', res:'ma_track_upper',  cont:'98.91%', width:'~5.5%'  },
    { sup:'vol_dense_lower', res:'ma30',            cont:'97.81%', width:'~5.9%'  },
    { sup:'low_20d',         res:'ma20',            cont:'95.16%', width:'~6.6%'  },
    { sup:'vol_dense_lower', res:'high_20d',        cont:'99.66%', width:'~11.5%' },
    { sup:'low_20d',         res:'high_20d',        cont:'95.23%', width:'~15.1%' },
  ],
  sideways: [
    { sup:'vol_dense_lower', res:'vol_dense_upper', cont:'97.64%', width:'~5.0%'  },
    { sup:'vol_dense_lower', res:'high_20d',        cont:'98.03%', width:'~9.1%'  },
    { sup:'low_20d',         res:'vol_dense_upper', cont:'95.70%', width:'~8.4%'  },
    { sup:'low_20d',         res:'high_20d',        cont:'96.04%', width:'~12.5%' },
  ],
};
const CAND_LONG: Record<string, CandInfo[]> = {
  bull: [
    { sup:'ma60',     res:'high_240d', cont:'98.10%', width:'~27.5%' },
    { sup:'vp60_val', res:'high_240d', cont:'98.08%', width:'~34.9%' },
    { sup:'ma120',    res:'high_240d', cont:'88.03%', width:'~28.9%' },
    { sup:'vp60_poc', res:'high_240d', cont:'80.48%', width:'~29.0%' },
    { sup:'ma240',    res:'high_240d', cont:'74.84%', width:'~28.4%' },
    { sup:'low_240d', res:'high_240d', cont:'98.10%', width:'~44.8%' },
  ],
  bear: [
    { sup:'low_240d', res:'ma60',      cont:'98.22%', width:'~19.7%' },
    { sup:'low_240d', res:'vp60_vah',  cont:'98.21%', width:'~28.3%' },
    { sup:'low_240d', res:'ma120',     cont:'91.97%', width:'~22.4%' },
    { sup:'low_240d', res:'vp60_poc',  cont:'91.54%', width:'~22.2%' },
    { sup:'low_240d', res:'ma240',     cont:'83.56%', width:'~24.4%' },
    { sup:'low_240d', res:'high_240d', cont:'98.22%', width:'~58.2%' },
  ],
  sideways: [
    { sup:'low_240d',  res:'vp60_vah',  cont:'93.77%', width:'~27.0%' },
    { sup:'vp60_val',  res:'vp60_vah',  cont:'74.70%', width:'~11.9%' },
    { sup:'vp60_val',  res:'ma240',     cont:'70.73%', width:'~14.9%' },
    { sup:'vp60_val',  res:'high_240d', cont:'80.64%', width:'~41.7%' },
    { sup:'low_240d',  res:'high_240d', cont:'99.37%', width:'~48.9%' },
  ],
};

function lookupCandidate(
  period: PeriodName,
  trend: string,
  supInd: string | undefined,
  resInd: string | undefined,
): CandInfo | null {
  const supCode = supInd ? NAME_TO_CODE[supInd] : undefined;
  const resCode = resInd ? NAME_TO_CODE[resInd] : undefined;
  if (!supCode || !resCode) return null;
  const rows = period === 'short' ? CAND_SHORT
    : period === 'medium' ? (CAND_MID[trend] ?? [])
    : (CAND_LONG[trend] ?? []);
  return rows.find(c => c.sup === supCode && c.res === resCode) ?? null;
}

// ── Tooltip icon ───────────────────────────────────────────────────────────
interface TooltipProps {
  colorCls: string;
  period: PeriodName;
  trend: string;
  supInd: string | undefined;
  resInd: string | undefined;
}
function TooltipIcon({ colorCls, period, trend, supInd, resInd }: TooltipProps) {
  const [show, setShow] = useState(false);
  const cand = lookupCandidate(period, trend, supInd, resInd);

  return (
    <div
      className="relative inline-flex shrink-0 mt-0.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] font-bold cursor-help select-none opacity-50 hover:opacity-90 transition-opacity ${colorCls}`}>
        ?
      </span>
      {show && (
        <div className="absolute right-0 bottom-full mb-1.5 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 z-50 leading-relaxed whitespace-normal pointer-events-none">
          {cand
            ? `近4年歷史資料顯示，含括率為${cand.cont}，平均寬度${cand.width}。含括率為收盤價落在支撐與壓力預估區間內的天數比例。平均寬度為支撐到壓力的平均價差範圍百分比。`
            : '含括率與平均寬度詳見說明書 4-2 候選組合。含括率為收盤價落在支撐與壓力預估區間內的天數比例。平均寬度為支撐到壓力的平均價差範圍百分比。'}
        </div>
      )}
    </div>
  );
}

function fmtRaw(v: number): string {
  return v.toFixed(2);
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

  const activeSentences = (['short', 'medium', 'long'] as PeriodName[])
    .filter(p => showPeriods[p] && srData?.analysis[p]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Period checkboxes + AI sentences */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Horizontal checkbox row */}
            <div className="flex items-center gap-6 px-5 py-3 border-b border-gray-100">
              {(['short', 'medium', 'long'] as PeriodName[]).map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer select-none">
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

            {/* AI sentences */}
            {srData && activeSentences.length > 0 && (
              <div>
                {activeSentences.map((p, idx) => {
                  const a = srData.analysis[p]!;
                  const noData = a.support_val == null && a.resistance_val == null;
                  const isLast = idx === activeSentences.length - 1;
                  return (
                    <div
                      key={p}
                      className={`flex items-start gap-3 px-5 py-3 ${PERIOD_AI_BG[p]} ${!isLast ? `border-b ${PERIOD_DIVIDER[p]}` : ''}`}
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${PERIOD_BADGE[p]}`}>
                        {PERIOD_LABEL[p]}
                      </span>
                      <span className={`text-sm leading-relaxed flex-1 ${PERIOD_AI_TEXT[p]}`}>
                        {noData ? '數據不足，無法計算支撐壓力' : a.ai_sentence}
                      </span>
                      {!noData && (
                        <TooltipIcon
                          colorCls={TOOLTIP_COLOR[p]}
                          period={p}
                          trend={srData.trend}
                          supInd={a.support_ind}
                          resInd={a.resistance_ind}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {srData && activeSentences.length === 0 && (
              <div className="px-5 py-6 text-sm text-gray-400 text-center">請選擇至少一個期別</div>
            )}
          </div>

          {/* SR indicator list */}
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
