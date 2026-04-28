'use client';

import { useState, useEffect, useMemo } from 'react';
import { StockData, Timeframe, PeriodName, PeriodAnalysis } from './types';
import KLineChart    from './components/KLineChart';
import StockSelector from './components/StockSelector';
import SRDataPanel, { DataPeriod } from './components/SRDataPanel';
import ManualPage    from './components/ManualPage';
import { processBands } from './utils/calcBands';
import { mockAIPrompt } from './utils/mockAIPrompt';
import { roundSRLevel, formatSRPrice } from './utils/roundSRLevel';

const PERIOD_DAYS: Record<PeriodName, number> = {
  short:  20,
  medium: 40,
  long:   80,
};

export default function Home() {
  const [stocks,     setStocks]     = useState<Record<string, StockData>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [mainTab,    setMainTab]    = useState<'data' | 'chart'>('chart');
  const [dataPeriod, setDataPeriod] = useState<DataPeriod>('short');
  const [timeframe,  setTimeframe]  = useState<Timeframe>('1d');

  // 成交量分佈勾選（對應 short/medium/long VP）
  const [showVolumes, setShowVolumes] = useState<Record<PeriodName, boolean>>({
    short:  true,
    medium: false,
    long:   false,
  });

  const [contentData, setContentData] = useState<Record<string, any>>({});
  const [srData,      setSRData]      = useState<Record<string, any>>({});
  const [showManual,  setShowManual]  = useState(false);

  useEffect(() => {
    fetch('/data/stocks.json')
      .then((r) => r.json())
      .then((d: Record<string, StockData>) => {
        setStocks(d);
        const first = Object.keys(d)[0];
        if (first) setSelectedId(first);
      });

    fetch('/data/support-resistance.json')
      .then((r) => r.json())
      .then((d) => setSRData(d))
      .catch(() => console.log('支撐壓力數據加載失敗'));

    const stockIds = ['2317.TW', '2330.TW', '2382.TW', '2454.TW', '2887.TW'];
    Promise.all(
      stockIds.map((id) =>
        fetch(`/content/${id}_20260417.json`)
          .then((r) => r.json())
          .then((data) => ({ [id]: data }))
          .catch(() => ({ [id]: null }))
      )
    ).then((results) => {
      const merged = results.reduce((acc, obj) => ({ ...acc, ...obj }), {});
      setContentData(merged);
    });
  }, []);

  const stockList = useMemo(() => Object.values(stocks), [stocks]);
  const stockData = stocks[selectedId];

  if (showManual) {
    return <ManualPage onBack={() => setShowManual(false)} />;
  }

  if (!stockData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        載入中…
      </div>
    );
  }

  const bars = stockData.klines[timeframe];

  const activePeriods: Record<PeriodName, PeriodAnalysis> = {
    short:  stockData.periods.short,
    medium: stockData.periods.medium,
    long:   stockData.periods.long,
  };

  // 根據勾選的成交量期別，決定當前 period（用於 SR 線）
  const activeVolumeList = (['short', 'medium', 'long'] as PeriodName[]).filter(p => showVolumes[p]);
  const currentPeriod: PeriodName =
    activeVolumeList.includes('long')   ? 'long' :
    activeVolumeList.includes('medium') ? 'medium' : 'short';

  const periodData = stockData.periods[currentPeriod];

  const processedSup = processBands(periodData.all_support || [], 'support');
  const processedRes = processBands(periodData.all_resistance || [], 'resistance');
  if (processedSup.main) {
    processedSup.main.summary = mockAIPrompt(processedSup.main, 'support', stockData.current_price);
  }
  if (processedRes.main) {
    processedRes.main.summary = mockAIPrompt(processedRes.main, 'resistance', stockData.current_price);
  }

  // AI 一句話摘要
  const aiSummaries: string[] = [];
  for (const pName of ['short', 'medium', 'long'] as PeriodName[]) {
    if (showVolumes[pName]) {
      const pData = stockData.periods[pName];
      if (pData?.support && pData?.resistance) {
        const roundedSup = roundSRLevel(pData.support.price, stockData.current_price);
        const roundedRes = roundSRLevel(pData.resistance.price, stockData.current_price);
        const supLabel = pData.support.members?.[0] || '支撐';
        const resLabel = pData.resistance.members?.[0] || '壓力';
        const supPrice = formatSRPrice(roundedSup, stockData.current_price);
        const resPrice = formatSRPrice(roundedRes, stockData.current_price);
        aiSummaries.push(`根據${supLabel}，在${supPrice}元附近有支撐。根據${resLabel}，在${resPrice}元附近有壓力。`);
      }
    }
  }
  const aiSummary = aiSummaries.join(' ');

  let roundedSupport: number | undefined;
  if (periodData?.support) {
    roundedSupport = roundSRLevel(periodData.support.price, stockData.current_price);
  }
  let roundedResistance: number | undefined;
  if (periodData?.resistance) {
    roundedResistance = roundSRLevel(periodData.resistance.price, stockData.current_price);
  }

  const handleVolumeChange = (p: PeriodName, checked: boolean) => {
    setShowVolumes((prev) => ({ ...prev, [p]: checked }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* 頂部主 Tab */}
      <div className="flex bg-white border-b border-gray-200">
        {[
          { key: 'data',  label: '支撐壓力數據' },
          { key: 'chart', label: '支撐壓力K線圖' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMainTab(key as 'data' | 'chart')}
            className={`px-7 py-3 text-sm font-bold border-b-2 transition-all ${
              mainTab === key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 選股列 */}
      <StockSelector
        stocks={stockList}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        onShowManual={() => setShowManual(true)}
      />

      {/* 主內容 */}
      {mainTab === 'data' ? (
        <SRDataPanel
          data={stockData}
          contentData={contentData[selectedId] || null}
          srData={srData[selectedId] || null}
          period={dataPeriod}
          onPeriodChange={setDataPeriod}
        />
      ) : (
        <div className="flex flex-1 items-stretch">
          <div className="flex-1 min-w-0 flex flex-col gap-3 p-3">

            {/* 控制棒：成交量勾選 */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-3 flex flex-row items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-yellow-50 px-3 py-1.5 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={showVolumes.short}
                  onChange={(e) => handleVolumeChange('short', e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: '#EAB308' }}
                />
                <span className="text-sm text-gray-800 font-semibold">成交量(5日)</span>
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(234,179,8,0.7)' }} />
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 px-3 py-1.5 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={showVolumes.medium}
                  onChange={(e) => handleVolumeChange('medium', e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: '#9333EA' }}
                />
                <span className="text-sm text-gray-800 font-semibold">成交量(20日)</span>
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(147,51,234,0.7)' }} />
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={showVolumes.long}
                  onChange={(e) => handleVolumeChange('long', e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: '#2563EB' }}
                />
                <span className="text-sm text-gray-800 font-semibold">成交量(60日)</span>
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(37,99,235,0.7)' }} />
              </label>
            </div>

            {/* K 線圖 */}
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
                srData={srData[selectedId] || null}
                roundedSupport={roundedSupport}
                roundedResistance={roundedResistance}
                currentPeriod={currentPeriod}
                aiSummary={aiSummary}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
