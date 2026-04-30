'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { StockData, PeriodName, Timeframe } from './types';
import KLineChart, { SRLevel, SRAnalysis } from './components/KLineChart';
import StockSelector   from './components/StockSelector';
import SRDataPanel     from './components/SRDataPanel';
import ManualPage      from './components/ManualPage';

const PERIOD_DAYS: Record<PeriodName, number> = { short: 20, medium: 40, long: 80 };

// ── SR Levels data types ────────────────────────────────────────────────
interface SRLevelsStockData {
  name: string; close: number; change_pct: number;
  indicators: Record<string, number>;
  vp: { period_5: { poc:number;vah:number;val:number }; period_20: { poc:number;vah:number;val:number }; period_60: { poc:number;vah:number;val:number } };
  analysis: {
    short_term:  { resistance: SRZone; support: SRZone };
    medium_term: { resistance: SRZone; support: SRZone };
    long_term:   { resistance: SRZone; support: SRZone };
  };
}
interface SRZone { type:string; low:number; high:number; components:string[]; ai_sentence:string; }

// ── Build selectable SR level list for a stock ──────────────────────────
function buildAvailableSRLevels(d: SRLevelsStockData): SRLevel[] {
  const ind = d.indicators;
  const vp  = d.vp;
  const close = d.close;

  const short: [string, number | undefined][] = [
    ['上關',     ind['上關']],     ['下關',     ind['下關']],
    ['SAR',      ind['SAR']],      ['5日最高價', ind['5日最高價']],
    ['5日最低價', ind['5日最低價']], ['10日最高價',ind['10日最高價']],
    ['10日最低價',ind['10日最低價']],['MA5',     ind['MA5']],
    ['MA10',     ind['MA10']],     ['5日POC',   vp.period_5.poc],
    ['5日VAH',   vp.period_5.vah], ['5日VAL',   vp.period_5.val],
  ];
  const medium: [string, number | undefined][] = [
    ['布林通道上緣',ind['布林通道上緣']],['布林通道下緣',ind['布林通道下緣']],
    ['20日最高價', ind['20日最高價']], ['20日最低價', ind['20日最低價']],
    ['MA20',      ind['MA20']],       ['MA30',      ind['MA30']],
    ['20日POC',   vp.period_20.poc],  ['20日VAH',   vp.period_20.vah],
    ['20日VAL',   vp.period_20.val],
  ];
  const longPairs: [string, number | undefined][] = [
    ['240日最高價',ind['240日最高價']],['240日最低價',ind['240日最低價']],
    ['MA60',  ind['MA60']],['MA120', ind['MA120']],['MA240', ind['MA240']],
    ['60日POC',vp.period_60.poc],['60日VAH',vp.period_60.vah],['60日VAL',vp.period_60.val],
  ];
  const step  = close >= 1000 ? 100 : close >= 100 ? 50 : close >= 10 ? 5 : 1;
  const lo = close * 0.75, hi = close * 1.25;
  let n = Math.ceil(lo / step) * step;
  while (n <= hi) { if (Math.abs(n - close) / close > 0.005) longPairs.push([`整數${n}`, n]); n += step; }

  const toLevel = (pairs: [string, number | undefined][], p: PeriodName): SRLevel[] =>
    pairs
      .filter(([, v]) => v != null && !isNaN(v as number))
      .map(([name, price]) => ({ id: `${p}-${name}`, name, price: price as number, period: p }));

  return [
    ...toLevel(short,    'short'),
    ...toLevel(medium,   'medium'),
    ...toLevel(longPairs,'long'),
  ];
}

