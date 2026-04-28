'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { Bar, PeriodAnalysis, Timeframe, PeriodName } from '../types';
import { analyzeVolumeProfile } from '../utils/vpAnalysis';

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

const PRICE_SCALE_WIDTH = 60;
const BLANK_BARS = 5;          // 右側空白K棒數
const TRANSPARENCY = 0.5;

// 短期=黃色, 中期=紫色, 長期=藍色
const PERIOD_COLORS: Record<PeriodName, { support: string; resistance: string; vp: string }> = {
  short:  {
    support:    '#EAB308',
    resistance: '#EAB308',
    vp: `rgba(234, 179, 8, ${TRANSPARENCY})`,
  },
  medium: {
    support:    '#9333EA',
    resistance: '#9333EA',
    vp: `rgba(147, 51, 234, ${TRANSPARENCY})`,
  },
  long:   {
    support:    '#2563EB',
    resistance: '#2563EB',
    vp: `rgba(37, 99, 235, ${TRANSPARENCY})`,
  },
};

// 各期別預設顯示K棒數
const PERIOD_DAY_MAP: Record<PeriodName, number> = {
  short:  20,
  medium: 40,
  long:   80,
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
  const chartRef     = useRef<IChartApi | null>(null);
  const overlayRef   = useRef<HTMLCanvasElement | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Candlestick' | 'Line'> | null>(null);
  const isInitializedRef    = useRef(false);
  const lastPeriodStateRef  = useRef<{ periods: string; barsLength: number } | null>(null);
  const [vpAnalysis, setVpAnalysis] = useState<string>('');

  const requiredDays = Math.max(
    ...Object.entries(showPeriods)
      .filter(([_, show]) => show)
      .map(([pName]) => periodDays[pName as PeriodName]),
    20
  );

  // 生成 VP 分析文字
  useEffect(() => {
    const shortPeriod = allPeriods.short;
    if (shortPeriod?.vp) {
      const closePrice = bars.length > 0 ? bars[bars.length - 1].close : currentPrice;
      const analysis = analyzeVolumeProfile(shortPeriod.vp, currentPrice, closePrice);
      if (analysis) setVpAnalysis(analysis.summary);
    }
  }, [allPeriods, bars, currentPrice]);

  // 計算各期別對應的 K 棒價格範圍（用於 VP 過濾）
  const getPriceRange = useCallback((days: number): { min: number; max: number } => {
    if (bars.length === 0) return { min: 0, max: 0 };
    const startIdx = Math.max(0, bars.length - days);
    const slice = bars.slice(startIdx);
    return {
      min: Math.min(...slice.map((b) => b.low)),
      max: Math.max(...slice.map((b) => b.high)),
    };
  }, [bars]);

  // 繪製 overlay（VP 從左往右、支撐壓力線）
  const drawOverlay = useCallback((): void => {
    const canvas    = overlayRef.current;
    const series    = seriesRef.current;
    const container = containerRef.current;
    const chart     = chartRef.current;
    if (!canvas || !series || !container || !chart) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const chartContentWidth = w - PRICE_SCALE_WIDTH;
    const activePeriods = (['short', 'medium', 'long'] as PeriodName[]).filter((p) => showPeriods[p]);

    const priceRangeDays: Record<PeriodName, number> = { short: 20, medium: 40, long: 80 };
    const priceRanges: Record<PeriodName, { min: number; max: number }> = {
      short:  getPriceRange(priceRangeDays.short),
      medium: getPriceRange(priceRangeDays.medium),
      long:   getPriceRange(priceRangeDays.long),
    };

    activePeriods.forEach((periodName) => {
      const periodData = allPeriods[periodName];
      if (!periodData) return;
      const colors = PERIOD_COLORS[periodName];

      // ── VP：由左往右，全寬，無空隙 ──
      const vp = periodData.vp;
      const priceRange = priceRanges[periodName];

      if (showVolumeProfile && vp?.valid && vp.bins?.length && priceRange) {
        const tick = vp.tick || 1;

        const filteredBins = vp.bins.filter(
          (bin) => bin.price >= priceRange.min && bin.price <= priceRange.max
        );

        if (filteredBins.length > 0) {
          const maxVolume = Math.max(...filteredBins.map((b) => b.volume || 0)) || 1;

          // 依價格由低到高排序，確保相鄰邊界無空隙
          const sortedBins = [...filteredBins].sort((a, b) => a.price - b.price);

          sortedBins.forEach((bin, i) => {
            const prevBin = sortedBins[i - 1];
            const nextBin = sortedBins[i + 1];

            // 相鄰中點作為邊界（確保無空隙）
            const topPrice = nextBin
              ? (bin.price + nextBin.price) / 2
              : bin.price + tick / 2;
            const botPrice = prevBin
              ? (bin.price + prevBin.price) / 2
              : bin.price - tick / 2;

            const yTop = series.priceToCoordinate(topPrice);
            const yBot = series.priceToCoordinate(botPrice);
            if (yTop === null || yBot === null) return;

            const barH = Math.abs(yBot - yTop);
            if (barH <= 0) return;

            const bucketVolume = bin.volume || 0;
            const barWidth = (bucketVolume / maxVolume) * chartContentWidth;
            if (barWidth <= 0) return;

            const y = Math.min(yTop, yBot);
            ctx.fillStyle = colors.vp;
            ctx.fillRect(0, y, barWidth, barH);
          });
        }
      }

      // ── 支撐線 ──
      let supportPrice: number | undefined;
      if (roundedSupport !== undefined && periodName === currentPeriod) {
        supportPrice = roundedSupport;
      } else if (srData?.[periodName]?.support) {
        supportPrice = srData[periodName].support.value;
      } else if (periodData.support?.price !== undefined) {
        supportPrice = periodData.support.price;
      }

      if (supportPrice !== undefined) {
        const yPrice = series.priceToCoordinate(supportPrice);
        if (yPrice !== null && !isNaN(yPrice) && yPrice >= 0 && yPrice <= h) {
          // 延伸至整個畫面（含右側空白區）
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 4;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(w, yPrice);
          ctx.stroke();

          ctx.strokeStyle = colors.support;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(w, yPrice);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = colors.support;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(supportPrice.toFixed(2).replace(/\.?0+$/, ''), 5, yPrice - 6);
        }
      }

      // ── 壓力線 ──
      let resistancePrice: number | undefined;
      if (roundedResistance !== undefined && periodName === currentPeriod) {
        resistancePrice = roundedResistance;
      } else if (srData?.[periodName]?.resistance) {
        resistancePrice = srData[periodName].resistance.value;
      } else if (periodData.resistance?.price !== undefined) {
        resistancePrice = periodData.resistance.price;
      }

      if (resistancePrice !== undefined) {
        const yPrice = series.priceToCoordinate(resistancePrice);
        if (yPrice !== null && !isNaN(yPrice) && yPrice >= 0 && yPrice <= h) {
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 4;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(w, yPrice);
          ctx.stroke();

          ctx.strokeStyle = colors.resistance;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yPrice);
          ctx.lineTo(w, yPrice);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = colors.resistance;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(resistancePrice.toFixed(2).replace(/\.?0+$/, ''), 5, yPrice + 14);
        }
      }
    });
  }, [showPeriods, allPeriods, bars, showVolumeProfile, srData, roundedSupport, roundedResistance, currentPeriod, getPriceRange]);

  // 建立/重建 chart
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    if (chartRef.current) chartRef.current.remove();

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#999',
        fontSize: 14,
      },
      grid: {
        vertLines: { color: 'rgba(200,200,200,0.08)' },
        horzLines: { color: 'rgba(200,200,200,0.08)' },
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
      handleScale: {
        mouseWheel: false,
      },
    });
    chartRef.current = chart;

    if (chartType === 'candlestick') {
      const cs = chart.addSeries(CandlestickSeries, {
        upColor:        '#ef5350',
        downColor:      '#26a69a',
        borderVisible:  false,
        wickUpColor:    '#ef5350',
        wickDownColor:  '#26a69a',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      seriesRef.current = cs;
      cs.setData(bars.map((b) => ({
        time:  toUnix(b.time),
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      })));
    } else {
      const ls = chart.addSeries(LineSeries, {
        color: '#2196F3',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      seriesRef.current = ls;
      ls.setData(bars.map((b) => ({ time: toUnix(b.time), value: b.close })));
    }

    // 初始可見範圍：requiredDays 根K棒 + 5根空白
    let initTimeoutId: ReturnType<typeof setTimeout> | null = null;
    if (!isInitializedRef.current) {
      try { chart.timeScale().fitContent(); } catch (_) {}

      initTimeoutId = setTimeout(() => {
        try {
          if (!chartRef.current) return;
          const total = bars.length;
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: total - 1 - requiredDays,
            to:   total - 1 + BLANK_BARS + 0.5,
          });
          isInitializedRef.current = true;
        } catch (_) {}
      }, 100);
    }

    // Canvas 初始化
    const initCanvas = () => {
      const canvas    = overlayRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
      }
    };
    initCanvas();
    const canvasTimeoutId = setTimeout(initCanvas, 50);

    // 滑鼠滾輪縮放：固定右邊界（含5根空白），調整左側
    const handleWheel = (e: WheelEvent) => {
      if (!chartRef.current) return;
      const lr = chartRef.current.timeScale().getVisibleLogicalRange();
      if (!lr) return;
      e.preventDefault();

      const zoomFactor  = e.deltaY > 0 ? 1.2 : 0.8;
      const newDuration = (lr.to - lr.from) * zoomFactor;

      chartRef.current.timeScale().setVisibleLogicalRange({
        from: lr.to - newDuration,
        to:   lr.to,
      });
    };

    containerRef.current.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      if (initTimeoutId)  clearTimeout(initTimeoutId);
      if (canvasTimeoutId) clearTimeout(canvasTimeoutId);
      resizeObserver.disconnect();
      containerRef.current?.removeEventListener('wheel', handleWheel);
      isInitializedRef.current   = false;
      lastPeriodStateRef.current = null;
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, [bars, chartType]);

  // 訂閱 chart 事件 → 重繪 overlay
  useEffect(() => {
    if (!chartRef.current) return;
    const handleRedraw = () => requestAnimationFrame(drawOverlay);
    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleRedraw);
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleRedraw);
    return () => {
      try {
        chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(handleRedraw);
        chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleRedraw);
      } catch (_) {}
    };
  }, [drawOverlay]);

  // showPeriods 改變 → 重繪
  useEffect(() => {
    if (seriesRef.current) requestAnimationFrame(drawOverlay);
  }, [showPeriods, drawOverlay]);

  // showPeriods 改變 → 設定對應可見範圍
  useEffect(() => {
    if (!chartRef.current || bars.length === 0) return;

    const checked = (['short', 'medium', 'long'] as PeriodName[]).filter((p) => showPeriods[p]);
    const stateKey = checked.join(',') + '|' + bars.length;
    const lastKey  = lastPeriodStateRef.current?.periods + '|' + lastPeriodStateRef.current?.barsLength;
    if (stateKey === lastKey) return;
    lastPeriodStateRef.current = { periods: checked.join(','), barsLength: bars.length };

    const barsToShow = checked.length > 0
      ? Math.max(...checked.map((p) => PERIOD_DAY_MAP[p]))
      : 20;

    try {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: bars.length - 1 - barsToShow,
        to:   bars.length - 1 + BLANK_BARS + 0.5,
      });
    } catch (_) {}
  }, [showPeriods, bars]);

  return (
    <div className="flex flex-col w-full h-full bg-white">
      {aiSummary && (
        <div className="px-5 py-2 border-b border-blue-100 bg-blue-50">
          <p className="text-sm text-blue-800 leading-relaxed">{aiSummary}</p>
        </div>
      )}

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
