'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi, UTCTimestamp, Time } from 'lightweight-charts';
import { Bar, PeriodAnalysis, Timeframe, PeriodName } from '../types';
import { analyzeVolumeProfile } from '../utils/vpAnalysis';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1d', label: '' },
];

interface ChartProps {
  bars: Bar[];
  period: PeriodAnalysis;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  showPeriods: Record<PeriodName, boolean>;
  chartType: 'candlestick' | 'line';
  periodDays: Record<PeriodName, number>;
  allPeriods: Record<PeriodName, PeriodAnalysis>;
  currentPrice: number;
  showVolumeProfile?: boolean;
  srData?: any;
  roundedSupport?: number;
  roundedResistance?: number;
  currentPeriod?: PeriodName;
  aiSummary?: string;
}

function toUnix(timeStr: string): UTCTimestamp {
  const parts = timeStr.split(' ');
  const [y, m, d] = parts[0].split('/');
  const hh = parts[1] ? Number(parts[1].split(':')[0]) : 0;
  const mm = parts[1] ? Number(parts[1].split(':')[1]) : 0;
  return Math.floor(Date.UTC(+y, +m - 1, +d, hh, mm) / 1000) as UTCTimestamp;
}

// VP 布局配置
const VP_CONFIG = {
  PRICE_SCALE_WIDTH: 60,    // Y軸寬度（估算值）
  RIGHT_MARGIN: 50,         // 右側邊距（避開Y軸標籤）
  BASE_WIDTH_PER_BAR: 5,    // 單根K棒基礎寬度（像素）
  VP_PADDING: 0,            // VP內部邊距
  TRANSPARENCY: 0.5,        // VP透明度
};

// 期別對應的交易日數（用於計算 VP 最大寬度）
const PERIOD_DAY_MAP: Record<PeriodName, number> = {
  short: 5,
  medium: 20,
  long: 60,
};

const PERIOD_COLORS: Record<PeriodName, { support: string; resistance: string; vp: string }> = {
  short: { support: '#ef5350', resistance: '#ef5350', vp: `rgba(239, 83, 80, ${VP_CONFIG.TRANSPARENCY})` },
  medium: { support: '#2196F3', resistance: '#2196F3', vp: `rgba(33, 150, 243, ${VP_CONFIG.TRANSPARENCY})` },
  long: { support: '#4caf50', resistance: '#4caf50', vp: `rgba(76, 175, 80, ${VP_CONFIG.TRANSPARENCY})` },
};

