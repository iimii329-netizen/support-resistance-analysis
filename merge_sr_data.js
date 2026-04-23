const fs = require('fs');
const path = require('path');

// 讀取支撐壓力數據
const srPath = 'Web/chart-demo/public/data/support-resistance.json';
const srData = JSON.parse(fs.readFileSync(srPath, 'utf-8'));

// 讀取stocks.json
const stocksPath = 'Web/chart-demo/public/data/stocks.json';
const stocksData = JSON.parse(fs.readFileSync(stocksPath, 'utf-8'));

// 為每個股票更新periods數據
for (const stockId in srData) {
  if (!(stockId in stocksData)) {
    console.log(`警告: ${stockId} 不在 stocks.json 中`);
    continue;
  }

  const stock = stocksData[stockId];
  const srInfo = srData[stockId];

  // 為每個時間框架（short, medium, long）更新
  for (const periodName of ['short', 'medium', 'long']) {
    if (!(periodName in srInfo)) {
      continue;
    }

    const periodSr = srInfo[periodName];

    // 確保periods結構存在
    if (!('periods' in stock)) {
      stock.periods = {};
    }
    if (!(periodName in stock.periods)) {
      stock.periods[periodName] = {};
    }

    const period = stock.periods[periodName];

    // 更新support
    if (!('support' in period)) {
      period.support = {};
    }

    const supportSr = periodSr.support;
    period.support.price = supportSr.value;
    period.support.display = String(Math.floor(supportSr.value));
    period.support.summary = `支撐位於 ${supportSr.value} (${supportSr.source})`;
    period.support.members = [supportSr.source];

    // 更新resistance
    if (!('resistance' in period)) {
      period.resistance = {};
    }

    const resistanceSr = periodSr.resistance;
    period.resistance.price = resistanceSr.value;
    period.resistance.display = String(Math.floor(resistanceSr.value));
    period.resistance.summary = `壓力位於 ${resistanceSr.value} (${resistanceSr.source})`;
    period.resistance.members = [resistanceSr.source];

    // 清理all_support和all_resistance，使用新的support和resistance
    period.all_support = [
      {
        price: supportSr.value,
        display: String(Math.floor(supportSr.value)),
        distance_pct: period.support.distance_pct || 0,
        strength: 1,
        members: [supportSr.source],
        summary: `支撐位於 ${supportSr.value} (${supportSr.source})`
      }
    ];

    period.all_resistance = [
      {
        price: resistanceSr.value,
        display: String(Math.floor(resistanceSr.value)),
        distance_pct: period.resistance.distance_pct || 0,
        strength: 1,
        members: [resistanceSr.source],
        summary: `壓力位於 ${resistanceSr.value} (${resistanceSr.source})`
      }
    ];

    // 添加整數防線信息
    period.integer_levels = periodSr.integer_level;

    console.log(`✓ 已更新 ${stockId} - ${periodName}`);
  }
}

// 保存更新後的stocks.json
console.log('正在保存更新後的 stocks.json...');
fs.writeFileSync(stocksPath, JSON.stringify(stocksData, null, 2), 'utf-8');
console.log('✓ stocks.json 已更新完成（包括all_support和all_resistance）');
