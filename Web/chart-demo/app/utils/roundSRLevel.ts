// 根據股價區間調整支撐壓力的顯示級距
export function getTickSize(price: number): number {
  if (price < 10) return 0.05;
  if (price < 50) return 0.1;
  if (price < 100) return 0.5;
  if (price < 500) return 1;
  if (price < 1000) return 5;
  return 10;
}

// 將支撐壓力值舍入到合適的級距
export function roundSRLevel(price: number, currentPrice: number): number {
  const tickSize = getTickSize(currentPrice);

  // 對於支撐，向下舍入；對於壓力，向上舍入
  if (price < currentPrice) {
    // 支撐：向下舍入
    return Math.floor(price / tickSize) * tickSize;
  } else {
    // 壓力：向上舍入
    return Math.ceil(price / tickSize) * tickSize;
  }
}

// 格式化顯示（根據股價決定小數位數）
export function formatSRPrice(price: number, currentPrice: number): string {
  const tickSize = getTickSize(currentPrice);

  if (tickSize >= 1) {
    return price.toFixed(0);
  } else if (tickSize >= 0.1) {
    return price.toFixed(1);
  } else {
    return price.toFixed(2);
  }
}
