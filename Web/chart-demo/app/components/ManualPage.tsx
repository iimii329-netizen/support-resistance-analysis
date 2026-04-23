'use client';

import { useState } from 'react';

interface Props {
  onBack: () => void;
}

export default function ManualPage({ onBack }: Props) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const stages = [
    {
      number: 1,
      title: 'Tier 1-5搜尋',
      subtitle: '「用最好的指標去找」',
      description: '拿出最可靠的五套指標，按優先級逐一檢查看有沒有符合條件的支撐或壓力。',
      details: [
        {
          label: '五套指標的優先級：',
          content: 'Tier 1（最優先）：5日最低點/最高點、VAL/VAH\nTier 2：POC\nTier 3：MA5、布林通道'
        },
        {
          label: '搜索邏輯：',
          content: '按Tier順序檢查 → 找到符合的就用Tier 1的 → 如果Tier 1都不符，再看Tier 2 → 依此類推'
        },
        {
          label: '成功條件（很嚴格）：',
          content: '邏輯必須正確：支撐必須 < 現價，壓力必須 > 現價\n距離必須 ≥ 3%（或7%或10%）：距離現價至少要該百分比以上（排除短期雜訊）'
        },
        {
          label: '如果同一Tier有多個符合：',
          content: '在符合條件的支撐/壓力中，選離現價最近的。\n原因：①可達性好 ②不失可靠性 ③實戰優勢'
        }
      ],
      result: '✓ 找到了就直接用，這叫「首選」，最優質的結果'
    },
    {
      number: 2,
      title: 'Tier 1邏輯檢查',
      subtitle: '「放寬要求，只看邏輯」',
      description: '階段1失敗了，就回頭看「最關鍵的指標」，但這次不要求距離，只要邏輯正確。',
      details: [
        {
          label: '只看這兩個：',
          content: '支撐：5日最低點、VAL中「< 現價」的，取最高值\n壓力：5日最高點、VAH中「> 現價」的，取最低值'
        },
        {
          label: '核心概念：',
          content: '即使距離不足3%，邏輯正確的也比不符合邏輯的更可靠'
        }
      ],
      result: '✓ 找到了，這叫「次選」，品質還不錯'
    },
    {
      number: 3,
      title: '框架極值',
      subtitle: '「用這個時間框架內的真實高低點」',
      description: '階段1和2都失敗了？那就直接用「5天內的極值」，無論它是否在Tier 1中。',
      details: [
        {
          label: '為什麼要保留階段3？',
          content: '防止邏輯漏洞。即使理論上階段2和3重複，但保留階段3確保：\n①邏輯完整性 ②清晰度'
        },
        {
          label: '實際執行時：',
          content: '大多數情況：階段2成功，階段3被跳過\n創新高/低情況：階段1、2都失敗，階段3也失敗，直接跳到階段4'
        }
      ],
      result: '✓ 找到了，這叫「降級」（已經開始降級了，品質下降中）'
    },
    {
      number: 4,
      title: '更大框架',
      subtitle: '「看20天而不是5天」',
      description: '5天的數據都不夠用了？那就擴大看20天（或60日）。',
      details: [
        {
          label: '支撐選法：',
          content: '取20日來的最低點（只要它 < 現價）'
        },
        {
          label: '壓力選法：',
          content: '取20日來的最高點（只要它 > 現價）'
        }
      ],
      result: '✓ 找到了，還是「降級」品質'
    },
    {
      number: 5,
      title: '級聯框架',
      subtitle: '「長期獨有，短期跳過」',
      description: '短期和中期無級聯框架，只有長期有（120日、240日）。',
      details: [
        {
          label: '長期的級聯框架：',
          content: '級聯框架I：120日最低點/最高點\n級聯框架II：240日最低點/最高點'
        }
      ],
      result: '✓ 長期特有的降級邏輯'
    },
    {
      number: 6,
      title: '整數防線',
      subtitle: '「交易者喜歡整數，所以整數位置有支撐」',
      description: '前面的技術指標都失敗了？那就找「整數」位置。為什麼？因為心理學。',
      details: [
        {
          label: '短期搜索規則：',
          content: '現價 = P，Tier最遠值 = T\n搜索範圍：T × (1±5%)\n搜索目標：在範圍內找0/5尾數\n支撐：找「< T」的最大0/5尾數\n壓力：找「> T」的最小0/5尾數\n\n例子：T = 102\n支撐範圍：96.9 ~ 102，尋找：100、95...\n壓力範圍：102 ~ 107.1，尋找：105、110...'
        },
        {
          label: '中期和長期：',
          content: '中期：0尾數，範圍±12%\n長期：世紀大關，範圍±18%'
        }
      ],
      result: '✓ 找到了，這叫「防線」，是心理層面的支撐'
    },
    {
      number: 7,
      title: '最遠值',
      subtitle: '「保證一定有輸出」',
      description: '上面六個階段全部失敗？那就用「所有候選中最遠的那個」。',
      details: [
        {
          label: '支撐選法：',
          content: '把Tier 1-5的所有值、當前框架和更大框架的高低點全部蒐集起來，取最小值。'
        },
        {
          label: '壓力選法：',
          content: '把Tier 1-5的所有值、當前框架和更大框架的高低點全部蒐集起來，取最大值。'
        },
        {
          label: '保障機制：',
          content: '確保在任何情況下都能找到一個支撐或壓力點'
        }
      ],
      result: '✓ 最後保障，保證必有輸出'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* 頁頭 */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">支撐壓力決策邏輯說明書</h1>
          <button
            onClick={onBack}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg
                       hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg active:shadow-sm"
          >
            ← 回K線圖
          </button>
        </div>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-12">
          <article className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 space-y-10">

            {/* 框架總覽 */}
            <section>
              <h2 className="text-3xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-blue-500">
                框架總覽
              </h2>
              <pre className="bg-slate-50 border border-slate-300 rounded-lg p-6 overflow-x-auto text-sm font-mono text-slate-800 leading-relaxed">
{`支撐壓力決策框架
│
├─ 短期（5日）支撐/壓力
│   ├─ 最小距離：3%
│   ├─ Tier來源：5日極值、POC、MA5、布林通道
│   ├─ 降級目標：5日 → 20日 → 整數防線 → 最遠值
│   └─ 整數防線：0/5尾數，範圍±5%
│
├─ 中期（20日）支撐/壓力
│   ├─ 最小距離：7%
│   ├─ Tier來源：20日極值、POC、MA20、布林通道
│   ├─ 降級目標：20日 → 60日 → 整數防線 → 最遠值
│   └─ 整數防線：0尾數，範圍±12%
│
└─ 長期（60日）支撐/壓力
    ├─ 最小距離：10%
    ├─ Tier來源：60日極值、POC、MA60、布林通道
    ├─ 降級目標：60日 → 120日 → 240日 → 整數防線 → 最遠值
    └─ 整數防線：世紀大關，範圍±18%`}
              </pre>
            </section>

            {/* 短期決策表 */}
            <section>
              <h2 className="text-3xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-red-500">
                短期決策表（5日框架）
              </h2>
              <div className="overflow-x-auto rounded-lg border border-slate-300 mb-8">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-red-100 to-red-50 border-b border-red-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-red-900">階段</th>
                      <th className="px-4 py-3 text-left font-bold text-red-900">操作</th>
                      <th className="px-4 py-3 text-left font-bold text-red-900">支撐候選</th>
                      <th className="px-4 py-3 text-left font-bold text-red-900">壓力候選</th>
                      <th className="px-4 py-3 text-left font-bold text-red-900">成功條件</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">1</td>
                      <td className="px-4 py-3 text-slate-800">Tier 1-5搜尋</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">5日最低點、VAL、POC、MA5、布林下軌</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">5日最高點、VAH、POC、MA5、布林上軌</td>
                      <td className="px-4 py-3 text-red-700 font-semibold">邏輯正確 + 距離≥3%</td>
                    </tr>
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">2</td>
                      <td className="px-4 py-3 text-slate-800">Tier 1邏輯檢查</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">5日最低點/VAL 中的最高值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">5日最高點/VAH 中的最低值</td>
                      <td className="px-4 py-3 text-amber-700 font-semibold">邏輯正確，距離可忽略</td>
                    </tr>
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">3</td>
                      <td className="px-4 py-3 text-slate-800">框架極值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">5日實際最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">5日實際最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">4</td>
                      <td className="px-4 py-3 text-slate-800">更大框架</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">5</td>
                      <td className="px-4 py-3 text-slate-800">級聯框架</td>
                      <td colSpan={3} className="px-4 py-3 text-slate-500 italic">N/A（短期無級聯）</td>
                    </tr>
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">6</td>
                      <td className="px-4 py-3 text-slate-800">整數防線</td>
                      <td colSpan={2} className="px-4 py-3 text-slate-700 text-xs">0/5尾數，範圍±5%</td>
                      <td className="px-4 py-3 text-slate-700">範圍內有符合的整數</td>
                    </tr>
                    <tr className="hover:bg-red-50">
                      <td className="px-4 py-3 font-bold text-slate-900">7</td>
                      <td className="px-4 py-3 text-slate-800">最遠值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">所有候選最小值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">所有候選最大值</td>
                      <td className="px-4 py-3 text-green-700 font-semibold">保證必有輸出</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 七個階段詳解 */}
              <h3 className="text-2xl font-bold text-slate-900 mb-4 mt-8 flex items-center gap-2">
                <span>🔍</span> 七個階段的白話詳解
              </h3>
              <div className="space-y-3">
                {stages.map((stage) => (
                  <div
                    key={stage.number}
                    className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50 hover:shadow-md transition-shadow"
                  >
                    <button
                      onClick={() => setExpandedStage(expandedStage === stage.number ? null : stage.number)}
                      className="w-full px-6 py-4 flex items-start justify-between bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white font-bold text-sm">
                            {stage.number}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900">{stage.title}</h4>
                            <p className="text-sm text-slate-600">{stage.subtitle}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 mt-2 ml-11">{stage.description}</p>
                      </div>
                      <div className="ml-4 text-slate-400 text-2xl transition-transform" style={{
                        transform: expandedStage === stage.number ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>
                        ▼
                      </div>
                    </button>

                    {expandedStage === stage.number && (
                      <div className="px-6 py-4 bg-white border-t border-slate-300 space-y-4">
                        {stage.details.map((detail, idx) => (
                          <div key={idx}>
                            <p className="font-semibold text-slate-900 mb-2">{detail.label}</p>
                            <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-sm font-mono text-slate-800 whitespace-pre-wrap">
                              {detail.content}
                            </pre>
                          </div>
                        ))}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <p className="font-semibold text-green-700 text-base">{stage.result}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 中期決策表 */}
            <section>
              <h2 className="text-3xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-amber-500">
                中期決策表（20日框架）
              </h2>
              <div className="overflow-x-auto rounded-lg border border-slate-300">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-amber-100 to-amber-50 border-b border-amber-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-amber-900">階段</th>
                      <th className="px-4 py-3 text-left font-bold text-amber-900">操作</th>
                      <th className="px-4 py-3 text-left font-bold text-amber-900">支撐候選</th>
                      <th className="px-4 py-3 text-left font-bold text-amber-900">壓力候選</th>
                      <th className="px-4 py-3 text-left font-bold text-amber-900">成功條件</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">1</td>
                      <td className="px-4 py-3 text-slate-800">Tier 1-5搜尋</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日最低點、VAL、POC、MA20、布林下軌</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日最高點、VAH、POC、MA20、布林上軌</td>
                      <td className="px-4 py-3 text-red-700 font-semibold">邏輯正確 + 距離≥7%</td>
                    </tr>
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">2</td>
                      <td className="px-4 py-3 text-slate-800">Tier 1邏輯檢查</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日最低點/VAL 中的最高值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日最高點/VAH 中的最低值</td>
                      <td className="px-4 py-3 text-amber-700 font-semibold">邏輯正確，距離可忽略</td>
                    </tr>
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">3</td>
                      <td className="px-4 py-3 text-slate-800">框架極值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日實際最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">20日實際最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">4</td>
                      <td className="px-4 py-3 text-slate-800">更大框架</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">5</td>
                      <td className="px-4 py-3 text-slate-800">級聯框架</td>
                      <td colSpan={3} className="px-4 py-3 text-slate-500 italic">N/A（中期無級聯）</td>
                    </tr>
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">6</td>
                      <td className="px-4 py-3 text-slate-800">整數防線</td>
                      <td colSpan={2} className="px-4 py-3 text-slate-700 text-xs">0尾數，範圍±12%</td>
                      <td className="px-4 py-3 text-slate-700">範圍內有符合的整數</td>
                    </tr>
                    <tr className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-bold text-slate-900">7</td>
                      <td className="px-4 py-3 text-slate-800">最遠值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">所有候選最小值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">所有候選最大值</td>
                      <td className="px-4 py-3 text-green-700 font-semibold">保證必有輸出</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 長期決策表 */}
            <section>
              <h2 className="text-3xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-green-600">
                長期決策表（60日框架）
              </h2>
              <div className="overflow-x-auto rounded-lg border border-slate-300">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-green-100 to-green-50 border-b border-green-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-green-900">階段</th>
                      <th className="px-4 py-3 text-left font-bold text-green-900">操作</th>
                      <th className="px-4 py-3 text-left font-bold text-green-900">支撐候選</th>
                      <th className="px-4 py-3 text-left font-bold text-green-900">壓力候選</th>
                      <th className="px-4 py-3 text-left font-bold text-green-900">成功條件</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">1</td>
                      <td className="px-4 py-3 text-slate-800">Tier 1-5搜尋</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日最低點、VAL、POC、MA60、布林下軌</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日最高點、VAH、POC、MA60、布林上軌</td>
                      <td className="px-4 py-3 text-red-700 font-semibold">邏輯正確 + 距離≥10%</td>
                    </tr>
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">2</td>
                      <td className="px-4 py-3 text-slate-800">Tier 1邏輯檢查</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日最低點/VAL 中的最高值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日最高點/VAH 中的最低值</td>
                      <td className="px-4 py-3 text-amber-700 font-semibold">邏輯正確，距離可忽略</td>
                    </tr>
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">3</td>
                      <td className="px-4 py-3 text-slate-800">框架極值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日實際最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">60日實際最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">4</td>
                      <td className="px-4 py-3 text-slate-800">級聯框架I</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">120日最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">120日最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">5</td>
                      <td className="px-4 py-3 text-slate-800">級聯框架II</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">240日最低點</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">240日最高點</td>
                      <td className="px-4 py-3 text-slate-700">候選 &lt; 現價（支）或 &gt; 現價（壓）</td>
                    </tr>
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">6</td>
                      <td className="px-4 py-3 text-slate-800">整數防線</td>
                      <td colSpan={2} className="px-4 py-3 text-slate-700 text-xs">世紀大關，範圍±18%</td>
                      <td className="px-4 py-3 text-slate-700">範圍內有符合的世紀大關</td>
                    </tr>
                    <tr className="hover:bg-green-50">
                      <td className="px-4 py-3 font-bold text-slate-900">7</td>
                      <td className="px-4 py-3 text-slate-800">最遠值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">所有候選最小值</td>
                      <td className="px-4 py-3 text-slate-700 text-xs">所有候選最大值</td>
                      <td className="px-4 py-3 text-green-700 font-semibold">保證必有輸出</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 三框架核心差異對比 */}
            <section>
              <h2 className="text-3xl font-bold text-slate-900 mb-6 pb-3 border-b-2 border-purple-500">
                三框架核心差異對比
              </h2>

              <div className="space-y-6">
                {/* 識別要求表 */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">識別要求的嚴格度</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-300">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-300">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">項目</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">短期</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">中期</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">長期</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-800">最小距離</td>
                          <td className="px-4 py-2"><span className="bg-red-100 text-red-800 px-2 py-1 rounded font-bold">3%</span></td>
                          <td className="px-4 py-2"><span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">7%</span></td>
                          <td className="px-4 py-2"><span className="bg-green-100 text-green-800 px-2 py-1 rounded font-bold">10%</span></td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-800">約束力</td>
                          <td className="px-4 py-2 text-slate-700">最嚴格</td>
                          <td className="px-4 py-2 text-slate-700">中等</td>
                          <td className="px-4 py-2 text-slate-700">最寬鬆</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 整數防線特性表 */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">整數防線的特性</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-300">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-300">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">項目</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">短期</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">中期</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-900">長期</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-800">防線類型</td>
                          <td className="px-4 py-2 text-slate-700">0/5尾數</td>
                          <td className="px-4 py-2 text-slate-700">0尾數</td>
                          <td className="px-4 py-2 text-slate-700">世紀大關</td>
                        </tr>
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-800">例子</td>
                          <td className="px-4 py-2 text-slate-700">105、110、115</td>
                          <td className="px-4 py-2 text-slate-700">100、110、120</td>
                          <td className="px-4 py-2 text-slate-700">1000、500、2000</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-800">搜索範圍</td>
                          <td className="px-4 py-2"><span className="bg-red-100 text-red-800 px-2 py-1 rounded font-bold">±5%</span></td>
                          <td className="px-4 py-2"><span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">±12%</span></td>
                          <td className="px-4 py-2"><span className="bg-green-100 text-green-800 px-2 py-1 rounded font-bold">±18%</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            {/* 底部間距 */}
            <div className="pt-8 border-t border-slate-200 text-center text-sm text-slate-600">
              <p>最後更新：2026年4月23日</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
