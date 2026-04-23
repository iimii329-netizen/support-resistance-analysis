import { VP, PeriodAnalysis } from '../types';
import { formatToTickDisplay } from './tickUtils';

export interface VPAnalysisResult {
  summary: string;
  indicatorName: string;
  referencePrice: number;
  type: 'support' | 'resistance';
}

// 根據 VP（POC、VAH、VAL）和收盤價的相對位置進行分析
export function analyzeVolumeProfile(
  vp: VP,
  currentPrice: number,
  closePrice: number
): VPAnalysisResult | null {
  if (!vp.valid || (!vp.poc && !vp.vah && !vp.val)) {
    return null;
  }

  // 優先判斷順序：VAH > POC > VAL
  const candidates = [
    { price: vp.vah, name: '價值區間高點 (VAH)' },
    { price: vp.poc, name: '控制點 (POC)' },
    { price: vp.val, name: '價值區間低點 (VAL)' },
  ].filter((c) => c.price !== null) as { price: number; name: string }[];

  if (candidates.length === 0) return null;

  // 取第一個有效的參考價格
  const reference = candidates[0];
  const isSupport = closePrice < reference.price;
  const type: 'support' | 'resistance' = isSupport ? 'support' : 'resistance';

  const displayPrice = formatToTickDisplay(reference.price);
  const summary = isSupport
    ? `根據${reference.name}分析，在 ${displayPrice} 元附近有支撐`
    : `根據${reference.name}分析，在 ${displayPrice} 元附近有壓力`;

  return {
    summary,
    indicatorName: reference.name,
    referencePrice: reference.price,
    type,
  };
}

// 從 PeriodAnalysis 提取所有指標數據（用於側邊欄展示）
export interface IndicatorValue {
  label: string;
  value: number;
  isResistance: boolean; // true 表示高於收盤價，false 表示低於
  category: 'vp' | 'support' | 'resistance' | 'other';
  tooltip?: string;
}

export function extractIndicatorValues(
  periodAnalysis: PeriodAnalysis,
  currentPrice: number
): IndicatorValue[] {
  const indicators: IndicatorValue[] = [];

  // 添加 VP 數據
  if (periodAnalysis.vp && periodAnalysis.vp.valid) {
    if (periodAnalysis.vp.poc !== null) {
      indicators.push({
        label: 'POC (控制點)',
        value: periodAnalysis.vp.poc,
        isResistance: periodAnalysis.vp.poc > currentPrice,
        category: 'vp',
        tooltip: '成交量最集中的價格',
      });
    }
    if (periodAnalysis.vp.vah !== null) {
      indicators.push({
        label: 'VAH (高點)',
        value: periodAnalysis.vp.vah,
        isResistance: periodAnalysis.vp.vah > currentPrice,
        category: 'vp',
        tooltip: '價值區間上邊界',
      });
    }
    if (periodAnalysis.vp.val !== null) {
      indicators.push({
        label: 'VAL (低點)',
        value: periodAnalysis.vp.val,
        isResistance: periodAnalysis.vp.val > currentPrice,
        category: 'vp',
        tooltip: '價值區間下邊界',
      });
    }
  }

  // 添加主要支撐
  if (periodAnalysis.support) {
    indicators.push({
      label: `支撐 (${periodAnalysis.support.members.join('/')})`
        .slice(0, 20),
      value: periodAnalysis.support.price,
      isResistance: false,
      category: 'support',
      tooltip: `強度：${periodAnalysis.support.strength}`,
    });
  }

  // 添加主要壓力
  if (periodAnalysis.resistance) {
    indicators.push({
      label: `壓力 (${periodAnalysis.resistance.members.join('/')})`
        .slice(0, 20),
      value: periodAnalysis.resistance.price,
      isResistance: true,
      category: 'resistance',
      tooltip: `強度：${periodAnalysis.resistance.strength}`,
    });
  }

  // 按數值由高至低排序
  indicators.sort((a, b) => b.value - a.value);

  return indicators;
}
