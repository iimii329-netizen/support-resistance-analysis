'use client';

import { useState, useEffect, useMemo } from 'react';
import { StockData, Timeframe, PeriodName } from './types';
import KLineChart    from './components/KLineChart';
import StockSelector from './components/StockSelector';
import SidePanel     from './components/SidePanel';
import { processBands } from './utils/calcBands';
import { mockAIPrompt } from './utils/mockAIPrompt';

// 各期別的預設 K 線頻率
const PERIOD_DEFAULT_TF: Record<PeriodName, Timeframe> = {
  short:  '15m',
  medium: '1d',
  long:   '1d',
};

export default function Home() {
  const [stocks,     setStocks]     = useState<Record<string, StockData>>({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [period,     setPeriod]     = useState<PeriodName>('short');
  const [timeframe,  setTimeframe]  = useState<Timeframe>(PERIOD_DEFAULT_TF.short);
  const [panelOpen,  setPanelOpen]  = useState(false); // 預設收合

  // 載入資料
  useEffect(() => {
    fetch('/data/stocks.json')
      .then((r) => r.json())
      .then((d: Record<string, StockData>) => {
        setStocks(d);
        const first = Object.keys(d)[0];
        if (first) setSelectedId(first);
      });
  }, []);

  // 切換 period 時，K 線頻率自動跳到預設值
  const handlePeriodChange = (p: PeriodName) => {
    setPeriod(p);
    setTimeframe(PERIOD_DEFAULT_TF[p]);
  };

  const stockList  = useMemo(() => Object.values(stocks), [stocks]);
  const stockData  = stocks[selectedId];

  if (!stockData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        載入中…
      </div>
    );
  }

  const bars        = stockData.klines[timeframe];
  const origPeriodData  = stockData.periods[period];

  const processedSup = processBands(origPeriodData.all_support || [], 'support');
  const processedRes = processBands(origPeriodData.all_resistance || [], 'resistance');

  if (processedSup.main) {
    processedSup.main.summary = mockAIPrompt(processedSup.main, 'support', stockData.current_price);
  }
  if (processedRes.main) {
    processedRes.main.summary = mockAIPrompt(processedRes.main, 'resistance', stockData.current_price);
  }

  const periodData = {
    ...origPeriodData,
    support: processedSup.main,
    resistance: processedRes.main,
    all_support: processedSup.filtered,
    all_resistance: processedRes.filtered,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* 選股列 */}
      <StockSelector
        stocks={stockList}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); }}
      />

      {/* 主體：K 線圖 + 收合面板 */}
      <div className="flex flex-1 items-stretch">
        {/* K 線圖（含右側頻率切換）*/}
        <div className="flex-1 min-w-0 p-3">
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <KLineChart
              bars={bars}
              period={periodData}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </div>
        </div>

        {/* 收合面板 */}
        <SidePanel
          data={stockData}
          periodData={periodData}
          open={panelOpen}
          period={period}
          onToggle={() => setPanelOpen((v) => !v)}
          onPeriodChange={handlePeriodChange}
        />
      </div>
    </div>
  );
}
