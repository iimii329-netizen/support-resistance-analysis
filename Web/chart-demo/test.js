const fs = require('fs');

const d = JSON.parse(fs.readFileSync('c:/Users/millychou/Desktop/【專案】[AI Inside]技術分析/[Claude]AI Inside技術分析/商品盤勢新增圖片20260414/目前展示網頁/chart-demo/public/data/stocks.json', 'utf8'));
for(const k in d) {
  if(d[k].name && d[k].name.includes('中鋼')) {
    console.log(JSON.stringify(d[k].periods.medium.all_resistance, null, 2));
  }
}
