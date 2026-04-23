'use client';

import { useState, useEffect, useMemo } from 'react';
import { StockData, Timeframe, PeriodName, PeriodAnalysis } from './types';
import KLineChart    from './components/KLineChart';
import StockSelector from './components/StockSelector';
import SidePanel     from './components/SidePanel';
import ManualPage    from './components/ManualPage';
import { processBands } from './utils/calcBands';
import { mockAIPrompt } from './utils/mockAIPrompt';
import { roundSRLevel, formatSRPrice } from './utils/roundSRLevel';

// 各期別的預設 K 線頻率
const PERIOD_DEFAULT_TF: Record<PeriodName, Timeframe> = {
  short:  '1d',
  medium: '1d',
  long:   '1d',
};

const PERIOD_DAYS: Record<PeriodName, number> = {
  short:  20,
  medium: 40,
  long:   80,
};

export default function Home() {
  const [stocks,     setStocks]     = useState<Record<string, StockData>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [period,     setPeriod]     = useState<PeriodName>('short');
  const [timeframe,  setTimeframe]  = useState<Timeframe>(PERIOD_DEFAULT_TF.short);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [showPeriods, setShowPeriods] = useState<Record<PeriodName, boolean>>({
    short: true,
    medium: false,
    long: false,
  });
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [showVolumeProfile, setShowVolumeProfile] = useState(true);
  const [contentData, setContentData] = useState<Record<string, any>>({});
  const [srData, setSRData] = useState<Record<string, any>>({});
  const [showManual, setShowManual] = useState(false);

  // 載入資料
  useEffect(() => {
    fetch('/data/stocks.json')
      .then((r) => r.json())
      .then((d: Record<string, StockData>) => {
        setStocks(d);
        const first = Object.keys(d)[0];
        if (first) setSelectedId(first);
      });

    // 載入新的支撐壓力數據
    fetch('/data/support-resistance.json')
      .then((r) => r.json())
      .then((d) => setSRData(d))
      .catch(() => console.log('支撐壓力數據加載失敗'));

    // 同時載入content數據
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

  // 切換 period 時，K 線頻率自動跳到預設值，並單選左側對應的 checkbox
  const handlePeriodChange = (p: PeriodName) => {
    setPeriod(p);
    setTimeframe(PERIOD_DEFAULT_TF[p]);
    setShowPeriods({short: false, medium: false, long: false, [p]: true});
  };

  // 根據勾選的期別自動切換右側 SidePanel 的 tab
  useEffect(() => {
    const checkedPeriods = Object.entries(showPeriods)
      .filter(([_, checked]) => checked)
      .map(([periodName]) => periodName as PeriodName);

    // 只有一個期別被勾選時，自動跳到該期別
    if (checkedPeriods.length === 1) {
      handlePeriodChange(checkedPeriods[0]);
    }
    // 多於一個期別時，保持原本的 tab（不自動切換）
  }, [showPeriods]);

  const stockList  = useMemo(() => Object.values(stocks), [stocks]);
  const stockData  = stocks[selectedId];

  // 顯示說明書頁面
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

  // 為K線圖準備combined period data - 包含所有active periods
  const activePeriods: Record<PeriodName, PeriodAnalysis> = {
    short: stockData.periods.short,
    medium: stockData.periods.medium,
    long: stockData.periods.long,
  };

  // 用於sidebar的period data
  const periodData = stockData.periods[period];

  // 處理主要period的數據用於SidePanel
  const processedSup = processBands(periodData.all_support || [], 'support');
  const processedRes = processBands(periodData.all_resistance || [], 'resistance');

  if (processedSup.main) {
    processedSup.main.summary = mockAIPrompt(processedSup.main, 'support', stockData.current_price);
  }
  if (processedRes.main) {
    processedRes.main.summary = mockAIPrompt(processedRes.main, 'resistance', stockData.current_price);
  }

  const periodData_sidebar = {
    ...periodData,
    support: processedSup.main,
    resistance: processedRes.main,
    all_support: processedSup.filtered,
    all_resistance: processedRes.filtered,
  };

  // 生成AI一句話（根據勾選的期別同時顯示）
  const aiSummaries: string[] = [];
  for (const periodName of ['short', 'medium', 'long'] as PeriodName[]) {
    if (showPeriods[periodName]) {
      const pData = stockData.periods[periodName];
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

  // 計算舍入後的支撐壓力（用於K線圖上的直線）
  let roundedSupport: number | null = null;
  if (periodData?.support) {
    roundedSupport = roundSRLevel(periodData.support.price, stockData.current_price);
  }

  let roundedResistance: number | null = null;
  if (periodData?.resistance) {
    roundedResistance = roundSRLevel(periodData.resistance.price, stockData.current_price);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* 選股列 */}
      <StockSelector
        stocks={stockList}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); }}
        onShowManual={() => setShowManual(true)}
      />

      {/* 主體：K 線圖 + 收合面板 */}
      <div className="flex flex-1 items-stretch">
        {/* K 線圖 */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 p-3">
          {/* 控制棒 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-row items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={showPeriods.short}
                onChange={(e) => setShowPeriods({...showPeriods, short: e.target.checked})}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-sm text-gray-800 font-semibold">短期(5日)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={showPeriods.medium}
                onChange={(e) => setShowPeriods({...showPeriods, medium: e.target.checked})}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-800 font-semibold">中期(20日)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={showPeriods.long}
                onChange={(e) => setShowPeriods({...showPeriods, long: e.target.checked})}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-gray-800 font-semibold">長期(60日)</span>
            </label>

            <div className="w-px h-6 bg-gray-200"></div>

            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={showVolumeProfile}
                onChange={(e) => setShowVolumeProfile(e.target.checked)}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-sm text-gray-800 font-semibold">顯示成交量分佈</span>
            </label>

            <div className="w-px h-6 bg-gray-200"></div>

            <button
              onClick={() => setChartType('candlestick')}
              className={`px-4 py-1.5 rounded border-2 text-sm font-bold transition-all ${
                chartType === 'candlestick'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              K棒圖
            </button>

            <button
              onClick={() => setChartType('line')}
              className={`px-4 py-1.5 rounded border-2 text-sm font-bold transition-all ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              線圖
            </button>
          </div>

          {/* K 線圖 */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden flex-1 min-h-0">
            <KLineChart
              bars={bars}
              period={periodData}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              showPeriods={showPeriods}
              chartType={chartType}
              periodDays={PERIOD_DAYS}
              allPeriods={activePeriods as any}
              currentPrice={stockData.current_price}
              showVolumeProfile={showVolumeProfile}
              srData={srData[selectedId] || null}
              roundedSupport={roundedSupport || undefined}
              roundedResistance={roundedResistance || undefined}
              currentPeriod={period}
              aiSummary={aiSummary}
            />
          </div>
        </div>

        {/* 收合面板 */}
        <SidePanel
          data={stockData}
          periodData={periodData_sidebar}
          open={panelOpen}
          period={period}
          onToggle={() => setPanelOpen((v) => !v)}
          onPeriodChange={handlePeriodChange}
          contentData={contentData[selectedId] || null}
          srData={srData[selectedId] || null}
        />
      </div>
    </div>
  );
}
