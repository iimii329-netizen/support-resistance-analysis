'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { Bar, PeriodAnalysis, Timeframe, PeriodName } from '../types';
import { analyzeVolumeProfile } from '../utils/vpAnalysis';

export interface SRLevel {
  id: string;
  name: string;
  price: number;
  rawValue?: number;
  period: PeriodName;
}

export interface SRZoneData {
  type: string;   // "壓力區" | "壓力線" | "支撐區" | "支撐線"
  low: number;
  high: number;
  ai_sentence: string;
}
export interface SRPeriodAnalysis {
  resistance: SRZoneData;
  support: SRZoneData;
}
export interface SRAnalysis {
  short_term:  SRPeriodAnalysis;
  medium_term: SRPeriodAnalysis;
  long_term:   SRPeriodAnalysis;
}

interface LabelGroup {
  y: number;
  price: number;
  period: PeriodName;
  items: SRLevel[];
  expanded: boolean;
}

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
  selectedSRLevels?: SRLevel[];
  srAnalysis?: SRAnalysis | null;
  aiSummary?: string;
  showAIPeriods?: Record<PeriodName, boolean>;
}

function toUnix(timeStr: string): UTCTimestamp {
  const parts = timeStr.split(' ');
  const [y, m, d] = parts[0].split('/');
  const hh = parts[1] ? Number(parts[1].split(':')[0]) : 0;
  const mm = parts[1] ? Number(parts[1].split(':')[1]) : 0;
  return Math.floor(Date.UTC(+y, +m - 1, +d, hh, mm) / 1000) as UTCTimestamp;
}

const PRICE_SCALE_WIDTH = 70;
const BLANK_BARS = 5;
const TRANSPARENCY = 0.3;

const PERIOD_COLORS: Record<PeriodName, { vp: string; line: string; label: string; labelBg: string }> = {
  short:  { vp: `rgba(234,179,8,${TRANSPARENCY})`,   line: '#EAB308', label: '#92400E', labelBg: '#FEF9C3' },
  medium: { vp: `rgba(147,51,234,${TRANSPARENCY})`,  line: '#9333EA', label: '#4C1D95', labelBg: '#F3E8FF' },
  long:   { vp: `rgba(37,99,235,${TRANSPARENCY})`,   line: '#2563EB', label: '#1E3A8A', labelBg: '#DBEAFE' },
};

// SR Analysis 區塊透明度 50%
const SR_COLORS: Record<PeriodName, { stroke: string; fillR: string; fillS: string; hatch: string }> = {
  short:  { stroke: '#B45309', fillR: 'rgba(180,83,9,0.12)',    fillS: 'rgba(180,83,9,0.12)',    hatch: 'rgba(180,83,9,0.5)'   },
  medium: { stroke: '#6D28D9', fillR: 'rgba(109,40,217,0.12)',  fillS: 'rgba(109,40,217,0.12)',  hatch: 'rgba(109,40,217,0.5)' },
  long:   { stroke: '#1D4ED8', fillR: 'rgba(29,78,216,0.12)',   fillS: 'rgba(29,78,216,0.12)',   hatch: 'rgba(29,78,216,0.5)'  },
};

function drawHatchedZone(
  ctx: CanvasRenderingContext2D,
  x: number, yTop: number, w: number, zoneH: number,
  fillColor: string, hatchColor: string, strokeColor: string
) {
  if (zoneH < 0.5) return;
  // 淡背景
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, yTop, w, zoneH);
  // 斜線（clipped）
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, yTop, w, zoneH);
  ctx.clip();
  ctx.strokeStyle = hatchColor;
  ctx.lineWidth = 1;
  const spacing = 7;
  for (let i = -(zoneH + spacing); i < w + zoneH; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + i, yTop);
    ctx.lineTo(x + i + zoneH + spacing, yTop + zoneH + spacing);
    ctx.stroke();
  }
  ctx.restore();
  // 上下邊框
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x, yTop);          ctx.lineTo(x + w, yTop);          ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, yTop + zoneH);  ctx.lineTo(x + w, yTop + zoneH);  ctx.stroke();
}

