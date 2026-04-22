// 取得台股標的最適 Tick 與小數點位數
export function getTickInfo(price: number) {
  let tick = 0.01;
  let decimals = 2;
  
  if (price < 10) { tick = 0.01; decimals = 2; }
  else if (price < 50) { tick = 0.05; decimals = 2; }
  else if (price < 100) { tick = 0.1; decimals = 1; }
  else if (price < 500) { tick = 0.5; decimals = 1; }
  else if (price < 1000) { tick = 1.0; decimals = 0; }
  else { tick = 5.0; decimals = 0; }

  return { tick, decimals };
}

// 將價格收斂至最近的 Tick 並回傳數值
export function snapToTick(price: number): number {
  const { tick } = getTickInfo(price);
  const snapped = Math.round(price / tick) * tick;
  // 解決浮點數精度問題 (e.g. 19.950000000001 -> 19.95)
  return Number(snapped.toFixed(4));
}

// 將價格收斂至最近的 Tick 並依據規範回傳字串 (e.g. "19.95")
export function formatToTickDisplay(price: number): string {
  const { tick, decimals } = getTickInfo(price);
  const snapped = Math.round(price / tick) * tick;
  return snapped.toFixed(decimals);
}
