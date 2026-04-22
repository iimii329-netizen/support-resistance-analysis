import { Band } from '../types';
import { snapToTick, formatToTickDisplay, getTickInfo } from './tickUtils';

export function processBands(bands: Band[], type: 'support' | 'resistance'): { main: Band | null; filtered: Band[] } {
  if (!bands || bands.length === 0) return { main: null, filtered: [] };

  // 0. 針對實際交易 Tick 進行捕捉，並設定 1.5 倍 Tick 容錯帶作為共振聚合條件
  const mappedBands = bands.map(b => ({
    ...b,
    snapBase: type === 'support'
      ? snapToTick(b.range_high ?? b.price)
      : snapToTick(b.range_low ?? b.price)
  }));
  
  // 壓力由小到大 (往上)，支撐由大到小 (往下)，相鄰距離判斷才會連續
  mappedBands.sort((a, b) => type === 'support' ? b.snapBase - a.snapBase : a.snapBase - b.snapBase);

  const clusters: typeof mappedBands[] = [];
  let currentCluster = [mappedBands[0]];

  for (let i = 1; i < mappedBands.length; i++) {
    const cur = mappedBands[i];
    const prev = currentCluster[currentCluster.length - 1];
    
    // 取上一層的基準 tick，若兩點相距小於 1.5 個 Tick 則視為接壤共振區間
    const { tick } = getTickInfo(prev.snapBase);
    const diff = Math.abs(cur.snapBase - prev.snapBase);
    
    if (diff <= tick * 1.5) {
      currentCluster.push(cur);
    } else {
      clusters.push(currentCluster);
      currentCluster = [cur];
    }
  }
  clusters.push(currentCluster);

  // 將 cluster 聚合成最新的 Band
  const mergedBands: Band[] = clusters.map(group => {
    if (group.length === 1) {
      return {
        ...group[0],
        price: group[0].snapBase,
        display: formatToTickDisplay(group[0].snapBase)
      };
    }

    const members = new Set<string>();
    let minDistance = Infinity;
    let closestBand = group[0];
    let mergedLow = Infinity;
    let mergedHigh = -Infinity;

    for (const g of group) {
      g.members.forEach(m => members.add(m));
      if (Math.abs(g.distance_pct) < Math.abs(minDistance)) {
        minDistance = g.distance_pct;
        closestBand = g;
      }
      mergedLow = Math.min(mergedLow, g.range_low ?? g.price);
      mergedHigh = Math.max(mergedHigh, g.range_high ?? g.price);
    }

    return {
      ...closestBand,
      price: closestBand.snapBase,
      display: formatToTickDisplay(closestBand.snapBase),
      distance_pct: minDistance,
      strength: members.size,
      members: Array.from(members),
      range_low: mergedLow,
      range_high: mergedHigh,
    };
  });

  // 第一階段：排除距離過近的，取明顯關卡 (> 0.3%)
  const clearBands = mergedBands.filter((b) => Math.abs(b.distance_pct) > 0.3);

  let activeBands: Band[] = [];
  if (clearBands.length > 0) {
    activeBands = [...clearBands];
  } else {
    // 第二階段 Fallback：關鍵位攻防 (<= 0.3%)
    const fallbackBands = mergedBands.filter((b) => Math.abs(b.distance_pct) <= 0.3);
    if (fallbackBands.length > 0) {
      // 依據 strength（共振指標數量）降序排序
      fallbackBands.sort((a, b) => b.strength - a.strength);
      activeBands = fallbackBands;
      // Fallback 情境：主關卡固定為最高分指標，次要關卡可保留其他符合者
      return { main: activeBands[0], filtered: activeBands };
    } else {
      // 若 > 0.3% 及 0.3% 內皆無指標，回傳空
      return { main: null, filtered: [] };
    }
  }

  // 針對第一階段 (明顯關卡)：取極值作為主關卡
  let mainBand = activeBands[0];
  if (type === 'support') {
    // 支撐取最大值 (即最接近現價的支撐)
    for (const b of activeBands) {
      if (b.price > mainBand.price) mainBand = b;
    }
    // 次要清單由大到小排序 (越接近現價的列在前)
    activeBands.sort((a, b) => b.price - a.price);
  } else {
    // 壓力取最小值 (即最接近現價的壓力)
    for (const b of activeBands) {
      if (b.price < mainBand.price) mainBand = b;
    }
    // 次要清單由小到大排序 (越接近現價的列在前)
    activeBands.sort((a, b) => a.price - b.price);
  }

  return { main: mainBand, filtered: activeBands };
}
