'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Bar, PeriodAnalysis, VP, PeriodName, Timeframe } from './types';
import KLineChart, { SRLevel, SRAnalysis, SRZoneData } from './components/KLineChart';
import StockSelector from './components/StockSelector';
import SRDataPanel   from './components/SRDataPanel';
import ManualPage    from './components/ManualPage';

const PERIOD_DAYS: Record<PeriodName, number> = { short: 20, medium: 40, long: 80 };

// ── New data format types ──────────────────────────────────────────────────
interface NewSRIndicator {
  code: string; name: string; period: PeriodName; role: string;
  value: number; value_rounded: number;
}
interface NewSRAnalysisPeriod {
  support_ind: string; resistance_ind: string;
  support_val: number; resistance_val: number;
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
interface NewKlineBar {
  date: string; open: number; high: number; low: number; close: number; volume: number;
  ma5: number; ma10: number; ma20: number; ma30: number; ma60: number; ma120: number; ma240: number;
}
interface NewKlineData { stock_id: string; name: string; bars: NewKlineBar[]; }

// ── Helpers ────────────────────────────────────────────────────────────────
function calcTick(price: number): number {
  if (price < 10)   return 0.01;
  if (price < 50)   return 0.05;
  if (price < 100)  return 0.1;
  if (price < 500)  return 0.5;
  if (price < 1000) return 1;
  return 5;
}

function adaptBars(rawBars: NewKlineBar[]): Bar[] {
  return rawBars.map(b => ({
    time: `${b.date.slice(0, 4)}/${b.date.slice(4, 6)}/${b.date.slice(6, 8)}`,
    open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    ma20: b.ma20 ?? null,
  }));
}

function buildVP(vpData: NewSRVPData | undefined, tick: number): VP {
  if (!vpData?.buckets?.length) return { poc: null, vah: null, val: null, tick, bins: [], valid: false };
  const maxVol = Math.max(...vpData.buckets.map(b => b.volume));
  return {
    poc: vpData.poc, vah: vpData.vah, val: vpData.val, tick,
    bins: vpData.buckets.map(b => ({
      price: (b.price_low + b.price_high) / 2,
      volume: b.volume,
      width: maxVol > 0 ? b.volume / maxVol : 0,
    })),
    valid: true,
  };
}

function buildPeriodAnalysis(vpData: NewSRVPData | undefined, tick: number): PeriodAnalysis {
  return { support: null, resistance: null, vp: buildVP(vpData, tick), all_support: [], all_resistance: [] };
}

function buildSRAnalysis(d: NewSRStockData): SRAnalysis | null {
  const makeIfValid = (val: number | null | undefined): SRZoneData | null => {
    if (val == null) return null;
    return { type: '壓力線', low: val, high: val, ai_sentence: '' };
  };
  const { short: s, medium: m, long: l } = d.analysis;
  if (!s && !m && !l) return null;
  return {
    short_term:  { resistance: makeIfValid(s?.resistance_val) ?? { type: '壓力線', low: 0, high: 0, ai_sentence: '' }, support: makeIfValid(s?.support_val) ?? { type: '壓力線', low: 0, high: 0, ai_sentence: '' } },
    medium_term: { resistance: makeIfValid(m?.resistance_val) ?? { type: '壓力線', low: 0, high: 0, ai_sentence: '' }, support: makeIfValid(m?.support_val) ?? { type: '壓力線', low: 0, high: 0, ai_sentence: '' } },
    long_term:   { resistance: makeIfValid(l?.resistance_val) ?? { type: '壓力線', low: 0, high: 0, ai_sentence: '' }, support: makeIfValid(l?.support_val) ?? { type: '壓力線', low: 0, high: 0, ai_sentence: '' } },
  };
}

const EXCLUDED_SR_NAMES = new Set([
  'CDP追買點', 'CDP追賣點', 'CDP買進點', 'CDP賣出點', '線性回歸值',
]);

function buildAvailableSRLevels(d: NewSRStockData): SRLevel[] {
  return d.indicators
    .filter(ind => !EXCLUDED_SR_NAMES.has(ind.name))
    .map(ind => ({
      id: `${ind.period}-${ind.code}`,
      name: ind.name,
      price: ind.value_rounded,
      rawValue: ind.value,
      period: ind.period,
    }));
}

const EMPTY_PERIOD: PeriodAnalysis = {
  support: null, resistance: null,
  vp: { poc: null, vah: null, val: null, tick: 1, bins: [], valid: false },
  all_support: [], all_resistance: [],
};

// ── Component ──────────────────────────────────────────────────────────────
export default function Home() {
  const [srLevelsData,    setSrLevelsData]    = useState<Record<string, NewSRStockData>>({});
  const [selectedId,      setSelectedId]      = useState('');
  const [klineData,       setKlineData]       = useState<NewKlineData | null>(null);
  const [mainTab,         setMainTab]         = useState<'data' | 'chart' | 'manual'>('data');
  const [timeframe,       setTimeframe]       = useState<Timeframe>('1d');
  const [showVolumes,     setShowVolumes]     = useState<Record<PeriodName, boolean>>({ short: true,  medium: false, long: false });
  const [showAI,          setShowAI]          = useState<Record<PeriodName, boolean>>({ short: true,  medium: false, long: false });
  const [selectedSRIds,   setSelectedSRIds]   = useState<Set<string>>(new Set());
  const [showSRDropdown,  setShowSRDropdown]  = useState(false);
  const [showSRModal,     setShowSRModal]     = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load SR levels once
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

  // Load per-stock kline on selection
  useEffect(() => {
    if (!selectedId) return;
    setKlineData(null);
    fetch(`/data/kline/${selectedId}.json`)
      .then(r => r.json())
      .then((d: NewKlineData) => setKlineData(d))
      .catch(console.error);
  }, [selectedId]);

  // Close SR dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowSRDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────
  const currentSRData = srLevelsData[selectedId] ?? null;
  const bars          = useMemo(() => klineData ? adaptBars(klineData.bars) : [], [klineData]);

  const allPeriods = useMemo((): Record<PeriodName, PeriodAnalysis> => {
    if (!currentSRData) return { short: EMPTY_PERIOD, medium: EMPTY_PERIOD, long: EMPTY_PERIOD };
    const t = calcTick(currentSRData.close);
    return {
      short:  buildPeriodAnalysis(currentSRData.vp.period_5,  t),
      medium: buildPeriodAnalysis(currentSRData.vp.period_20, t),
      long:   buildPeriodAnalysis(currentSRData.vp.period_60, t),
    };
  }, [currentSRData]);

  const activeVolumeList = (['short', 'medium', 'long'] as PeriodName[]).filter(p => showVolumes[p]);
  const currentPeriod: PeriodName =
    activeVolumeList.includes('long') ? 'long' : activeVolumeList.includes('medium') ? 'medium' : 'short';
  const periodData = allPeriods[currentPeriod];

  const availableSRLevels = useMemo(() =>
    currentSRData ? buildAvailableSRLevels(currentSRData) : [], [currentSRData]);
  const selectedSRLevels  = useMemo(() =>
    availableSRLevels.filter(lv => selectedSRIds.has(lv.id)), [availableSRLevels, selectedSRIds]);
  const srAnalysis        = useMemo(() =>
    currentSRData ? buildSRAnalysis(currentSRData) : null, [currentSRData]);

  const aiSummary = useMemo(() => {
    if (!currentSRData) return '';
    return (['short', 'medium', 'long'] as const)
      .filter(p => showAI[p])
      .map(p => {
        const a = currentSRData.analysis[p];
        if (!a) return null;
        if (a.support_val == null && a.resistance_val == null) return '數據不足，無法計算支撐壓力';
        return a.ai_sentence;
      })
      .filter((s): s is string => Boolean(s))
      .join('　');
  }, [currentSRData, showAI]);

  const srLevelsSummary = useMemo(() => {
    const r: Record<string, { name: string; close: number; change_pct: number }> = {};
    for (const [id, d] of Object.entries(srLevelsData))
      r[id] = { name: d.name, close: d.close, change_pct: d.change_pct };
    return r;
  }, [srLevelsData]);

  const srByPeriod: Record<PeriodName, SRLevel[]> = {
    short:  availableSRLevels.filter(lv => lv.period === 'short'),
    medium: availableSRLevels.filter(lv => lv.period === 'medium'),
    long:   availableSRLevels.filter(lv => lv.period === 'long'),
  };

  const toggleSR = (id: string) => setSelectedSRIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const PERIOD_LABEL: Record<PeriodName, string> = { short: '短期', medium: '中期', long: '長期' };
  const PERIOD_COLOR_TEXT: Record<PeriodName, string> = {
    short: 'text-yellow-700 font-bold', medium: 'text-purple-700 font-bold', long: 'text-blue-700 font-bold',
  };

  const SRCheckList = ({ compact }: { compact?: boolean }) => (
    <div className={compact ? 'max-h-72 overflow-y-auto' : ''}>
      {selectedSRIds.size > 0 && (
        <button
          onClick={() => setSelectedSRIds(new Set())}
          className="w-full text-xs text-gray-500 hover:text-red-600 py-1.5 border-b border-gray-100 mb-1"
        >
          清除全部（已選 {selectedSRIds.size} 個）
        </button>
      )}
      {(['short', 'medium', 'long'] as PeriodName[]).map(p => (
        <div key={p} className="mb-2">
          <div className={`text-xs px-2 py-1 ${PERIOD_COLOR_TEXT[p]}`}>{PERIOD_LABEL[p]}支撐壓力</div>
          {[...srByPeriod[p]].sort((a, b) => b.price - a.price).map(lv => (
            <label key={lv.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer rounded text-sm">
              <input type="checkbox" checked={selectedSRIds.has(lv.id)} onChange={() => toggleSR(lv.id)} className="w-3.5 h-3.5 rounded" />
              <span className="flex-1 text-gray-700">{lv.name}</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {(lv.rawValue ?? lv.price).toFixed(2)}
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );

  if (!Object.keys(srLevelsData).length) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">載入中…</div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Main tab bar */}
      <div className="flex bg-white border-b border-gray-200">
        {([
          { key: 'data',   label: '支撐壓力數據' },
          { key: 'chart',  label: 'K線圖' },
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
          {/* Stock selector */}
          <StockSelector
            srLevelsData={srLevelsSummary}
            selectedId={selectedId}
            onSelect={id => { setSelectedId(id); setSelectedSRIds(new Set()); }}
          />

          {/* Tab content */}
          {mainTab === 'data' ? (
            <SRDataPanel srData={currentSRData} />
          ) : (
            <div className="flex flex-1 items-stretch">
              <div className="flex-1 min-w-0 flex flex-col gap-3 p-3">

                {/* Control bar */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-3 flex flex-row items-center gap-4 flex-wrap">
                  {/* VP period toggles */}
                  {([
                    { key: 'short'  as PeriodName, label: '成交量(5日)',  accent: '#EAB308', bg: 'rgba(234,179,8,0.7)'  },
                    { key: 'medium' as PeriodName, label: '成交量(20日)', accent: '#9333EA', bg: 'rgba(147,51,234,0.7)' },
                    { key: 'long'   as PeriodName, label: '成交量(60日)', accent: '#2563EB', bg: 'rgba(37,99,235,0.7)'  },
                  ]).map(({ key, label, accent, bg }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={showVolumes[key]}
                        onChange={e => {
                          const v = e.target.checked;
                          setShowVolumes(prev => ({ ...prev, [key]: v }));
                          setShowAI(prev => ({ ...prev, [key]: v }));
                        }}
                        className="w-4 h-4"
                        style={{ accentColor: accent }}
                      />
                      <span className="text-sm text-gray-800 font-semibold">{label}</span>
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bg }} />
                    </label>
                  ))}

                  <div className="w-px h-6 bg-gray-200 mx-1" />

                  {/* AI判讀 toggles */}
                  {([
                    { key: 'short'  as PeriodName, label: 'AI判讀(短期)', accent: '#EAB308', textCls: 'text-yellow-700' },
                    { key: 'medium' as PeriodName, label: 'AI判讀(中期)', accent: '#9333EA', textCls: 'text-purple-700' },
                    { key: 'long'   as PeriodName, label: 'AI判讀(長期)', accent: '#2563EB', textCls: 'text-blue-700'   },
                  ]).map(({ key, label, accent, textCls }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={showAI[key]}
                        onChange={e => setShowAI(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4"
                        style={{ accentColor: accent }}
                      />
                      <span className={`text-sm font-semibold ${textCls}`}>{label}</span>
                    </label>
                  ))}

                  <div className="flex-1" />

                  {/* SR level dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowSRDropdown(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span>支撐壓力水位</span>
                      {selectedSRIds.size > 0 && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{selectedSRIds.size}</span>
                      )}
                      <span className="text-gray-400 text-xs">{showSRDropdown ? '▲' : '▼'}</span>
                    </button>
                    {showSRDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2">
                        <SRCheckList compact />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowSRModal(true)}
                    className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    支撐壓力
                  </button>
                </div>

                {/* K-line chart */}
                <div className="bg-white rounded border border-gray-200 overflow-hidden flex-1 min-h-0">
                  {bars.length > 0 && currentSRData ? (
                    <KLineChart
                      bars={bars}
                      period={periodData}
                      timeframe={timeframe}
                      onTimeframeChange={setTimeframe}
                      showPeriods={showVolumes}
                      chartType="candlestick"
                      periodDays={PERIOD_DAYS}
                      allPeriods={allPeriods}
                      currentPrice={currentSRData.close}
                      showVolumeProfile={activeVolumeList.length > 0}
                      selectedSRLevels={selectedSRLevels}
                      srAnalysis={srAnalysis}
                      aiSummary={aiSummary}
                      showAIPeriods={showAI}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm min-h-[400px]">
                      K線資料載入中…
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* SR level modal */}
      {showSRModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowSRModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-96 max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">選擇支撐壓力水位</h3>
              <button onClick={() => setShowSRModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SRCheckList />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowSRModal(false)}
                className="w-full py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                確認（已選 {selectedSRIds.size} 個）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