const PERIOD_DAY_MAP: Record<PeriodName, number> = { short: 20, medium: 40, long: 80 };

function fmtPrice(p: number): string {
  if (p < 10)  return p.toFixed(2);
  if (p < 100) return p.toFixed(1);
  return p.toFixed(0);
}

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
  selectedSRLevels = [],
  srAnalysis = null,
  aiSummary = '',
  showAIPeriods = { short: true, medium: true, long: true },
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const overlayRef   = useRef<HTMLCanvasElement | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Candlestick' | 'Line'> | null>(null);
  const isInitializedRef    = useRef(false);
  const lastPeriodStateRef  = useRef<{ periods: string; barsLength: number } | null>(null);
  const drawOverlayRef      = useRef<() => void>(() => {});
  const vpCanvasRef         = useRef<HTMLCanvasElement | null>(null);

  const [labelGroups, setLabelGroups]         = useState<LabelGroup[]>([]);
  const [hoveredGroupIdx, setHoveredGroupIdx] = useState<number | null>(null);

  const requiredDays = Math.max(
    ...Object.entries(showPeriods)
      .filter(([_, show]) => show)
      .map(([pName]) => periodDays[pName as PeriodName]),
    20
  );

  const getPriceRange = useCallback((days: number) => {
    if (bars.length === 0) return { min: 0, max: 0 };
    const slice = bars.slice(Math.max(0, bars.length - days));
    return { min: Math.min(...slice.map(b => b.low)), max: Math.max(...slice.map(b => b.high)) };
  }, [bars]);

  // Build label groups from selectedSRLevels
  const buildLabelGroups = useCallback((): LabelGroup[] => {
    if (!seriesRef.current || selectedSRLevels.length === 0) return [];
    const sorted = [...selectedSRLevels].sort((a, b) => a.price - b.price);
    const groups: LabelGroup[] = [];
    for (const lv of sorted) {
      const mergeThreshold = lv.price * 0.005;
      const existing = groups.find(g => Math.abs(g.price - lv.price) <= mergeThreshold);
      if (existing) {
        existing.items.push(lv);
      } else {
        const y = seriesRef.current!.priceToCoordinate(lv.price) ?? 0;
        groups.push({ y, price: lv.price, period: lv.period, items: [lv], expanded: false });
      }
    }
    return groups;
  }, [selectedSRLevels]);

  const refreshLabelPositions = useCallback(() => {
    if (!seriesRef.current) return;
    setLabelGroups(prev => {
      const next = buildLabelGroups();
      // preserve expanded state
      return next.map((g, i) => ({
        ...g,
        expanded: prev[i]?.expanded ?? false,
        y: seriesRef.current!.priceToCoordinate(g.price) ?? g.y,
      }));
    });
  }, [buildLabelGroups]);

  // Draw VP + SR lines on canvas overlay
  const drawOverlay = useCallback((): void => {
    const canvas    = overlayRef.current;
    const vpCanvas  = vpCanvasRef.current;
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

    // VP canvas（繪製在 K 線後方）
    let vpCtx: CanvasRenderingContext2D | null = null;
    if (vpCanvas) {
      vpCanvas.width  = w * dpr;
      vpCanvas.height = h * dpr;
      vpCtx = vpCanvas.getContext('2d');
      if (vpCtx) { vpCtx.scale(dpr, dpr); vpCtx.clearRect(0, 0, w, h); }
    }

    const chartW = w - PRICE_SCALE_WIDTH;
    const activePeriods = (['short', 'medium', 'long'] as PeriodName[]).filter(p => showPeriods[p]);
    const priceRangeDays: Record<PeriodName, number> = { short: 20, medium: 40, long: 80 };

    // ── VP bars → 繪製在 vpCanvas（K 線後方）──
    if (vpCtx) {
      activePeriods.forEach(periodName => {
        const periodData = allPeriods[periodName];
        if (!periodData) return;
        const colors = PERIOD_COLORS[periodName];
        const vp = periodData.vp;
        const priceRange = getPriceRange(priceRangeDays[periodName]);

        if (showVolumeProfile && vp?.valid && vp.bins?.length && priceRange) {
          const tick = vp.tick || 1;
          const filteredBins = vp.bins.filter(b => b.price >= priceRange.min && b.price <= priceRange.max);
          if (filteredBins.length > 0) {
            const maxVolume = Math.max(...filteredBins.map(b => b.volume || 0)) || 1;
            const sortedBins = [...filteredBins].sort((a, b) => a.price - b.price);
            sortedBins.forEach((bin, i) => {
              const prev = sortedBins[i - 1];
              const next = sortedBins[i + 1];
              const topPrice = next ? (bin.price + next.price) / 2 : bin.price + tick / 2;
              const botPrice = prev ? (bin.price + prev.price) / 2 : bin.price - tick / 2;
              const yTop = series.priceToCoordinate(topPrice);
              const yBot = series.priceToCoordinate(botPrice);
              if (yTop === null || yBot === null) return;
              const barH = Math.abs(yBot - yTop);
              if (barH <= 0) return;
              const barWidth = (bin.volume / maxVolume) * chartW;
              if (barWidth <= 0) return;
              vpCtx!.fillStyle = colors.vp;
              vpCtx!.fillRect(0, Math.min(yTop, yBot), barWidth, barH);
            });
          }
        }
      });
    }

    // ── SR Analysis 區塊（勾選成交量時顯示）──
    if (srAnalysis) {
      const periodMap: { period: PeriodName; data: SRPeriodAnalysis }[] = [
        { period: 'short',  data: srAnalysis.short_term  },
        { period: 'medium', data: srAnalysis.medium_term },
        { period: 'long',   data: srAnalysis.long_term   },
      ];

      periodMap.forEach(({ period: pName, data }) => {
        if (!showAIPeriods[pName] || !data) return;
        const c = SR_COLORS[pName];

        ([data.resistance, data.support] as SRZoneData[]).forEach(zone => {
          if (!zone) return;
          const isZone = zone.type.includes('區');
          const effectiveLow = zone.low ?? zone.high;   // 壓力線/支撐線可能無 low 欄位
          const yH = series.priceToCoordinate(zone.high);
          const yL = series.priceToCoordinate(effectiveLow);
          if (yH === null || yL === null) return;

          const yTop  = Math.min(yH, yL);
          const yBot  = Math.max(yH, yL);
          const zoneH = yBot - yTop;

          if (isZone) {
            drawHatchedZone(ctx, 0, yTop, chartW, Math.max(zoneH, 1), c.fillR, c.hatch, c.stroke);
          } else {
            const mid = (effectiveLow + zone.high) / 2;
            const yLine = series.priceToCoordinate(mid) ?? yTop;
            if (yLine < 0 || yLine > h) return;
            ctx.save();
            ctx.strokeStyle = c.stroke;
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, yLine);
            ctx.lineTo(chartW, yLine);
            ctx.stroke();
            ctx.restore();
          }
        });
      });
    }

    // ── Selected SR lines ──
    const newGroups = buildLabelGroups();
    newGroups.forEach(group => {
      const y = series.priceToCoordinate(group.price);
      if (y === null || isNaN(y) || y < 0 || y > h) return;
      const colors = PERIOD_COLORS[group.period];

      // shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();

      // dashed line extending to right blank area
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - PRICE_SCALE_WIDTH + 2, y); ctx.stroke();
      ctx.setLineDash([]);

      // price label on left edge
      ctx.save();
      const priceText = fmtPrice(group.price);
      const fontSize = 10;
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textW = ctx.measureText(priceText).width;
      const padX = 4, padY = 2;
      const boxW = textW + padX * 2;
      const boxH = fontSize + padY * 2;
      const boxX = 4;
      const boxY = y - boxH / 2;
      ctx.fillStyle = colors.labelBg;
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.label;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(priceText, boxX + padX, y);
      ctx.restore();
    });

    // Update label group Y positions (trigger state update on next tick)
    requestAnimationFrame(() => {
      if (!seriesRef.current) return;
      setLabelGroups(prev => {
        const updated = newGroups.map((g, i) => {
          const newY = seriesRef.current!.priceToCoordinate(g.price) ?? g.y;
          return { ...g, y: newY, expanded: prev[i]?.expanded ?? false };
        });
        return updated;
      });
    });
  }, [showPeriods, showAIPeriods, allPeriods, showVolumeProfile, getPriceRange, buildLabelGroups, srAnalysis]);

  useEffect(() => { drawOverlayRef.current = drawOverlay; }, [drawOverlay]);

  // Build/rebuild chart on bars or chartType change
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;
    if (chartRef.current) chartRef.current.remove();

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: 'rgba(255,255,255,0)' }, textColor: '#94a3b8', fontSize: 13 },
      grid: {
        vertLines: { color: 'rgba(200,200,200,0.1)' },
        horzLines: { color: 'rgba(200,200,200,0.1)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(0,0,0,0.08)', textColor: '#94a3b8' },
      timeScale: { borderColor: 'rgba(0,0,0,0.08)', timeVisible: false },
      handleScale: { mouseWheel: false },
    });
    chartRef.current = chart;

    if (chartType === 'candlestick') {
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: '#ef5350', downColor: '#26a69a',
        borderVisible: false, wickUpColor: '#ef5350', wickDownColor: '#26a69a',
        priceLineVisible: false, lastValueVisible: false,
      });
      seriesRef.current = cs;
      cs.setData(bars.map(b => ({ time: toUnix(b.time), open: b.open, high: b.high, low: b.low, close: b.close })));
    } else {
      const ls = chart.addSeries(LineSeries, {
        color: '#2196F3', lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      });
      seriesRef.current = ls;
      ls.setData(bars.map(b => ({ time: toUnix(b.time), value: b.close })));
    }

    // Canvas size init (always set up)
    const initCanvas = () => {
      const canvas  = overlayRef.current;
      const vpCvs   = vpCanvasRef.current;
      const cont    = containerRef.current;
      if (!canvas || !cont) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cont.clientWidth, h = cont.clientHeight;
      if (w > 0 && h > 0) {
        canvas.width = w * dpr; canvas.height = h * dpr;
        if (vpCvs) { vpCvs.width = w * dpr; vpCvs.height = h * dpr; }
      }
    };
    initCanvas();
    const tid2 = setTimeout(() => { initCanvas(); requestAnimationFrame(() => drawOverlayRef.current()); }, 50);

    // Wheel zoom: always attach — right 5 blanks + last bar stays fixed
    const handleWheel = (e: WheelEvent) => {
      if (!chartRef.current) return;
      const lr = chartRef.current.timeScale().getVisibleLogicalRange();
      if (!lr) return;
      e.preventDefault();
      const anchor = bars.length - 1;
      const fromAnchor = Math.max(5, anchor - lr.from);
      const factor = e.deltaY > 0 ? 1.2 : 0.8;
      const newFromAnchor = fromAnchor * factor;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: anchor - newFromAnchor,
        to:   anchor + BLANK_BARS + 0.5,
      });
    };
    containerRef.current.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    resizeObserver.observe(containerRef.current);

    // Initial visible range (first load per stock)
    let tidInitRange: ReturnType<typeof setTimeout> | null = null;
    if (!isInitializedRef.current) {
      try { chart.timeScale().fitContent(); } catch (_) {}
      tidInitRange = setTimeout(() => {
        try {
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: bars.length - 1 - requiredDays,
            to:   bars.length - 1 + BLANK_BARS + 0.5,
          });
          isInitializedRef.current = true;
        } catch (_) {}
      }, 100);
    }

    return () => {
      if (tidInitRange) clearTimeout(tidInitRange);
      clearTimeout(tid2);
      resizeObserver.disconnect();
      containerRef.current?.removeEventListener('wheel', handleWheel);
      isInitializedRef.current   = false;
      lastPeriodStateRef.current = null;
      chart.remove();
      chartRef.current = seriesRef.current = null;
    };
  }, [bars, chartType]);

  // Subscribe to chart range changes → redraw overlay + refresh labels
  useEffect(() => {
    if (!chartRef.current) return;
    const redraw = () => requestAnimationFrame(drawOverlay);
    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(redraw);
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    return () => {
      try {
        chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(redraw);
        chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(redraw);
      } catch (_) {}
    };
  }, [drawOverlay]);

  useEffect(() => {
    if (seriesRef.current) requestAnimationFrame(drawOverlay);
  }, [showPeriods, showAIPeriods, selectedSRLevels, drawOverlay]);

  // Adjust visible range when period selection changes
  useEffect(() => {
    if (!chartRef.current || bars.length === 0) return;
    const checked = (['short', 'medium', 'long'] as PeriodName[]).filter(p => showPeriods[p]);
    const stateKey = checked.join(',') + '|' + bars.length;
    const lastKey  = (lastPeriodStateRef.current?.periods ?? '') + '|' + (lastPeriodStateRef.current?.barsLength ?? 0);
    if (stateKey === lastKey) return;
    lastPeriodStateRef.current = { periods: checked.join(','), barsLength: bars.length };
    const barsToShow = checked.length > 0 ? Math.max(...checked.map(p => PERIOD_DAY_MAP[p])) : 20;
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

      <div className="flex flex-1 min-w-0 relative">
        <div className="relative flex-1 min-w-0">
          {/* VP canvas — placed before chart div so it sits behind K-line candles */}
          <canvas
            ref={vpCanvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: '100%', height: '100%', zIndex: 1 }}
          />
          <div ref={containerRef} className="w-full h-full" style={{ position: 'relative', zIndex: 2 }} />
          <canvas
            ref={overlayRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ width: '100%', height: '100%', zIndex: 10 }}
          />

          {/* SR label badges on Y-axis edge */}
          {labelGroups.map((group, gi) => {
            const colors     = PERIOD_COLORS[group.period];
            const isHovered  = hoveredGroupIdx === gi;
            const isSingle   = group.items.length === 1;
            const isExpanded = isHovered && !isSingle;
            const containerH = containerRef.current?.clientHeight ?? 600;
            if (group.y < 10 || group.y > containerH - 10) return null;

            const expandedH   = group.items.length * 22 + 10;
            const expandedTop = Math.min(
              Math.max(5, group.y - expandedH / 2),
              containerH - expandedH - 5
            );

            return (
              <div
                key={gi}
                className="absolute flex items-start gap-1 cursor-default"
                style={{
                  right: PRICE_SCALE_WIDTH + 4,
                  top: isExpanded ? expandedTop : group.y - 10,
                  zIndex: 25,
                }}
                onMouseEnter={() => setHoveredGroupIdx(gi)}
                onMouseLeave={() => setHoveredGroupIdx(null)}
              >
                <div
                  className="w-3 shrink-0 border-t border-dashed"
                  style={{
                    borderColor: colors.line,
                    marginTop: isExpanded ? group.y - expandedTop + 1 : 9,
                  }}
                />

                {isExpanded ? (
                  <div
                    className="flex flex-col gap-px text-[10px] font-bold px-2 py-1.5 rounded border shadow-md"
                    style={{ backgroundColor: colors.line, color: '#fff', borderColor: colors.line }}
                  >
                    {group.items.map(it => (
                      <div key={it.id} className="whitespace-nowrap flex items-center gap-2">
                        <span>{it.name}</span>
                        <span className="font-mono opacity-90">{fmtPrice(it.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap transition-all"
                    style={{
                      backgroundColor: isHovered ? colors.line : colors.labelBg,
                      color: isHovered ? '#fff' : colors.label,
                      borderColor: colors.line,
                    }}
                  >
                    {isHovered && isSingle
                      ? `${group.items[0].name}  ${fmtPrice(group.price)}`
                      : isSingle
                        ? group.items[0].name
                        : `${group.items[0].name} +`
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
