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

type TabKey = 'logic' | 'prompt' | 'hitrate';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'logic',   label: '決策邏輯' },
  { key: 'prompt',  label: 'AI一句話' },
  { key: 'hitrate', label: '指標命中率' },
];

const TAB_ACTIVE: Record<TabKey, string> = {
  logic:   'border-slate-700  text-slate-800  bg-slate-50',
  prompt:  'border-gray-600   text-gray-800   bg-gray-50',
  hitrate: 'border-green-500  text-green-700  bg-green-50',
};

function Section({ title, color = 'gray', children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className={`text-lg font-bold mb-3 pb-2 border-b-2 border-${color}-400 text-gray-900`}>{title}</h2>
      {children}
    </section>
  );
}

function PeriodTag({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function InfoBox({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    blue:   'bg-blue-50 border-blue-200 text-blue-900',
    green:  'bg-green-50 border-green-200 text-green-900',
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${cls[color]}`}>{children}</div>;
}

const PERIOD_INDICATORS: {
  period: 'short' | 'medium' | 'long';
  label: string;
  tagCls: string;
  eps: string;
  epsNote: string;
  indicators: { name: string; desc: string; weight: number }[];
}[] = [
  {
    period: 'short', label: '短期（5–10 個交易日）',
    tagCls: 'bg-yellow-100 text-yellow-700 border-yellow-400',
    eps: 'ε = 0.5 × ATR(14)',
    epsNote: '聚類範圍小，精準捕捉即時壓力位',
    indicators: [
      { name: '上關',      desc: '昨低 + (昨高 − 昨低) × 1.382，當日可能遇到阻力的位置', weight: 3 },
      { name: '下關',      desc: '昨高 − (昨高 − 昨低) × 1.382，當日可能遇到支撐的位置', weight: 2 },
      { name: 'SAR',       desc: '拋物線停損反轉指標（0.02, 0.02, 0.2），追蹤短期趨勢', weight: 2 },
      { name: '5日最高價', desc: '近 5 個交易日的最高成交價，代表近期賣壓集中區', weight: 3 },
      { name: '5日最低價', desc: '近 5 個交易日的最低成交價，代表近期買盤支撐區', weight: 2 },
      { name: '10日最高價',desc: '近 10 個交易日的最高成交價', weight: 3 },
      { name: '10日最低價',desc: '近 10 個交易日的最低成交價', weight: 2 },
      { name: 'MA5',       desc: '5 日移動平均線，短期趨勢參考', weight: 2 },
      { name: 'MA10',      desc: '10 日移動平均線，短期趨勢參考', weight: 2 },
      { name: '5日POC',    desc: '近 5 日成交量最集中的價格，是市場最認同的短期公允價', weight: 5 },
      { name: '5日VAH',    desc: '近 5 日價值區域上緣（成交量前 70%），高於此為溢價區', weight: 5 },
      { name: '5日VAL',    desc: '近 5 日價值區域下緣（成交量前 70%），低於此為折價區', weight: 5 },
    ],
  },
  {
    period: 'medium', label: '中期（20–60 個交易日）',
    tagCls: 'bg-purple-100 text-purple-700 border-purple-400',
    eps: 'ε = 1.0 × ATR(14)',
    epsNote: '適中，平衡精度與容錯，允許指標間有更大距離的共振',
    indicators: [
      { name: '布林通道上緣', desc: '20 日 MA + 3 STD，超漲 3 個標準差後的統計壓力位（極端偏離區）', weight: 4 },
      { name: '布林通道下緣', desc: '20 日 MA − 3 STD，超跌 3 個標準差後的統計支撐位（極端偏離區）', weight: 4 },
      { name: '20日最高價',   desc: '近 20 個交易日的最高成交價，近月高點阻力', weight: 4 },
      { name: '20日最低價',   desc: '近 20 個交易日的最低成交價，近月低點支撐', weight: 3 },
      { name: 'MA20',         desc: '20 日均線，市場月線共識', weight: 3 },
      { name: 'MA30',         desc: '30 日均線，季初趨勢參考', weight: 3 },
      { name: '20日POC',      desc: '近 20 日成交量最集中的價格，是市場月均衡價', weight: 5 },
      { name: '20日VAH',      desc: '近 20 日價值區域上緣', weight: 5 },
      { name: '20日VAL',      desc: '近 20 日價值區域下緣', weight: 5 },
    ],
  },
  {
    period: 'long', label: '長期（60–240 個交易日）',
    tagCls: 'bg-blue-100 text-blue-700 border-blue-400',
    eps: 'ε = 2.0 × ATR(14)',
    epsNote: '週期長，允許更大的聚類範圍，抓取大趨勢結構壓力',
    indicators: [
      { name: '240日最高價', desc: '近 240 個交易日（約 1 年）最高點，長期供給牆', weight: 4 },
      { name: '240日最低價', desc: '近 240 個交易日最低點，長期需求底板', weight: 4 },
      { name: 'MA60（季線）',  desc: '60 日均線，機構法人常用的季線', weight: 3 },
      { name: 'MA120（半年線）',desc: '120 日均線，半年趨勢分界', weight: 3 },
      { name: 'MA240（年線）', desc: '240 日均線，牛熊分界線', weight: 4 },
      { name: '60日POC',      desc: '近 60 日（近季）成交量最集中的價格，季度公允價', weight: 5 },
      { name: '60日VAH',      desc: '近 60 日價值區域上緣', weight: 5 },
      { name: '60日VAL',      desc: '近 60 日價值區域下緣', weight: 5 },
      { name: '整數關卡點',   desc: '股價整數位，市場心理壓力/支撐，如 100、150、200', weight: 2 },
    ],
  },
];

function LogicContent() {
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>('short');

  return (
    <div className="space-y-5 text-sm text-gray-700 leading-relaxed">

      {/* Plain-language intro */}
      <InfoBox color="gray">
        <p className="font-semibold text-gray-800 mb-2">這個系統在做什麼？</p>
        <p>
          股票每天有幾十個技術指標，但指標太多反而讓人不知道看哪個。本系統的核心任務：
          <strong>每天收盤後，自動從數十個指標中篩選出最重要的「一個壓力價」和「一個支撐價」</strong>，
          並由 AI 用一句話說明。
        </p>
        <p className="mt-2">
          系統分三個時間週期：<span className="text-yellow-700 font-bold">短期</span>（5–10日，適合短線操作）、
          <span className="text-purple-700 font-bold mx-1">中期</span>（20–60日，適合波段）、
          <span className="text-blue-700 font-bold">長期</span>（60–240日，適合趨勢判斷）。
          每個週期各輸出一組壓力與支撐，合計六個關鍵價位。
        </p>
      </InfoBox>

      {/* Common Architecture */}
      <Section title="共同決策架構（三期通用）" color="slate">
        <div className="space-y-3">
          {[
            {
              step: 'L1', title: '聚類與區間化',
              content: '將所有指標依照價位相近程度分組。若多個指標彼此距離 ≤ ε（感應寬度），就視為「共振」，合併為一個區間；若孤立，視為單一線。感應寬度 ε 依據各期 ATR(14)（平均真實波幅）計算，期別越長，ε 越大。',
            },
            {
              step: 'L2', title: '意義權重評分',
              content: '針對每個聚類計算「意義分數（Zone_Score）」。公式為：Zone_Score = Σ（W × Quality_Factor）。W 是指標權重（1–5）；Quality_Factor（品質修正係數）反映該指標的「現實有效性」，見下方說明。一個指標只計一次，避免重複加分。',
            },
            {
              step: 'L3', title: '唯一最優選拔',
              content: '收盤價上方的聚類，取 Zone_Score 最高者為「唯一壓力」；收盤價下方取最高者為「唯一支撐」。若聚類寬度 ≤ 0.3%，顯示為「線」；> 0.3% 顯示為「區」（區間有上下邊界）。候選池為空時，以整數關卡或極值作為保底指標。',
            },
            {
              step: 'L4', title: 'AI戰略詮釋',
              content: '根據選出的最高分壓力與支撐，由 AI 輸出一句話客觀事實描述。嚴格禁止主觀建議，只陳述數值與指標構成。',
            },
          ].map(({ step, title, content }) => (
            <div key={step} className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold">{step}</div>
              <div>
                <p className="font-semibold text-gray-800 mb-0.5">{title}</p>
                <p className="text-gray-600">{content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-3 font-mono text-sm text-center text-gray-700">
          Zone_Score = Σ (W × Quality_Factor)
        </div>

        {/* Quality Factor detail */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 space-y-3 text-sm">
          <p className="font-bold text-gray-800">品質修正係數（Quality_Factor）說明</p>
          <p className="text-gray-600">
            Quality_Factor ∈ [0.5, 1.5]，反映單一指標在「當下市場環境」的有效程度，而非僅看靜態權重。
            三個維度計算後取乘積，最終裁切至 [0.5, 1.5]。
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">維度</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">計算方式</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">白話意義</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ['接近度（Proximity）',
                   '若指標距收盤價 ≤ 1 ATR → 係數 1.2；≤ 2 ATR → 1.0；> 2 ATR → 0.8',
                   '越近現價的指標「現在就有壓力」，加分；遠的指標降權'],
                  ['穩定度（Stability）',
                   '若該指標在過去 5 個交易日內未改變方向（如 SAR 未翻轉、均線斜率一致） → 係數 1.1；否則 → 0.9',
                   '最近沒有翻轉的指標比剛翻轉的指標更可靠'],
                  ['命中歷史（HitRate bonus）',
                   '若指標歷史命中率 ≥ 50% → 係數 1.1；45–50% → 1.0；< 45% → 0.9',
                   '統計上命中率高的指標，在這次也更有意義'],
                ].map(([dim, calc, note], i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800 align-top whitespace-nowrap">{dim}</td>
                    <td className="px-3 py-2 text-gray-600 align-top font-mono text-[11px]">{calc}</td>
                    <td className="px-3 py-2 text-gray-500 align-top">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700 text-center">
            Quality_Factor = clamp( Proximity × Stability × HitRate_bonus, 0.5, 1.5 )
          </div>
          <p className="text-xs text-gray-400">
            例：一個 ATR 內、斜率穩定、命中率 55% 的指標 → 1.2 × 1.1 × 1.1 ≈ 1.45（接近上限）。
            反之，遠離且剛翻轉的低命中率指標 → 0.8 × 0.9 × 0.9 ≈ 0.65（接近下限）。
          </p>
        </div>
      </Section>

      {/* Period-specific indicators */}
      <Section title="各期指標與感應寬度（ε）" color="slate">
        <p className="text-gray-500 mb-4 text-sm">
          三期用相同的演算架構，差異在於：使用的指標不同、ε（聚類感應寬度）不同。點選各期別查看詳細指標與權重。
        </p>

        <div className="space-y-3">
          {PERIOD_INDICATORS.map(({ period, label, tagCls, eps, epsNote, indicators }) => {
            const isOpen = expandedPeriod === period;
            return (
              <div key={period} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  onClick={() => setExpandedPeriod(isOpen ? null : period)}
                >
                  <PeriodTag label={label.split('（')[0]} cls={tagCls} />
                  <span className="font-semibold text-gray-800">{label}</span>
                  <span className="ml-auto text-xs text-gray-400 font-mono">{eps}</span>
                  <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="p-4 space-y-3">
                    <InfoBox color={period === 'short' ? 'yellow' : period === 'medium' ? 'purple' : 'blue'}>
                      <strong>感應寬度：{eps}</strong>　{epsNote}
                    </InfoBox>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">指標名稱</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">白話說明</th>
                            <th className="px-4 py-2.5 text-center font-semibold text-gray-700 w-16">權重(W)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {indicators.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                              <td className="px-4 py-2 text-gray-600 text-xs">{r.desc}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-block font-bold text-xs px-2 py-0.5 rounded-full ${
                                  r.weight >= 5 ? 'bg-red-100 text-red-700' :
                                  r.weight >= 3 ? 'bg-orange-100 text-orange-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{r.weight}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Output types */}
      <Section title="輸出結果說明" color="slate">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-bold text-red-700 mb-2">壓力（阻力位）</p>
            <p className="text-xs text-red-600">收盤價上方 Zone_Score 最高的聚類。股價接近時，賣壓可能增加，上漲難度提高。</p>
            <div className="mt-2 space-y-1 text-xs text-red-500">
              <p>• 寬度 ≤ 0.3% → <strong>壓力線</strong>（精確單點）</p>
              <p>• 寬度 &gt; 0.3% → <strong>壓力區</strong>（有上下邊界的範圍）</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-bold text-blue-700 mb-2">支撐（支撐位）</p>
            <p className="text-xs text-blue-600">收盤價下方 Zone_Score 最高的聚類。股價接近時，買盤可能進場，下跌難度提高。</p>
            <div className="mt-2 space-y-1 text-xs text-blue-500">
              <p>• 寬度 ≤ 0.3% → <strong>支撐線</strong>（精確單點）</p>
              <p>• 寬度 &gt; 0.3% → <strong>支撐區</strong>（有上下邊界的範圍）</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Difference summary */}
      <Section title="三期差異對照表" color="slate">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">項目</th>
                <th className="px-4 py-2.5 text-center font-semibold text-yellow-700">短期</th>
                <th className="px-4 py-2.5 text-center font-semibold text-purple-700">中期</th>
                <th className="px-4 py-2.5 text-center font-semibold text-blue-700">長期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {[
                ['指標數量', '12 個', '9 個', '9 個（+整數關卡）'],
                ['感應寬度 ε', '0.5 × ATR', '1.0 × ATR', '2.0 × ATR'],
                ['代表週期', '5–10 交易日', '20–60 交易日', '60–240 交易日'],
                ['VP 計算期', '近 5 日', '近 20 日', '近 60 日'],
                ['MA 主軸', 'MA5、MA10', 'MA20、MA30', 'MA60、MA120、MA240'],
                ['顯示顏色', '黃色', '紫色', '藍色'],
                ['適用情境', '短線、當沖、隔日', '波段、月線趨勢', '趨勢判斷、長線佈局'],
              ].map(([item, s, m, l], i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-700">{item}</td>
                  <td className="px-4 py-2 text-center text-yellow-700">{s}</td>
                  <td className="px-4 py-2 text-center text-purple-700">{m}</td>
                  <td className="px-4 py-2 text-center text-blue-700">{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function PromptContent() {
  return (
    <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
      <InfoBox color="gray">
        <p className="font-semibold text-gray-800 mb-1">這個功能做什麼？</p>
        你是一位冷靜的量化交易分析師。根據短期／中期／長期決策邏輯樹，在 K 線圖上標註出最具意義的支撐與壓力，並提供「一句話客觀事實解釋」。AI 只陳述事實，不給出操作建議。
      </InfoBox>

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
              {[
                ['聚合共振', '若多個指標在感應寬度 ε（短 0.5／中 1.0／長 2.0 × ATR）內重疊，視為「共振區間」'],
                ['去偽存真', '忽略低權重或孤立雜訊，僅鎖定 Zone_Score 最高的唯一目標'],
                ['區間定義', '寬度 > 0.3% 顯示為「區間（Range）」；≤ 0.3% 顯示為「線（Line）」'],
              ].map(([rule, desc], i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{rule}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{desc}</td>
                </tr>
              ))}
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
              {[
                ['< 10 元','0.01','0.05 元'],['10 – 50 元','0.05','0.1 元'],['50 – 100 元','0.1','0.5 元'],
                ['100 – 500 元','0.5','1 元'],['500 – 1000 元','1.0','5 元'],['> 1000 元','5.0','10 元'],
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
            { example: '壓力區 (153-154)：5日POC、5日VAH與10日最高共振', color: 'red' },
            { example: '支撐區 (144-146)：20日POC、20日VAL與20MA聚合',   color: 'blue' },
            { example: '壓力線 (145)：20日POC與布林通道上緣重合',         color: 'red' },
            { example: '支撐線 (180)：240MA與整數180重合',                color: 'blue' },
          ].map((ex, i) => (
            <div key={i} className={`px-4 py-2.5 rounded-lg border text-sm font-medium
              ${ex.color === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
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
    <div className="space-y-5 text-sm">

      {/* Plain-language intro */}
      <InfoBox color="green">
        <p className="font-semibold text-gray-800 mb-2">命中率是什麼意思？</p>
        <p>
          回測台股 1,900+ 檔個股，統計每個技術指標在未來 n 個交易日內「有沒有被股價碰到」的比例。
          例如「5日最高價命中率 42%」表示：在歷史資料中，約有 42% 的機率，股價在 3 個交易日內
          會碰到（或突破）該指標位置。
        </p>
        <p className="mt-2 text-xs text-gray-600">
          命中率 &gt; 50% 表示在統計上，這個指標有一定的阻力/支撐效果。但命中率不等於交易勝率，
          僅反映「價格是否到達該指標附近」，不考慮到達後的方向。
        </p>
      </InfoBox>

      {/* Column explanations */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">欄位說明</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { col: '指標', desc: '技術指標名稱' },
            { col: '方向', desc: '壓力：指標通常在股價上方。支撐：指標通常在下方。雙向：隨市況可能在上或下方。' },
            { col: '窗口(n)', desc: '回測時的觀察天數。n=3 表示看未來 3 個交易日；n=5 表示 5 個交易日。' },
            { col: '平均命中率', desc: '所有有效股票的命中率平均值。數字越高代表指標越容易被觸及。' },
            { col: '中位數', desc: '命中率的中位數，較不受少數極端值影響。若中位數與平均值差距大，代表個股差異明顯。' },
            { col: '標準差', desc: '各股命中率的分散程度。標準差越大代表「有些股票命中率高、有些很低」，指標穩定性較差。' },
            { col: '有效股票數', desc: '納入回測的個股數量（資料足夠的股票）。數量越大，結果越有統計代表性。' },
          ].map(({ col, desc }, i) => (
            <div key={i} className="flex gap-2">
              <span className="font-bold text-gray-700 shrink-0 w-20">{col}</span>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How to read */}
      <InfoBox color="gray">
        <p className="font-semibold text-gray-800 mb-1">如何解讀這張表？</p>
        <ul className="space-y-1 text-xs mt-1 list-none">
          <li>🟢 命中率 ≥ 50%：指標有統計意義，長期而言超過一半的個股會碰到這個位置</li>
          <li>🟡 命中率 45–50%：接近隨機，需搭配其他條件判斷</li>
          <li>🔴 命中率 &lt; 45%：統計效果較弱，但不代表無效，需觀察個股特性</li>
          <li>📊 標準差大（&gt;15）：個股差異大，使用前建議觀察個別股票的歷史行為</li>
        </ul>
      </InfoBox>

      {/* Table */}
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
              const hitColor = row.hit >= 50 ? 'text-green-700 font-bold' :
                               row.hit >= 45 ? 'text-yellow-700 font-semibold' : 'text-gray-600';
              const bar = Math.round((row.hit / 60) * 100);
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dir.cls}`}>{dir.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{row.n}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.hit >= 50 ? 'bg-green-500' : row.hit >= 45 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                          style={{ width: `${bar}%` }}
                        />
                      </div>
                      <span className={`tabular-nums ${hitColor}`}>{row.hit.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{row.med.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                    <span className={row.std > 15 ? 'text-orange-600 font-semibold' : ''}>{row.std.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{row.stocks.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Calculation method */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
        <p className="font-bold text-gray-800 text-base">計算方式（詳細版）</p>

        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="font-semibold text-gray-800">建立歷史觀測點</p>
              <p className="text-gray-600 text-xs mt-0.5">
                對每一檔個股，以每個交易日收盤後為一個觀測點，計算當日所有技術指標的數值。
                例如：2024-01-15 收盤後，計算 5日最高、MA5、5日POC…等所有指標值。
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p className="font-semibold text-gray-800">定義「命中」</p>
              <p className="text-gray-600 text-xs mt-0.5 mb-1">
                判斷未來 n 個交易日內，股價是否「碰到」該指標位置。碰到的定義因方向而異：
              </p>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <span className="font-bold text-red-700">壓力指標命中</span>
                  <span className="text-red-600 ml-1">：未來 n 日最高價 ≥ 指標值 × (1 − 0.5%)</span>
                  <p className="text-red-500 mt-0.5">意思：股價有沒有「摸到」壓力位附近（允許 0.5% 誤差）</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <span className="font-bold text-blue-700">支撐指標命中</span>
                  <span className="text-blue-600 ml-1">：未來 n 日最低價 ≤ 指標值 × (1 + 0.5%)</span>
                  <p className="text-blue-500 mt-0.5">意思：股價有沒有「測試到」支撐位附近（允許 0.5% 誤差）</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="font-bold text-gray-700">雙向指標（如均線）命中</span>
                  <span className="text-gray-600 ml-1">：未來 n 日最高或最低價在指標值 ±0.5% 內</span>
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-1.5">
                為什麼用 ±0.5%？因為現實中股價不會精確觸及某一點，允許小幅誤差可以過濾掉「差一點點」的情況。
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p className="font-semibold text-gray-800">計算單一股票的命中率</p>
              <p className="text-gray-600 text-xs mt-0.5">
                對每一檔個股：命中率 = 命中次數 ÷ 總觀測次數。
              </p>
              <p className="text-gray-600 text-xs mt-0.5">
                例：某股票 2 年內有 200 個觀測點，其中 5日最高命中了 88 次 → 命中率 = 88/200 = 44%。
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <p className="font-semibold text-gray-800">跨股票統計</p>
              <p className="text-gray-600 text-xs mt-0.5">
                彙整台股 1,900+ 檔有效個股的命中率，計算：
              </p>
              <ul className="text-gray-600 text-xs mt-1 space-y-0.5 list-none pl-2">
                <li>• <strong>平均命中率</strong>：所有個股命中率的算術平均</li>
                <li>• <strong>中位數</strong>：排序後的中間值（較不受極端值影響）</li>
                <li>• <strong>標準差</strong>：個股間命中率的分散程度</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">！</span>
            <div>
              <p className="font-semibold text-gray-700">重要限制</p>
              <p className="text-gray-500 text-xs mt-0.5">
                命中率只衡量「股價有沒有到達那個價位」，<strong>不代表到達後一定反彈或回落</strong>。
                例如壓力命中率 55% 代表有 55% 的次數股價會碰到壓力位，但碰到後是突破還是反轉，
                需要其他指標輔助判斷。回測數據不含交易成本，實際操作時須考慮摩擦成本。
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          資料期間：台股上市上櫃個股歷史日K資料，資料足夠計算該指標者均納入。
          有效股票數依各指標而異（部分股票因資料不足無法計算特定指標）。
        </p>
      </div>
    </div>
  );
}

const TAB_CONTENT: Record<TabKey, React.ReactNode> = {
  logic:   <LogicContent />,
  prompt:  <PromptContent />,
  hitrate: <HitRateContent />,
};

export default function ManualPage({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('logic');

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
              className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
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
