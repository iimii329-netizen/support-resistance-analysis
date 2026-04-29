'use client';

import { useState } from 'react';

interface Props { onBack: () => void; }

const HIT_RATE_DATA = [
  { name: '240日最低',   dir: 'support',    n: 5,  hit: 56.5, med: 52.0, std: 23.5, stocks: 1693 },
  { name: 'BB上3σ',      dir: 'resistance', n: 5,  hit: 55.8, med: 55.8, std: 11.0, stocks: 1914 },
  { name: '240日最高',   dir: 'resistance', n: 5,  hit: 55.2, med: 52.6, std: 18.3, stocks: 1732 },
  { name: 'BB上2σ',      dir: 'resistance', n: 5,  hit: 53.5, med: 53.2, std: 8.3,  stocks: 1925 },
  { name: '20日最高',    dir: 'resistance', n: 5,  hit: 53.2, med: 53.0, std: 9.3,  stocks: 1925 },
  { name: '240MA',       dir: 'dual',       n: 5,  hit: 50.6, med: 50.0, std: 11.4, stocks: 1837 },
  { name: 'BB下3σ',      dir: 'support',    n: 5,  hit: 50.0, med: 50.0, std: 14.6, stocks: 1903 },
  { name: 'BB下2σ',      dir: 'support',    n: 5,  hit: 48.7, med: 49.2, std: 9.0,  stocks: 1925 },
  { name: '60MA',        dir: 'dual',       n: 5,  hit: 48.5, med: 48.9, std: 7.8,  stocks: 1909 },
  { name: '120MA',       dir: 'dual',       n: 5,  hit: 48.5, med: 48.3, std: 8.2,  stocks: 1877 },
  { name: '20日最低',    dir: 'support',    n: 5,  hit: 48.0, med: 48.2, std: 8.7,  stocks: 1927 },
  { name: '30MA',        dir: 'dual',       n: 5,  hit: 47.8, med: 48.0, std: 6.5,  stocks: 1927 },
  { name: '20MA',        dir: 'dual',       n: 5,  hit: 47.8, med: 48.0, std: 6.1,  stocks: 1927 },
  { name: '10日最高',    dir: 'resistance', n: 3,  hit: 43.5, med: 43.1, std: 7.2,  stocks: 1928 },
  { name: '5日最高',     dir: 'resistance', n: 3,  hit: 42.1, med: 42.1, std: 6.1,  stocks: 1929 },
  { name: '上關',        dir: 'resistance', n: 3,  hit: 40.0, med: 39.9, std: 4.9,  stocks: 1931 },
  { name: 'SAR',         dir: 'dual',       n: 3,  hit: 39.7, med: 40.0, std: 11.0, stocks: 1918 },
  { name: '10日最低',    dir: 'support',    n: 3,  hit: 38.8, med: 38.9, std: 6.7,  stocks: 1931 },
  { name: '5日最低',     dir: 'support',    n: 3,  hit: 38.3, med: 38.7, std: 6.3,  stocks: 1932 },
  { name: '下關',        dir: 'support',    n: 3,  hit: 37.6, med: 38.0, std: 5.6,  stocks: 1932 },
  { name: '5MA',         dir: 'dual',       n: 3,  hit: 37.5, med: 38.0, std: 4.7,  stocks: 1931 },
  { name: '10MA',        dir: 'dual',       n: 3,  hit: 37.1, med: 37.7, std: 5.1,  stocks: 1930 },
];

type TabKey = 'short' | 'medium' | 'long' | 'prompt' | 'hitrate';

const TABS: { key: TabKey; label: string; color: string }[] = [
  { key: 'short',   label: '短期決策邏輯', color: 'yellow' },
  { key: 'medium',  label: '中期決策邏輯', color: 'purple' },
  { key: 'long',    label: '長期決策邏輯', color: 'blue'   },
  { key: 'prompt',  label: 'AI一句話',     color: 'gray'   },
  { key: 'hitrate', label: '指標命中率',   color: 'green'  },
];

const TAB_ACTIVE: Record<TabKey, string> = {
  short:   'border-yellow-500 text-yellow-700 bg-yellow-50',
  medium:  'border-purple-500 text-purple-700 bg-purple-50',
  long:    'border-blue-500   text-blue-700   bg-blue-50',
  prompt:  'border-gray-600   text-gray-800   bg-gray-50',
  hitrate: 'border-green-500  text-green-700  bg-green-50',
};

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className={`text-xl font-bold mb-4 pb-2 border-b-2 border-${color}-400 text-gray-900`}>{title}</h2>
      {children}
    </section>
  );
}

