'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi, UTCTimestamp, Time } from 'lightweight-charts';
import { Bar, PeriodAnalysis, Timeframe } from '../types';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '5m', label: '5分' },
  { key: '15m', label: '15分' },
  { key: '60m', label: '60分' },
  { key: '1d', label: '日K' },
  { key: '1w', label: '週K' },
];

interface ChartProps {
  bars: Bar[];
  period: PeriodAnalysis;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

// 修正：明確回傳 UTCTimestamp 型別，解決 Vercel 編譯錯誤
function toUnix(timeStr: string): UTCTimestamp {
  const parts = timeStr.split(' ');
  const [y, m, d] = parts[0].split('/');
  const hh = parts[1] ? Number(parts[1].split(':')[0]) : 0;
  const mm = parts[1] ? Number(parts[1].split(':')[1]) : 0;
  return Math.floor(Date.UTC(+y, +m - 1, +d, hh, mm) / 1000) as UTCTimestamp;
}

const VP_WIDTH = 72;
const RIGHT_MARGIN = 58;

export default function KLineChart({ bars, period, timeframe, onTimeframeChange }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const series = seriesRef.current;
    if (!canvas || !series) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const chartW = w - VP_WIDTH - RIGHT_MARGIN;

    const vp = period.vp;
    if (vp?.valid && vp.bins.length > 0) {
      const tick = vp.tick;
      const maxBarW = VP_WIDTH - 8;

      for (const bin of vp.bins) {
        const yTop = series.priceToCoordinate(bin.price + tick / 2);
        const yBot = series.priceToCoordinate(bin.price - tick / 2);
        if (yTop === null || yBot === null) continue;
        const barH = Math.max(Math.abs(yBot - yTop), 2);
        const barW = Math.max(bin.width * maxBarW, 2);
        const y = Math.min(yTop, yBot);

        const isPOC = bin.price === vp.poc;
        const inVA = vp.val !== null && vp.vah !== null
          && bin.price >= vp.val && bin.price <= vp.vah;

        ctx.fillStyle = isPOC ? 'rgba(255,140,0,0.85)'
          : inVA ? 'rgba(41,121,255,0.45)'
            : 'rgba(160,160,160,0.22)';
        ctx.fillRect(4, y + 0.5, barW, barH - 1);

        ctx.strokeStyle = isPOC ? 'rgba(255,120,0,0.55)'
          : inVA ? 'rgba(41,121,255,0.28)'
            : 'rgba(160,160,160,0.12)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(4, y + 0.5, barW, barH - 1);
      }

      ctx.strokeStyle = 'rgba(100,100,100,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VP_WIDTH, 0);
      ctx.lineTo(VP_WIDTH, h);
      ctx.stroke();
    }

    const sup = period.support;
    if (sup?.range_low !== undefined && sup?.range_high !== undefined) {
      const yTop = series.priceToCoordinate(sup.range_high);
      const yBot = series.priceToCoordinate(sup.range_low);
      if (yTop !== null && yBot !== null) {
        const y = Math.min(yTop, yBot);
        const bandH = Math.max(Math.abs(yBot - yTop), 3);
        ctx.fillStyle = 'rgba(33,150,243,0.12)';
        ctx.fillRect(VP_WIDTH, y, chartW, bandH);
        ctx.fillStyle = 'rgba(33,150,243,0.55)';
        ctx.fillRect(VP_WIDTH, y, chartW, 2);
      }
    }

    const res = period.resistance;
    if (res?.range_low !== undefined && res?.range_high !== undefined) {
      const yTop = series.priceToCoordinate(res.range_high);
      const yBot = series.priceToCoordinate(res.range_low);
      if (yTop !== null && yBot !== null) {
        const y = Math.min(yTop, yBot);
        const bandH = Math.max(Math.abs(yBot - yTop), 3);
        ctx.fillStyle = 'rgba(239,83,80,0.12)';
        ctx.fillRect(VP_WIDTH, y, chartW, bandH);
        ctx.fillStyle = 'rgba(239,83,80,0.55)';
        ctx.fillRect(VP_WIDTH, y + bandH - 2, chartW, 2);
      }
    }
  }, [period]);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    if (chartRef.current) { chartRef.current.remove(); }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { color: 'transparent' },
        textColor: '#999',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.04)' },
        horzLines: { color: 'rgba(0,0,0,0.04)' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(0,0,0,0.08)' },
      localization: {
        timeFormatter: (ts: number) => {
          const d = new Date(ts * 1000);
          const dateStr = `${d.getUTCFullYear()}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCDate().toString().padStart(2, '0')}`;
          if (timeframe === '1d' || timeframe === '1w') return dateStr;
          return `${dateStr} ${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
        },
      },
      timeScale: {
        borderColor: 'rgba(0,0,0,0.08)',
        timeVisible: timeframe !== '1d' && timeframe !== '1w',
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef5350', downColor: '#26a69a',
      borderVisible: false,
      wickUpColor: '#ef5350', wickDownColor: '#26a69a',
      priceLineVisible: false, lastValueVisible: false,
    });
    seriesRef.current = candleSeries;
    
    // 這裡使用修正後的 toUnix
    candleSeries.setData(
      bars.map((b) => ({
        time: toUnix(b.time),
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
    );

    const anchorSeries = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)', lineWidth: 1,
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false, pointMarkersVisible: false,
    });

    const firstT = toUnix(bars[0].time);
    const lastT = toUnix(bars[bars.length - 1].time);
    const midT = Math.floor((firstT as number + lastT as number) / 2) as UTCTimestamp;
    const anchors: { time: Time; value: number }[] = [];

    if (period.support?.range_low !== undefined) {
      anchors.push({ time: firstT, value: period.support.range_low });
    }
    if (period.resistance?.range_high !== undefined) {
      anchors.push({ time: lastT, value: period.resistance.range_high });
    }
    if (period.support?.range_high !== undefined && period.resistance?.range_low !== undefined) {
      anchors.push({ time: midT, value: period.support.range_high });
      anchors.push({ time: midT, value: period.resistance.range_low });
    }
    
    anchors.sort((a, b) => (a.time as number) - (b.time as number));
    const uniqueAnchors = anchors.filter(
      (a, i) => i === 0 || (a.time as number) !== (anchors[i - 1].time as number)
    );
    if (uniqueAnchors.length > 0) anchorSeries.setData(uniqueAnchors);

    if (period.support) {
      candleSeries.createPriceLine({
        price: period.support.price,
        color: '#2196F3',
        lineWidth: 1, lineStyle: 0,
        axisLabelVisible: true,
        axisLabelColor: '#2196F3',
        axisLabelTextColor: '#fff',
      });
    }
    if (period.resistance) {
      candleSeries.createPriceLine({
        price: period.resistance.price,
        color: '#EF5350',
        lineWidth: 1, lineStyle: 0,
        axisLabelVisible: true,
        axisLabelColor: '#EF5350',
        axisLabelTextColor: '#fff',
      });
    }

    chart.timeScale().fitContent();

    const triggerDraw = () => requestAnimationFrame(drawOverlay);
    triggerDraw();

    chart.timeScale().subscribeVisibleTimeRangeChange(triggerDraw);
    chart.timeScale().subscribeVisibleLogicalRangeChange(triggerDraw);

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || entries[0].target !== containerRef.current) return;
      chart.applyOptions({ width: entries[0].contentRect.width });
      requestAnimationFrame(drawOverlay);
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, timeframe, period.support?.price, period.resistance?.price, drawOverlay]);

  useEffect(() => {
    requestAnimationFrame(drawOverlay);
  }, [period, drawOverlay]);

  return (
    <div className="flex w-full">
      <div className="relative flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
        <canvas
          ref={overlayRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: '100%', height: '380px' }}
        />
      </div>

      <div className="flex flex-col border-l border-gray-200 bg-gray-50 select-none">
        {TIMEFRAMES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onTimeframeChange(key)}
            className={[
              'px-3 py-2 text-xs font-medium text-left transition-colors',
              'border-b border-gray-200 last:border-b-0',
              timeframe === key
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}