export default function KLineChart({
  bars,
  period,
  timeframe,
  onTimeframeChange,
  showPeriods,
  chartType,
  periodDays,
  allPeriods,
  currentPrice,
  showVolumeProfile = true,
  srData,
  roundedSupport,
  roundedResistance,
  currentPeriod = 'short',
  aiSummary = '',
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick' | 'Line'> | null>(null);
  const lastVisibleRangeRef = useRef<{ from: UTCTimestamp; to: UTCTimestamp } | null>(null);
  const [vpAnalysis, setVpAnalysis] = useState<string>('');
  const debugCounterRef = useRef(0);

  // 根據showPeriods計算需要的K線數量（用於設置初始可見範圍）
  const requiredDays = Math.max(
    ...Object.entries(showPeriods)
      .filter(([_, show]) => show)
      .map(([periodName]) => periodDays[periodName as PeriodName]),
    20
  );

  // 保持所有K線數據（不截取），傳給圖表
  const displayBars = bars;

  // 計算每個期別對應的K線數量和價格範圍（用於VP過濾）
  const calculatePriceRange = (periodDays: number): { min: number; max: number } => {
    if (displayBars.length === 0) return { min: 0, max: 0 };

    const startIdx = Math.max(0, displayBars.length - periodDays);
    const relevantBars = displayBars.slice(startIdx);

    let minPrice = Infinity;
    let maxPrice = -Infinity;

    relevantBars.forEach((bar) => {
      minPrice = Math.min(minPrice, bar.low);
      maxPrice = Math.max(maxPrice, bar.high);
    });

    return { min: minPrice, max: maxPrice };
  };

  const priceRanges: Record<PeriodName, { min: number; max: number }> = {
    short: calculatePriceRange(5),    // 最近 5 個交易日
    medium: calculatePriceRange(20),  // 最近 20 個交易日
    long: calculatePriceRange(60),    // 最近 60 個交易日
  };

  // 生成 VP 分析文字
  useEffect(() => {
    const activeShortPeriod = allPeriods.short;
    if (activeShortPeriod && activeShortPeriod.vp) {
      const closePrice = bars.length > 0 ? bars[bars.length - 1].close : currentPrice;
      const analysis = analyzeVolumeProfile(activeShortPeriod.vp, currentPrice, closePrice);
      if (analysis) {
        setVpAnalysis(analysis.summary);
      }
    }
  }, [allPeriods, bars, currentPrice]);

  // 繪製overlay（VP和支撐壓力線）
  const drawOverlay = useCallback((): void => {
    const canvas = overlayRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    const chart = chartRef.current;

    if (!canvas || !series || !container || !chart) {
      console.warn('[DrawOverlay] Missing refs:', { canvas: !!canvas, series: !!series, container: !!container, chart: !!chart });
      return;
    }

    // 計算每個期別對應的價格範圍（用於 VP 過濾）
    const calculatePriceRange = (days: number): { min: number; max: number } => {
      if (bars.length === 0) return { min: 0, max: 0 };
      const startIdx = Math.max(0, bars.length - days);
      const relevantBars = bars.slice(startIdx);
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      relevantBars.forEach((bar) => {
        minPrice = Math.min(minPrice, bar.low);
        maxPrice = Math.max(maxPrice, bar.high);
      });
      return { min: minPrice, max: maxPrice };
    };

    const priceRanges: Record<PeriodName, { min: number; max: number }> = {
      short: calculatePriceRange(5),
      medium: calculatePriceRange(20),
      long: calculatePriceRange(60),
    };

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[DrawOverlay] Failed to get 2D context');
      return;
    }

    // ========== 步驟 1：強制數據驗證 ==========
    debugCounterRef.current++;
    const debugId = debugCounterRef.current;
    const activePeriods = (['short', 'medium', 'long'] as PeriodName[]).filter(p => showPeriods[p]);

    console.log(`[DrawOverlay #${debugId}] ===== 繪製週期開始 =====`);
    console.log(`[DrawOverlay #${debugId}] Active periods:`, activePeriods);
    console.log(`[DrawOverlay #${debugId}] Show periods:`, showPeriods);

    // 驗證每個 period 的數據
    activePeriods.forEach(pName => {
      const pData = allPeriods[pName];
      console.log(`[DrawOverlay #${debugId}] Period [${pName}]:`, {
        hasData: !!pData,
        supportPrice: pData?.support?.price,
        resistancePrice: pData?.resistance?.price,
        vpValid: pData?.vp?.valid,
        vpBinsCount: pData?.vp?.bins?.length || 0,
        vpPOC: pData?.vp?.poc,
        vpVAH: pData?.vp?.vah,
        vpVAL: pData?.vp?.val,
      });
    });

    // ========== 步驟 2：Canvas 尺寸和 DPI 驗證 ==========
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    console.log(`[DrawOverlay #${debugId}] Canvas dimensions:`, {
      containerWidth: w,
      containerHeight: h,
      dpr: dpr,
      scaledWidth: w * dpr,
      scaledHeight: h * dpr,
    });

    if (w <= 0 || h <= 0) {
      console.error(`[DrawOverlay #${debugId}] Invalid canvas dimensions: w=${w}, h=${h}`);
      return;
    }

    // 正確設置 canvas 物理尺寸和邏輯尺寸
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    console.log(`[DrawOverlay #${debugId}] Canvas cleared and scaled. Ready for drawing.`);

    // ========== 計算 K 棒間距（用於動態調整 VP 寬度）==========
    const chartContentWidth = w - VP_CONFIG.PRICE_SCALE_WIDTH;
    let barSpacing = VP_CONFIG.BASE_WIDTH_PER_BAR; // 預設值
    let visibleBarCount = 20; // 預設值

    // 嘗試透過 logicalRange 計算可見 K 棒數量
    try {
      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      if (logicalRange) {
        visibleBarCount = Math.max(1, logicalRange.to - logicalRange.from);
        barSpacing = Math.max(2, chartContentWidth / visibleBarCount);
        console.log(`[DrawOverlay #${debugId}] K棒間距計算（邏輯範圍）:`, {
          visibleBarCount: visibleBarCount.toFixed(0),
          chartContentWidth: chartContentWidth,
          barSpacing: barSpacing.toFixed(2),
        });
      }
    } catch (e) {
      // fallback to time range
      const visibleRange = chart.timeScale().getVisibleRange();
      if (visibleRange && bars.length > 1) {
        const rangeLength = visibleRange.to - visibleRange.from;
        barSpacing = Math.max(2, chartContentWidth / Math.max(rangeLength, 1));
        console.log(`[DrawOverlay #${debugId}] K棒間距計算（時間範圍）:`, {
          rangeLength: rangeLength,
          chartContentWidth: chartContentWidth,
          barSpacing: barSpacing.toFixed(2),
        });
      }
    }

    // ========== 步驟 3：繪製每個 period ==========
    activePeriods.forEach((periodName) => {
      const periodData = allPeriods[periodName];
      const colors = PERIOD_COLORS[periodName];

      if (!periodData) {
        console.warn(`[DrawOverlay #${debugId}] Period [${periodName}] has no data`);
        return;
      }

      console.log(`[DrawOverlay #${debugId}] ===== 開始繪製 ${periodName} =====`);

      // ========== 3a. 繪製 Volume Profile (VP) - 按時間範圍過濾、動態寬度 ==========
      const vp = periodData.vp;
      const priceRange = priceRanges[periodName];

      if (showVolumeProfile && vp && vp.valid && vp.bins && vp.bins.length > 0 && priceRange) {
        // 過濾 bins：只保留在對應期別時間範圍內的價格柱
        const filteredBins = vp.bins.filter(bin =>
          bin.price >= priceRange.min && bin.price <= priceRange.max
        );

        const tick = vp.tick || 1;

        // ========== 精確寬度計算 ==========
        // 該期別的總寬度 = 交易日數 * K棒間距
        const periodDaysCount = PERIOD_DAY_MAP[periodName];
        const vpTotalWidth = periodDaysCount * barSpacing;

        // 計算最大成交量（基於已過濾的 bins）
        const maxVolume = filteredBins.length > 0
          ? Math.max(...filteredBins.map(b => b.volume || 0))
          : 1; // 避免除以 0

        // VP 右邊界位置：從 chartContentWidth 開始向左畫
        const vpChartRightX = chartContentWidth;

        let vpDrawnCount = 0;
        filteredBins.forEach((bin, binIdx) => {
          // 座標轉換：價格 -> Canvas Y
          const yTop = series.priceToCoordinate(bin.price + tick / 2);
          const yBot = series.priceToCoordinate(bin.price - tick / 2);

          if (yTop === null || yBot === null) {
            return;
          }

          const barH = Math.abs(yBot - yTop);
          if (barH <= 0) return; // 高度必須 > 0

          // ========== 水平縮放比例計算 ==========
          // currentBucketWidth = (currentBucketVolume / maxVolume) * 該週期的總寬度
          const bucketVolume = bin.volume || 0;
          const normalizedRatio = bucketVolume / maxVolume;
          const bucketWidth = normalizedRatio * vpTotalWidth;

          if (bucketWidth <= 0) return; // 寬度必須 > 0

          const y = Math.min(yTop, yBot);

          // ========== 渲染指令：從右往左繪製 ==========
          // ctx.fillRect(chartRightEdge - currentBucketWidth, y, currentBucketWidth, bucketHeight)
          const barX = vpChartRightX - bucketWidth;

          // 驗證坐標有效性
          if (isNaN(y) || isNaN(bucketWidth) || isNaN(barH) || isNaN(barX)) {
            return;
          }

          if (vpDrawnCount === 0) {
            console.log(`[DrawOverlay #${debugId}] VP [${periodName}] 精確計算驗證:`, {
              期別: periodName,
              K棒間距: barSpacing.toFixed(2),
              交易日數: periodDaysCount,
              VP總寬度: vpTotalWidth.toFixed(2),
              可見K棒數: visibleBarCount,
              maxVolume: maxVolume,
              價格範圍: `[${priceRange.min.toFixed(2)}, ${priceRange.max.toFixed(2)}]`,
              原始bins數: vp.bins.length,
              過濾後bins數: filteredBins.length,
              第一柱: {
                price: filteredBins[0]?.price,
                volume: filteredBins[0]?.volume,
                計算寬度: (filteredBins[0]?.volume ? (filteredBins[0].volume / maxVolume * vpTotalWidth).toFixed(2) : 'N/A'),
              },
            });
          }

          ctx.fillStyle = colors.vp;
          ctx.fillRect(barX, y, bucketWidth, barH);
          vpDrawnCount++;
        });

        console.log(`[DrawOverlay #${debugId}] VP [${periodName}] 繪製完成: ${vpDrawnCount}/${filteredBins.length} 柱, 右邊界: ${vpChartRightX.toFixed(0)}, 總寬度: ${vpTotalWidth.toFixed(2)}px`);
      } else {
        console.log(`[DrawOverlay #${debugId}] VP [${periodName}] 無效或無數據或無價格範圍`, {
          hasVp: !!vp,
          hasRange: !!priceRange,
          bins: vp?.bins?.length,
        });
      }

      // ========== 3b. 繪製支撐線 (Support) ==========
      // 優先使用roundedSupport（如果是當前period），否則使用srData，最後使用allPeriods
      let supportPrice: number | undefined;
      if (roundedSupport !== undefined && periodName === currentPeriod) {
        supportPrice = roundedSupport;
      } else if (srData && srData[periodName] && srData[periodName].support) {
        supportPrice = srData[periodName].support.value;
      } else if (periodData.support && periodData.support.price !== undefined) {
        supportPrice = periodData.support.price;
      }

      if (supportPrice !== undefined) {
        const yPrice = series.priceToCoordinate(supportPrice);

        console.log(`[DrawOverlay #${debugId}] Support [${periodName}]:`, {
          price: supportPrice,
          yCoord: yPrice,
          isValid: yPrice !== null && !isNaN(yPrice),
        });

        if (yPrice !== null && !isNaN(yPrice) && yPrice >= 0 && yPrice <= h) {
          // 陰影效果
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = 4;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(chartContentWidth, yPrice);
          ctx.stroke();

          // 主線（虛線）
          ctx.strokeStyle = colors.support;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(chartContentWidth, yPrice);
          ctx.stroke();
          ctx.setLineDash([]);

          // 標籤（放在Y軸上）
          ctx.fillStyle = colors.support;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          // 格式化：移除小數點後的0
          const supportLabel = supportPrice.toFixed(2).replace(/\.?0+$/, '');
          ctx.fillText(supportLabel, 5, yPrice - 8);
          ctx.textAlign = 'left';

          console.log(`[DrawOverlay #${debugId}] Support [${periodName}] 線條已繪製`);
        }
      }

      // ========== 3c. 繪製壓力線 (Resistance) ==========
      // 優先使用roundedResistance（如果是當前period），否則使用srData，最後使用allPeriods
      let resistancePrice: number | undefined;
      if (roundedResistance !== undefined && periodName === currentPeriod) {
        resistancePrice = roundedResistance;
      } else if (srData && srData[periodName] && srData[periodName].resistance) {
        resistancePrice = srData[periodName].resistance.value;
      } else if (periodData.resistance && periodData.resistance.price !== undefined) {
        resistancePrice = periodData.resistance.price;
      }

      if (resistancePrice !== undefined) {
        const yPrice = series.priceToCoordinate(resistancePrice);

        console.log(`[DrawOverlay #${debugId}] Resistance [${periodName}]:`, {
          price: resistancePrice,
          yCoord: yPrice,
          isValid: yPrice !== null && !isNaN(yPrice),
        });

        if (yPrice !== null && !isNaN(yPrice) && yPrice >= 0 && yPrice <= h) {
          // 陰影效果
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = 4;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(chartContentWidth, yPrice);
          ctx.stroke();

          // 主線（虛線）
          ctx.strokeStyle = colors.resistance;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(chartContentWidth, yPrice);
          ctx.stroke();
          ctx.setLineDash([]);

          // 標籤（放在Y軸上）
          ctx.fillStyle = colors.resistance;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          // 格式化：移除小數點後的0
          const resistanceLabel = resistancePrice.toFixed(2).replace(/\.?0+$/, '');
          ctx.fillText(resistanceLabel, 5, yPrice + 15);
          ctx.textAlign = 'left';

          console.log(`[DrawOverlay #${debugId}] Resistance [${periodName}] 線條已繪製`);
        }
      }

      console.log(`[DrawOverlay #${debugId}] ===== ${periodName} 繪製完成 =====`);
    });

    console.log(`[DrawOverlay #${debugId}] ===== 繪製週期結束 =====\n`);
  }, [showPeriods, allPeriods, bars, periodDays, showVolumeProfile, srData, roundedSupport, roundedResistance, currentPeriod]);

  useEffect(() => {
    if (!containerRef.current || displayBars.length === 0) return;
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const containerHeight = containerRef.current.clientHeight;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerHeight,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#999',
        fontSize: 14,
      },
      grid: {
        vertLines: { color: 'rgba(200, 200, 200, 0.08)' },
        horzLines: { color: 'rgba(200, 200, 200, 0.08)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: 'rgba(0,0,0,0.1)',
        textColor: '#999',
      },
      timeScale: {
        borderColor: 'rgba(0,0,0,0.1)',
        timeVisible: false,
      },
    });
    chartRef.current = chart;

    if (chartType === 'candlestick') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#ef5350',
        downColor: '#26a69a',
        borderVisible: false,
        wickUpColor: '#ef5350',
        wickDownColor: '#26a69a',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      seriesRef.current = candleSeries;

      candleSeries.setData(
        displayBars.map((b) => ({
          time: toUnix(b.time),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#2196F3',
        lineWidth: 2.5,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      seriesRef.current = lineSeries;

      lineSeries.setData(
        displayBars.map((b) => ({
          time: toUnix(b.time),
          value: b.close,
        }))
      );
    }

    // 設置初始可見範圍：以最新K線為右邊界，顯示requiredDays根K線
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (displayBars.length > 0) {
      // 先調用fitContent以確保圖表初始化
      try {
        chart.timeScale().fitContent();
      } catch (e) {
        // 忽略錯誤
      }

      // 延遲後限制可見範圍
      timeoutId = setTimeout(() => {
        try {
          const totalBars = displayBars.length;
          const startIdx = Math.max(0, totalBars - requiredDays);
          const startBar = displayBars[startIdx];
          const endBar = displayBars[totalBars - 1];

          if (startBar && endBar && chartRef.current) {
            const fromTime = toUnix(startBar.time);
            const toTime = toUnix(endBar.time) + 86400; // +1天，以確保最後一根K線完全顯示
            chartRef.current.timeScale().setVisibleRange({
              from: fromTime,
              to: toTime,
            });
          }
        } catch (e) {
          // 圖表已被銷毀，忽略錯誤
        }
      }, 100);
    }

    // 觸發繪製
    const handleRedraw = () => {
      requestAnimationFrame(drawOverlay);
    };

    handleRedraw();

    // 初始化 overlay canvas 的物理尺寸
    const initCanvasSize = () => {
      const canvas = overlayRef.current;
      const container = containerRef.current;

      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (w > 0 && h > 0) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        console.log(`[Canvas Init] Overlay canvas 物理尺寸設置: ${w}x${h}px (DPI: ${dpr})`);
      }
    };

    initCanvasSize();

    // 延遲重繪，確保 canvas 完全初始化
    const redrawTimeoutId = setTimeout(() => {
      initCanvasSize();
      handleRedraw();
    }, 50);

    chart.timeScale().subscribeVisibleTimeRangeChange(handleRedraw);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRedraw);

    // 添加滑鼠滾輪縮放邏輯：固定右邊界（最新 K 棒位置）
    const handleWheel = (e: WheelEvent) => {
      if (!chartRef.current) return;

      const visibleRange = chartRef.current.timeScale().getVisibleRange();
      if (!visibleRange) return;

      e.preventDefault();

      const currentRange = visibleRange;
      const rangeDuration = currentRange.to - currentRange.from;
      const direction = e.deltaY > 0 ? 1 : -1;
      const zoomFactor = direction > 0 ? 1.1 : 0.9;
      const newDuration = rangeDuration * zoomFactor;

      // 固定右邊界，調整左邊界
      const newFrom = currentRange.to - newDuration;

      chartRef.current.timeScale().setVisibleRange({
        from: newFrom as UTCTimestamp,
        to: currentRange.to,
      });
    };

    if (containerRef.current) {
      containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
        handleRedraw();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (redrawTimeoutId) clearTimeout(redrawTimeoutId);
      resizeObserver.disconnect();
      if (containerRef.current) {
        containerRef.current.removeEventListener('wheel', handleWheel);
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [displayBars, chartType, drawOverlay]);

  // 當showPeriods改變時，更新可見範圍
  useEffect(() => {
    if (!chartRef.current || displayBars.length === 0) return;

    const chart = chartRef.current;
    const timeoutId = setTimeout(() => {
      try {
        const totalBars = displayBars.length;
        const startIdx = Math.max(0, totalBars - requiredDays);
        const startBar = displayBars[startIdx];
        const endBar = displayBars[totalBars - 1];

        if (startBar && endBar && chart) {
          const fromTime = toUnix(startBar.time);
          const toTime = toUnix(endBar.time) + 86400;
          chart.timeScale().setVisibleRange({
            from: fromTime,
            to: toTime,
          });
        }
      } catch (e) {
        // 圖表已被銷毀，忽略錯誤
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [requiredDays, displayBars.length]);

  // 當showPeriods改變時，觸發重繪
  useEffect(() => {
    if (seriesRef.current) {
      requestAnimationFrame(drawOverlay);
    }
  }, [showPeriods, drawOverlay]);

  return (
    <div className="flex flex-col w-full h-full bg-white">
      {/* AI 支撐壓力一句話 */}
      {aiSummary && (
        <div className="px-5 py-2 border-b border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-800 leading-relaxed">
            {aiSummary}
          </p>
        </div>
      )}

      {/* 圖表主體 */}
      <div className="flex flex-1 min-w-0">
        <div className="relative flex-1 min-w-0">
          <div ref={containerRef} className="w-full h-full" />
          <canvas
            ref={overlayRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: '100%', height: '100%', zIndex: 10 }}
          />
        </div>
      </div>
    </div>
  );
}