function IndicatorTable({ rows }: { rows: { name: string; desc: string; weight: number }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">指標</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">說明</th>
            <th className="px-4 py-2.5 text-center font-semibold text-gray-700">權重(W)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
              <td className="px-4 py-2 text-gray-600 text-xs">{r.desc}</td>
              <td className="px-4 py-2 text-center">
                <span className="inline-block bg-blue-100 text-blue-700 font-bold text-xs px-2 py-0.5 rounded-full">{r.weight}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShortContent() {
  const indicators = [
    { name: '上關',      desc: '昨低 + (昨高 − 昨低) × 1.382', weight: 3 },
    { name: '下關',      desc: '昨高 − (昨高 − 昨低) × 1.382', weight: 2 },
    { name: 'SAR',       desc: '取 0.02, 0.02, 0.2 計算；逐 K 移動', weight: 2 },
    { name: '5日最高價', desc: '近 5 個交易日的最高價', weight: 3 },
    { name: '5日最低價', desc: '近 5 個交易日的最低價', weight: 2 },
    { name: '10日最高價',desc: '近 10 個交易日的最高價', weight: 3 },
    { name: '10日最低價',desc: '近 10 個交易日的最低價', weight: 2 },
    { name: '5日均線',   desc: '近 5 個交易日收盤平均', weight: 2 },
    { name: '10日均線',  desc: '近 10 個交易日收盤平均', weight: 2 },
    { name: '5日 POC',   desc: '近 5 日成交量最高的價格位元', weight: 5 },
    { name: '5日 VAH',   desc: '近 5 日價值區域高點', weight: 5 },
    { name: '5日 VAL',   desc: '近 5 日價值區域低點', weight: 5 },
  ];
  return (
    <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
      <p className="text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
        本邏輯樹旨在透過「聚類演算法」與「權重過濾」，在盤後 30 秒內為用戶提煉出唯一、最具意義的「一線一區」。
      </p>
      <Section title="第一層：聚類與區間化" color="yellow">
        <IndicatorTable rows={indicators} />
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
          <p><strong>MECE 分類標準：</strong>將 12 項指標依照價位鄰近度進行歸類。</p>
          <p>定義 <code className="bg-white border rounded px-1">ε = 0.5 × ATR(14)</code> 為共振感應寬度。</p>
          <p>壓力指標叢集：所有位元 <strong>&gt; 收盤價</strong>的指標。</p>
          <p>支撐指標叢集：所有位元 <strong>&lt; 收盤價</strong>的指標。</p>
          <p>若指標間距離 ≤ ε，則聚合為「一個區間（Range）」；若孤立，則視為「單一線（Line）」。</p>
        </div>
      </Section>
      <Section title="第二層：意義權重評分" color="yellow">
        <p>針對每個聚類進行「意義值」計算。一個指標僅能貢獻一次分數。</p>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm border border-gray-200 mt-2">
          Zone_Score = Σ (W × Quality_Factor)
        </div>
      </Section>
      <Section title="第三層：唯一最優選拔" color="yellow">
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="font-semibold text-red-700 mb-1">唯一壓力</p>
            <p>取收盤價上方 Zone_Score 最高者。</p>
            <p className="text-xs text-red-600 mt-1">區間寬度 ≤ 0.3% → 壓力線；&gt; 0.3% → 壓力區（顯示最低與最高邊界）</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-semibold text-blue-700 mb-1">唯一支撐</p>
            <p>取收盤價下方 Zone_Score 最高者。</p>
            <p className="text-xs text-blue-600 mt-1">區間寬度 ≤ 0.3% → 支撐線；&gt; 0.3% → 支撐區（顯示最低與最高邊界）</p>
          </div>
        </div>
      </Section>
      <Section title="第四層：戰略詮釋" color="yellow">
        <p>AI 必須給出「一句話客觀事實解釋」，著重於數值和指標來源，不給主觀建議。使用 AI一句話Prompt 規範輸出。</p>
      </Section>
    </div>
  );
}

function MediumContent() {
  const indicators = [
    { name: 'BBands 上限',  desc: '20 日 MA + 3 STD', weight: 4 },
    { name: 'BBands 下限',  desc: '20 日 MA − 3 STD', weight: 4 },
    { name: '20日最高價',   desc: '近 20 個交易日的最高價', weight: 4 },
    { name: '20日最低價',   desc: '近 20 個交易日的最低價', weight: 3 },
    { name: '20日均線',     desc: '近 20 個交易日收盤平均', weight: 3 },
    { name: '30日均線',     desc: '近 30 個交易日收盤平均', weight: 3 },
    { name: '20日 POC',     desc: '近 20 日成交量最高的價格位元', weight: 5 },
    { name: '20日 VAH',     desc: '近 20 日價值區域高點', weight: 5 },
    { name: '20日 VAL',     desc: '近 20 日價值區域低點', weight: 5 },
  ];
  return (
    <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
      <p className="text-gray-600 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
        本邏輯樹專注於將中期（20–60 交易日）指標轉化為具備「數據物理性」的客觀事實，確保用戶獲得唯一且權重最高的一組支撐與壓力。
      </p>
      <Section title="第一層：全局指標檢索與池化" color="purple">
        <IndicatorTable rows={indicators} />
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
          <p>定義 <code className="bg-white border rounded px-1">ε = 1.0 × ATR(14)</code> 為共振感應寬度。</p>
          <p>若指標間距離 ≤ ε，聚合為一個區間；若孤立，視為單一線。</p>
          <p>候選池為空時，向外搜尋「整數關卡」或「60 日極值」作為保底指標。</p>
        </div>
      </Section>
      <Section title="第二層：數據物理性權重評分" color="purple">
        <p>針對每個聚類進行「意義值」計算。一個指標僅能貢獻一次分數。</p>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm border border-gray-200 mt-2">
          Zone_Score = Σ (W × Quality_Factor)
        </div>
      </Section>
      <Section title="第三層：共振區間聚合" color="purple">
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="font-semibold text-red-700 mb-1">唯一壓力</p>
            <p>取收盤價上方 Zone_Score 最高者。寬度 ≤ 0.3% → 壓力線；&gt; 0.3% → 壓力區。</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-semibold text-blue-700 mb-1">唯一支撐</p>
            <p>取收盤價下方 Zone_Score 最高者。寬度 ≤ 0.3% → 支撐線；&gt; 0.3% → 支撐區。</p>
          </div>
        </div>
      </Section>
      <Section title="第四層：客觀事實描述" color="purple">
        <p>AI 根據選出的「最高分壓力區」與「最高分支撐區」輸出客觀事實，不提供買賣指令。使用 AI一句話Prompt 規範輸出。</p>
      </Section>
    </div>
  );
}

function LongContent() {
  const indicators = [
    { name: '240日最高價',        desc: '近 240 個交易日的最高價', weight: 4 },
    { name: '240日最低價',        desc: '近 240 個交易日的最低價', weight: 4 },
    { name: '60日均線（季線）',   desc: '近 60 個交易日收盤平均', weight: 3 },
    { name: '120日均線（半年線）', desc: '近 120 個交易日收盤平均', weight: 3 },
    { name: '240日均線（年線）',  desc: '近 240 個交易日收盤平均', weight: 4 },
    { name: '60日 POC',           desc: '近 60 日（近季）成交量最高的價格位元', weight: 5 },
    { name: '60日 VAH',           desc: '近 60 日價值區域高點', weight: 5 },
    { name: '60日 VAL',           desc: '近 60 日價值區域低點', weight: 5 },
    { name: '整數關卡點',         desc: '結尾為 .00 或具有標誌性意義的價格', weight: 2 },
  ];
  return (
    <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
      <p className="text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        本邏輯樹旨在透過「聚類演算法」與「權重過濾」，提煉出具備長期意義的唯一「一線一區」。
      </p>
      <Section title="第一層：聚類與區間化" color="blue">
        <IndicatorTable rows={indicators} />
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
          <p>定義 <code className="bg-white border rounded px-1">ε = 2.0 × ATR(14)</code> 為共振感應寬度。</p>
          <p>若指標間距離 ≤ ε，聚合為一個區間；若孤立，視為單一線。</p>
          <p>候選池為空時，向外搜尋「整數關卡」或「240 日極值」作為保底指標。</p>
        </div>
      </Section>
      <Section title="第二層：意義權重評分" color="blue">
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm border border-gray-200">
          Zone_Score = Σ (W × Quality_Factor)
        </div>
      </Section>
      <Section title="第三層：唯一最優選拔" color="blue">
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="font-semibold text-red-700 mb-1">唯一壓力</p>
            <p>取收盤價上方 Zone_Score 最高者。寬度 ≤ 0.3% → 壓力線；&gt; 0.3% → 壓力區。</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-semibold text-blue-700 mb-1">唯一支撐</p>
            <p>取收盤價下方 Zone_Score 最高者。寬度 ≤ 0.3% → 支撐線；&gt; 0.3% → 支撐區。</p>
          </div>
        </div>
      </Section>
      <Section title="第四層：戰略詮釋" color="blue">
        <p>AI 給出「一句話客觀事實解釋」，著重數值和指標構成，不給主觀建議。使用 AI一句話Prompt 規範輸出。</p>
      </Section>
    </div>
  );
}

function PromptContent() {
  return (
    <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
      <p className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        你是一位冷靜的量化交易分析師。根據「短期／中期／長期」決策邏輯樹，在 K 線圖上標註出最具意義的支撐與壓力，並提供「一句話客觀事實解釋」。
      </p>

      <Section title="核心邏輯規範" color="gray">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">規則</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">說明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-medium">聚合共振</td><td className="px-4 py-2 text-xs text-gray-600">若多個指標在感應寬度 ε（短 0.5／中 1.0／長 2.0 × ATR）內重疊，視為「共振區間」</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-medium">去偽存真</td><td className="px-4 py-2 text-xs text-gray-600">忽略低權重或孤立雜訊，僅鎖定 Zone_Score 最高的唯一目標</td></tr>
              <tr className="hover:bg-gray-50"><td className="px-4 py-2 font-medium">區間定義</td><td className="px-4 py-2 text-xs text-gray-600">寬度 &gt; 0.3% 顯示為「區間（Range）」；≤ 0.3% 顯示為「線（Line）」</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="顯示級距規則" color="gray">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">股價區間 (TWD)</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">跳動單位 (Tick)</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">顯示級距</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {[['< 10 元','0.01','0.05 元'],['10 – 50 元','0.05','0.1 元'],['50 – 100 元','0.1','0.5 元'],
                ['100 – 500 元','0.5','1 元'],['500 – 1000 元','1.0','5 元'],['> 1000 元','5.0','10 元']
              ].map(([range, tick, disp], i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{range}</td>
                  <td className="px-4 py-2">{tick}</td>
                  <td className="px-4 py-2 font-medium text-blue-700">{disp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">捨入方向：支撐取下捨（floor），壓力取上捨（ceil）。</p>
      </Section>

      <Section title="輸出撰寫五條規則" color="gray">
        <ol className="list-decimal list-inside space-y-1.5 pl-2">
          <li><strong>禁止主觀：</strong>嚴禁出現「建議」「操作」「應」「看好」等詞彙</li>
          <li><strong>數值先行：</strong>必須明確標註價格或區間邊界</li>
          <li><strong>邏輯還原：</strong>說明是由哪些高權重指標聚合而成</li>
          <li><strong>一句話準則：</strong>不超過 50 字，直接陳述物理數據意義</li>
          <li><strong>顯示捨入：</strong>輸出數值依級距規則捨入</li>
        </ol>
      </Section>

      <Section title="固定輸出模板" color="gray">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">區間型（寬度 &gt; 0.3%）</p>
            <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>壓力區 (XXX-XXX)：OOO、OOO...共振</div>
              <div>支撐區 (XXX-XXX)：OOO、OOO...聚合</div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">單線型（寬度 ≤ 0.3%）</p>
            <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>壓力線 (XXX)：OOO與OOO重合</div>
              <div>支撐線 (XXX)：OOO與OOO重合</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="輸出範例" color="gray">
        <div className="space-y-2">
          {[
            { type: '壓力區', example: '壓力區 (153-154)：5日POC、5日VAH與10日最高共振', color: 'red' },
            { type: '支撐區', example: '支撐區 (144-146)：20日POC、20日VAL與20MA聚合', color: 'blue' },
            { type: '壓力線', example: '壓力線 (145)：20日POC與布林通道上緣重合', color: 'red' },
            { type: '支撐線', example: '支撐線 (180)：240MA與整數180重合', color: 'blue' },
          ].map((ex, i) => (
            <div key={i} className={`px-4 py-2.5 rounded-lg border ${ex.color === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'} text-sm font-medium`}>
              {ex.example}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function HitRateContent() {
  const dirLabel: Record<string, { label: string; cls: string }> = {
    resistance: { label: '壓力', cls: 'bg-red-100 text-red-700' },
    support:    { label: '支撐', cls: 'bg-blue-100 text-blue-700' },
    dual:       { label: '雙向', cls: 'bg-gray-100 text-gray-600' },
  };
  return (
    <div className="space-y-4 text-sm">
      <p className="text-gray-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        以下數據來自台股 1,900+ 檔個股回測（5 日窗口），統計各指標作為支撐／壓力的平均命中率。
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">指標</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">方向</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">窗口(n)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">平均命中率</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">中位數</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">標準差</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">有效股票數</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {HIT_RATE_DATA.map((row, i) => {
              const dir = dirLabel[row.dir];
              const hitColor = row.hit >= 50 ? 'text-green-700 font-bold' : row.hit >= 45 ? 'text-yellow-700 font-semibold' : 'text-gray-600';
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dir.cls}`}>{dir.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{row.n}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${hitColor}`}>{row.hit.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{row.med.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{row.std.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{row.stocks.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">命中率定義：指標價格在 n 日內被觸及的比例。</p>
    </div>
  );
}

const TAB_CONTENT: Record<TabKey, React.ReactNode> = {
  short:   <ShortContent />,
  medium:  <MediumContent />,
  long:    <LongContent />,
  prompt:  <PromptContent />,
  hitrate: <HitRateContent />,
};

export default function ManualPage({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('short');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">支撐壓力決策邏輯說明書</h1>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            ← 返回
          </button>
        </div>
        <div className="flex px-6 border-t border-gray-100">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
                activeTab === key ? TAB_ACTIVE[key] : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            {TAB_CONTENT[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
}
