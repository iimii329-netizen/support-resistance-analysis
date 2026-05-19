'use client';

import { useState, useEffect, useMemo } from 'react';
import { PeriodName } from './types';
import StockSelector from './components/StockSelector';
import SRDataPanel   from './components/SRDataPanel';
import ManualPage    from './components/ManualPage';

// ── New data format types ──────────────────────────────────────────────────
interface NewSRIndicator {
  code: string; name: string; period: PeriodName; role: string;
  value: number; value_rounded: number;
}
interface NewSRAnalysisPeriod {
  support_ind: string; resistance_ind: string;
  support_val: number | null; resistance_val: number | null;
  ai_sentence: string;
}
interface NewSRVPBucket { price_low: number; price_high: number; volume: number; }
interface NewSRVPData {
  poc: number; vah: number; val: number; total_volume: number; row_height: number;
  buckets: NewSRVPBucket[];
}
interface NewSRStockData {
  name: string; industry: string; close: number; prev_close: number;
  change_pct: number; trend: string;
  indicators: NewSRIndicator[];
  analysis: { short?: NewSRAnalysisPeriod; medium?: NewSRAnalysisPeriod; long?: NewSRAnalysisPeriod };
  vp: { period_5: NewSRVPData; period_20: NewSRVPData; period_60: NewSRVPData };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Home() {
  const [srLevelsData, setSrLevelsData] = useState<Record<string, NewSRStockData>>({});
  const [selectedId,   setSelectedId]   = useState('');
  const [mainTab,      setMainTab]      = useState<'data' | 'manual'>('data');

  useEffect(() => {
    fetch('/data/sr_levels_20260417.json')
      .then(r => r.json())
      .then((d: Record<string, NewSRStockData>) => {
        setSrLevelsData(d);
        const first = Object.keys(d)[0];
        if (first) setSelectedId(first);
      })
      .catch(console.error);
  }, []);

  const currentSRData = srLevelsData[selectedId] ?? null;

  const srLevelsSummary = useMemo(() => {
    const r: Record<string, { name: string; close: number; change_pct: number }> = {};
    for (const [id, d] of Object.entries(srLevelsData))
      r[id] = { name: d.name, close: d.close, change_pct: d.change_pct };
    return r;
  }, [srLevelsData]);

  if (!Object.keys(srLevelsData).length) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">載入中…</div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Main tab bar */}
      <div className="flex bg-white border-b border-gray-200">
        {([
          { key: 'data',   label: '支撐壓力數據' },
          { key: 'manual', label: '說明書' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`px-7 py-3 text-sm font-bold border-b-2 transition-all ${
              mainTab === key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >{label}</button>
        ))}
      </div>

      {mainTab === 'manual' ? (
        <ManualPage onBack={() => setMainTab('data')} />
      ) : (
        <>
          <StockSelector
            srLevelsData={srLevelsSummary}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id)}
          />
          <SRDataPanel srData={currentSRData} />
        </>
      )}
    </div>
  );
}
