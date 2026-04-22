import { Band } from '../types';

export function mockAIPrompt(band: Band, type: 'support' | 'resistance', currentPrice: number): string {
  const isSupport = type === 'support';
  // 第一句話必須包含精確價格（與主視覺卡片一致，直接吃 display）
  const priceValue = band.display || band.price.toString();
  const dom = band.members?.[0] || '均線';
  const isResonance = band.members && band.members.length > 1;

  // at_price_now: 現價是否就在支撐/壓力帶內
  const atPriceNow =
    band.range_low !== undefined && band.range_high !== undefined
      ? currentPrice >= band.range_low && currentPrice <= band.range_high
      : false;

  // 以下實作 @AI一句話Prompt.md 的條件與推薦輸出風格，並嚴格控制在 28~35 字以內
  if (isSupport) {
    if (isResonance && atPriceNow) {
      return `現價正考驗 ${priceValue} 處多重指標防禦帶，此為多方結構性共識的關鍵交集點。`;
    } else if (isResonance) {
      return `位於 ${priceValue} 處的多重指標匯聚共振，由${dom}強化了長期持有成本的關鍵底線。`;
    } else if (atPriceNow) {
      return `現價正考驗 ${priceValue} 處的${dom}防禦帶，此為多方結構防範區塊的關鍵交集點。`;
    } else {
      return `此股於 ${priceValue} 處有${dom}支撐，構成其長期持有成本的防禦底線區域。`;
    }
  } else {
    // type === 'resistance'
    if (isResonance && atPriceNow) {
      return `現價與 ${priceValue} 處的多重阻力激戰，其${dom}反應市場這區塊換手與換籌關鍵。`;
    } else if (isResonance) {
      return `在 ${priceValue} 處存在多重技術面共振壓力，${dom}顯示此區間集結了大量套牢籌碼。`;
    } else if (atPriceNow) {
      return `現價正逢 ${priceValue} 處的${dom}壓力帶測試，反映市場此區塊面臨龐大的獲利了結壓力。`;
    } else {
      return `在 ${priceValue} 處有${dom}壓力，顯示此區間集結了套牢籌碼與趨勢防堵門檻。`;
    }
  }
}