export default function Home() {
  const [stocks,     setStocks]     = useState<Record<string, StockData>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [mainTab,    setMainTab]    = useState<'data' | 'chart'>('data');
  const [timeframe,  setTimeframe]  = useState<Timeframe>('1d');

  // Volume period toggles
  const [showVolumes, setShowVolumes] = useState<Record<PeriodName, boolean>>({
    short: true, medium: false, long: false,
  });

  // AI判讀 toggles (default: 短期 on)
  const [showAI, setShowAI] = useState<Record<PeriodName, boolean>>({
    short: true, medium: false, long: false,
  });

  const [srLevelsData,   setSrLevelsData]   = useState<Record<string, SRLevelsStockData>>({});
  const [showManual,     setShowManual]     = useState(false);

  // Selected SR levels for chart
  const [selectedSRIds,  setSelectedSRIds]  = useState<Set<string>>(new Set());
  const [showSRDropdown, setShowSRDropdown] = useState(false);
  const [showSRModal,    setShowSRModal]    = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/stocks.json').then(r => r.json()).then((d: Record<string, StockData>) => {
      setStocks(d);
      const first = Object.keys(d)[0];
      if (first) setSelectedId(first);
    });
    fetch('/data/sr_levels_20260417.json')
      .then(r => r.json())
      .then(d => setSrLevelsData(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowSRDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // (reset handled in onSelect handler below to batch all state in one render)

  const stockList = useMemo(() =>
    Object.values(stocks).map(s => ({
      ...s,
      change_pct: srLevelsData[s.stock_id]?.change_pct ?? s.change_pct,
    })),
  [stocks, srLevelsData]);
  const stockData = stocks[selectedId];

  if (showManual) return <ManualPage onBack={() => setShowManual(false)} />;
  if (!stockData) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">載入中…</div>
  );

  const bars = stockData.klines[timeframe];
  const activePeriods: Record<PeriodName, any> = {
    short: stockData.periods.short, medium: stockData.periods.medium, long: stockData.periods.long,
  };
  const activeVolumeList = (['short','medium','long'] as PeriodName[]).filter(p => showVolumes[p]);
  const currentPeriod: PeriodName =
    activeVolumeList.includes('long') ? 'long' : activeVolumeList.includes('medium') ? 'medium' : 'short';
  const periodData = stockData.periods[currentPeriod];

  const currentSRLevelsData = srLevelsData[selectedId] ?? null;

  // AI 一句話：依 showAI 決定顯示哪幾期
  const aiLines: string[] = [];
  for (const pName of ['short', 'medium', 'long'] as PeriodName[]) {
    if (!showAI[pName]) continue;
    const termKey = pName === 'short' ? 'short_term' : pName === 'medium' ? 'medium_term' : 'long_term';
    const termData = currentSRLevelsData?.analysis?.[termKey as keyof typeof currentSRLevelsData.analysis];
    if (termData?.resistance?.ai_sentence) aiLines.push(termData.resistance.ai_sentence);
    if (termData?.support?.ai_sentence)    aiLines.push(termData.support.ai_sentence);
  }
  const aiSummary = aiLines.join('　');

  const srAnalysis: SRAnalysis | null = currentSRLevelsData?.analysis ?? null;
  const availableSRLevels = currentSRLevelsData ? buildAvailableSRLevels(currentSRLevelsData) : [];
  const selectedSRLevels  = availableSRLevels.filter(lv => selectedSRIds.has(lv.id));

  const toggleSR = (id: string) => {
    setSelectedSRIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const srByPeriod: Record<PeriodName, SRLevel[]> = {
    short:  availableSRLevels.filter(lv => lv.period === 'short'),
    medium: availableSRLevels.filter(lv => lv.period === 'medium'),
    long:   availableSRLevels.filter(lv => lv.period === 'long'),
  };

  const PERIOD_LABEL: Record<PeriodName, string> = { short: '短期', medium: '中期', long: '長期' };
  const PERIOD_COLOR_TEXT: Record<PeriodName, string> = {
    short:  'text-yellow-700 font-bold',
    medium: 'text-purple-700 font-bold',
    long:   'text-blue-700 font-bold',
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
      {(['short','medium','long'] as PeriodName[]).map(p => (
        <div key={p} className="mb-2">
          <div className={`text-xs px-2 py-1 ${PERIOD_COLOR_TEXT[p]}`}>{PERIOD_LABEL[p]}支撐壓力</div>
          {srByPeriod[p].map(lv => (
            <label key={lv.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer rounded text-sm">
              <input
                type="checkbox"
                checked={selectedSRIds.has(lv.id)}
                onChange={() => toggleSR(lv.id)}
                className="w-3.5 h-3.5 rounded"
              />
              <span className="flex-1 text-gray-700">{lv.name}</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {lv.price < 100 ? lv.price.toFixed(2) : lv.price >= 1000 ? lv.price.toFixed(0) : lv.price.toFixed(1)}
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {[{ key: 'data', label: '支撐壓力數據' }, { key: 'chart', label: '支撐壓力K線圖' }].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMainTab(key as 'data' | 'chart')}
            className={`px-7 py-3 text-sm font-bold border-b-2 transition-all ${
              mainTab === key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Stock Selector */}
      <StockSelector
        stocks={stockList}
        selectedId={selectedId}
        onSelect={id => {
          setSelectedId(id);
          setShowVolumes({ short: true, medium: false, long: false });
          setShowAI({ short: true, medium: false, long: false });
          setSelectedSRIds(new Set());
        }}
        onShowManual={() => setShowManual(true)}
      />

      {/* Content */}
      {mainTab === 'data' ? (
        <SRDataPanel
          data={stockData}
          srLevelsData={currentSRLevelsData}
        />
      ) : (
        <div className="flex flex-1 items-stretch">
          <div className="flex-1 min-w-0 flex flex-col gap-3 p-3">

            {/* Control bar */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-3 flex flex-row items-center gap-4 flex-wrap">
              {/* Volume toggles */}
              {[
                { key: 'short'  as PeriodName, label: '成交量(5日)',  accent: '#EAB308', bg: 'rgba(234,179,8,0.7)'   },
                { key: 'medium' as PeriodName, label: '成交量(20日)', accent: '#9333EA', bg: 'rgba(147,51,234,0.7)'  },
                { key: 'long'   as PeriodName, label: '成交量(60日)', accent: '#2563EB', bg: 'rgba(37,99,235,0.7)'   },
              ].map(({ key, label, accent, bg }) => (
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

              {/* Separator */}
              <div className="w-px h-6 bg-gray-200 mx-1" />

              {/* AI判讀 toggles */}
              {[
                { key: 'short'  as PeriodName, label: 'AI判讀(短期)', accent: '#EAB308', textCls: 'text-yellow-700' },
                { key: 'medium' as PeriodName, label: 'AI判讀(中期)', accent: '#9333EA', textCls: 'text-purple-700' },
                { key: 'long'   as PeriodName, label: 'AI判讀(長期)', accent: '#2563EB', textCls: 'text-blue-700'   },
              ].map(({ key, label, accent, textCls }) => (
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

              {/* SR modal button */}
              <button
                onClick={() => setShowSRModal(true)}
                className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                支撐壓力
              </button>
            </div>

            {/* K-line chart */}
            <div className="bg-white rounded border border-gray-200 overflow-hidden flex-1 min-h-0">
              <KLineChart
                bars={bars}
                period={periodData}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                showPeriods={showVolumes}
                chartType="candlestick"
                periodDays={PERIOD_DAYS}
                allPeriods={activePeriods}
                currentPrice={stockData.current_price}
                showVolumeProfile={activeVolumeList.length > 0}
                selectedSRLevels={selectedSRLevels}
                srAnalysis={srAnalysis}
                aiSummary={aiSummary}
                showAIPeriods={showAI}
              />
            </div>
          </div>
        </div>
      )}

      {/* SR Modal */}
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
