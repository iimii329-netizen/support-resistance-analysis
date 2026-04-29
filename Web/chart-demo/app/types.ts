export type Timeframe = '5m' | '15m' | '60m' | '1d' | '1w';
export type PeriodName = 'short' | 'medium' | 'long';

export interface Bar {
  time: string;        // "YYYY/MM/DD HH:MM" (分K) | "YYYY/MM/DD" (日/週K)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20: number | null; // 資料不足時為 null
}

export interface Band {
  price: number;
  display: string;       // 整數位顯示字串，如 "1824"
  distance_pct: number;  // 距現價 %（支撐為負，壓力為正）
  strength: number;      // 共振指標數量
  members: string[];     // 成員指標名稱列表
  summary: string;       // rule-based 一句話摘要
  range_low?: number;
  range_high?: number;
}

export interface VPBin {
  price: number;
  volume: number;
  width: number; // normalized 0~1
}

export interface VP {
  poc: number | null;
  vah: number | null;
  val: number | null;
  tick: number;
  bins: VPBin[];
  valid: boolean;
}

export interface PeriodAnalysis {
  support:        Band | null;
  resistance:     Band | null;
  vp:             VP;
  all_support:    Band[];
  all_resistance: Band[];
}

export interface StockData {
  stock_id:      string;
  name:          string;
  current_price: number;
  change_pct:    number;
  klines: {
    '5m':  Bar[];
    '15m': Bar[];
    '60m': Bar[];
    '1d':  Bar[];
    '1w':  Bar[];
  };
  periods: {
    short:  PeriodAnalysis;
    medium: PeriodAnalysis;
    long:   PeriodAnalysis;
  };
}

// ── SR Summary（三期各 1S+1R）────────────────────────────────────────

export interface SRIndicator {
  name: string;
  value: number | null;
  distance_pct: number | null;
  hitrate: number | null;
}

export interface SRKeyLevel {
  price: number;
  label: string;
  layer: 'L1' | 'L2' | 'L3';
  distance_pct: number;
  indicators: SRIndicator[];
}

export interface SRPeriodSummary {
  support: SRKeyLevel | null;
  resistance: SRKeyLevel | null;
}

export interface SRSummaryData {
  symbol: string;
  date: string;
  current_price: number;
  periods: {
    short:  SRPeriodSummary;
    medium: SRPeriodSummary;
    long:   SRPeriodSummary;
  };
}
