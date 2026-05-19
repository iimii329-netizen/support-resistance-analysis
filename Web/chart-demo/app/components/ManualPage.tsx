'use client';

import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
type TabKey = 'sr' | 'ai';
type Period = 'short' | 'mid' | 'long';
type Trend = 'bull' | 'bear' | 'sideways';
interface Props { onBack: () => void; }

// ─── Indicator name mapping ───────────────────────────────────────────────────
const IND: Record<string, string> = {
  low_5d:'5日最低', high_5d:'5日最高', low_10d:'10日最低', high_10d:'10日最高',
  low_20d:'20日最低', high_20d:'20日最高', low_240d:'240日最低', high_240d:'240日最高',
  ma5:'MA5', ma10:'MA10', ma20:'MA20', ma30:'MA30',
  ma60:'MA60', ma120:'MA120', ma240:'MA240',
  vp5_val:'5日VAL', vp5_vah:'5日VAH', vp5_poc:'5日POC',
  vp20_val:'20日VAL', vp20_vah:'20日VAH', vp20_poc:'20日POC',
  vp60_val:'60日VAL', vp60_vah:'60日VAH', vp60_poc:'60日POC',
  bbands_lower_2std:'BB下緣(2σ)', bbands_upper_2std:'BB上緣(2σ)',
  ma_track_upper:'MA軌道上限', ma_track_lower:'MA軌道下限',
  vol_dense_upper:'上檔量密集區', vol_dense_lower:'下檔量密集區',
  lower_gate:'下關', upper_gate:'上關',
};

// ─── Period indicator definitions ────────────────────────────────────────────
const PERIOD_DEFS = {
  short: {
    label: '短期', range: '1–20 個交易日',
    tagCls: 'bg-amber-100 text-amber-800 border-amber-300',
    borderCls: 'border-l-amber-400',
    indicators: [
      '上關','下關','5日最高價','5日最低價',
      '10日最高價','10日最低價','MA5','MA10',
      '5日POC','5日VAH','5日VAL',
    ],
  },
  mid: {
    label: '中期', range: '20–60 個交易日',
    tagCls: 'bg-violet-100 text-violet-800 border-violet-300',
    borderCls: 'border-l-violet-400',
    indicators: [
      '布林通道上緣(2σ)','布林通道下緣(2σ)',
      '20日最高價','20日最低價','MA20','MA30',
      '20日POC','20日VAH','20日VAL',
      'MA軌道上限','MA軌道下限',
      '上檔量密集成交區','下檔量密集成交區',
    ],
  },
  long: {
    label: '長期', range: '60日以上',
    tagCls: 'bg-sky-100 text-sky-800 border-sky-300',
    borderCls: 'border-l-sky-400',
    indicators: [
      '240日最高價','240日最低價',
      'MA60','MA120','MA240',
      '60日POC','60日VAH','60日VAL',
    ],
  },
};

// ─── Candidate data ───────────────────────────────────────────────────────────
type Candidate = {
  sup: string; res: string;
  cont: string; width: string; isLast?: boolean;
};

const CANDIDATES: Record<string, Record<string, Candidate[]>> = {
  short: {
    all: [
      { sup:'vp5_val', res:'high_5d',  cont:'77–84%', width:'~5–6%' },
      { sup:'low_5d',  res:'vp5_vah',  cont:'73–79%', width:'~4–5%' },
      { sup:'low_5d',  res:'high_5d',  cont:'~90%',   width:'~7.5%' },
      { sup:'low_10d', res:'high_10d', cont:'~93%',   width:'~11%',  isLast:true },
    ],
  },
  mid: {
    bull: [
      { sup:'ma20',           res:'vol_dense_upper',  cont:'98.38%', width:'~4.9%' },
      { sup:'vol_dense_lower',res:'vol_dense_upper',  cont:'98.35%', width:'~5.7%' },
      { sup:'ma_track_lower', res:'vol_dense_upper',  cont:'96.58%', width:'~5.8%' },
      { sup:'ma30',           res:'vol_dense_upper',  cont:'96.32%', width:'~6.4%' },
      { sup:'vp20_val',       res:'vol_dense_upper',  cont:'96.23%', width:'~6.9%' },
      { sup:'ma20',           res:'high_20d',         cont:'96.04%', width:'~8.6%' },
      { sup:'vol_dense_lower',res:'high_20d',         cont:'96.01%', width:'~9.4%' },
      { sup:'low_20d',        res:'high_20d',         cont:'96.04%', width:'~15.1%' },
    ],
    bear: [
      { sup:'vol_dense_lower',res:'ma20',             cont:'99.66%', width:'~4.3%' },
      { sup:'vol_dense_lower',res:'vp20_vah',         cont:'99.28%', width:'~8.2%' },
      { sup:'vol_dense_lower',res:'vol_dense_upper',  cont:'99.05%', width:'~6.9%' },
      { sup:'vol_dense_lower',res:'ma_track_upper',   cont:'98.91%', width:'~5.5%' },
      { sup:'vol_dense_lower',res:'ma30',             cont:'97.81%', width:'~5.9%' },
      { sup:'low_20d',        res:'ma20',             cont:'95.16%', width:'~6.6%' },
      { sup:'vol_dense_lower',res:'high_20d',         cont:'99.66%', width:'~11.5%' },
      { sup:'low_20d',        res:'high_20d',         cont:'95.23%', width:'~15.1%' },
    ],
    sideways: [
      { sup:'vol_dense_lower',res:'vol_dense_upper',  cont:'97.64%', width:'~5.0%' },
      { sup:'vol_dense_lower',res:'high_20d',         cont:'98.03%', width:'~9.1%' },
      { sup:'low_20d',        res:'vol_dense_upper',  cont:'95.70%', width:'~8.4%' },
      { sup:'low_20d',        res:'high_20d',         cont:'96.04%', width:'~12.5%' },
    ],
  },
  long: {
    bull: [
      { sup:'ma60',    res:'high_240d', cont:'98.10%', width:'~27.5%' },
      { sup:'vp60_val',res:'high_240d', cont:'98.08%', width:'~34.9%' },
      { sup:'ma120',   res:'high_240d', cont:'88.03%', width:'~28.9%' },
      { sup:'vp60_poc',res:'high_240d', cont:'80.48%', width:'~29.0%' },
      { sup:'ma240',   res:'high_240d', cont:'74.84%', width:'~28.4%' },
      { sup:'low_240d',res:'high_240d', cont:'98.10%', width:'~44.8%' },
    ],
    bear: [
      { sup:'low_240d',res:'ma60',      cont:'98.22%', width:'~19.7%' },
      { sup:'low_240d',res:'vp60_vah',  cont:'98.21%', width:'~28.3%' },
      { sup:'low_240d',res:'ma120',     cont:'91.97%', width:'~22.4%' },
      { sup:'low_240d',res:'vp60_poc',  cont:'91.54%', width:'~22.2%' },
      { sup:'low_240d',res:'ma240',     cont:'83.56%', width:'~24.4%' },
      { sup:'low_240d',res:'high_240d', cont:'98.22%', width:'~58.2%' },
    ],
    sideways: [
      { sup:'low_240d', res:'vp60_vah',  cont:'93.77%', width:'~27.0%' },
      { sup:'vp60_val', res:'vp60_vah',  cont:'74.70%', width:'~11.9%' },
      { sup:'vp60_val', res:'ma240',     cont:'70.73%', width:'~14.9%' },
      { sup:'vp60_val', res:'high_240d', cont:'80.64%', width:'~41.7%' },
      { sup:'low_240d', res:'high_240d', cont:'99.37%', width:'~48.9%' },
    ],
  },
};

// ─── Candidate table ──────────────────────────────────────────────────────────
function CandidateTable({ rows, lastResort }: { rows: Candidate[]; lastResort: string }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-400 w-8">#</th>
            <th className="px-3 py-2.5 text-left font-semibold text-blue-700">支撐指標</th>
            <th className="px-3 py-2.5 text-left font-semibold text-red-700">壓力指標</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-20">含括率</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-600 w-20">平均寬度</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className={r.isLast ? 'bg-orange-50' : 'hover:bg-gray-50'}>
              <td className="px-3 py-2 text-gray-300 text-xs tabular-nums">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-blue-700 whitespace-nowrap">{IND[r.sup] ?? r.sup}</td>
              <td className="px-3 py-2 font-medium text-red-700 whitespace-nowrap">{IND[r.res] ?? r.res}</td>
              <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-gray-700">{r.cont}</td>
              <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-gray-500">{r.width}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-orange-100 bg-orange-50 text-xs text-orange-700">
        保底：{lastResort}，無條件輸出
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="shrink-0 w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold mt-0.5">{num}</span>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── SRTab ────────────────────────────────────────────────────────────────────
function SRTab() {
  const [openPeriod, setOpenPeriod] = useState<Period | null>('short');
  const [srPeriod,   setSrPeriod]   = useState<Period>('short');
  const [srTrend,    setSrTrend]    = useState<Trend>('bull');

  const trendLabel: Record<Trend, string> = { bull:'多頭', bear:'空頭', sideways:'盤整' };
  const trendCls: Record<Trend, string> = {
    bull:     'border-red-300 text-red-700 bg-red-50',
    bear:     'border-blue-300 text-blue-700 bg-blue-50',
    sideways: 'border-gray-300 text-gray-600 bg-gray-50',
  };
  const periodActiveCls: Record<Period, string> = {
    short: 'bg-amber-500 text-white border-amber-500',
    mid:   'bg-violet-600 text-white border-violet-600',
    long:  'bg-sky-600 text-white border-sky-600',
  };

  const candidateRows = srPeriod === 'short'
    ? CANDIDATES.short.all
    : (CANDIDATES[srPeriod]?.[srTrend] ?? []);

  const LAST_RESORT_LABELS: Record<Period, string> = {
    short: '10日最低 ＋ 10日最高',
    mid:   '20日最低 ＋ 20日最高',
    long:  '240日最低 ＋ 240日最高',
  };

  return (
    <div className="space-y-10">

      {/* ── § 1 系統概覽 ── */}
      <section>
        <SectionHeader num="1" title="系統概覽"
          sub="系統以日 K 線 + Volume Profile 為輸入，對每支股票每個交易日自動產出短 / 中 / 長期支撐壓力位，並生成一句話 AI 判讀。" />

        <div className="grid grid-cols-4 gap-2">
          {[
            { step:'1', label:'收盤資料', desc:'K 線 OHLCV + Volume Profile（5/20/60日）' },
            { step:'2', label:'趨勢判讀', desc:'close / MA20 / MA60 三者關係 → 多頭 / 空頭 / 盤整' },
            { step:'3', label:'Cascade 選線', desc:'依趨勢查通用候選清單，主要邏輯 → 保底 遞補，輸出最優 SR 對' },
            { step:'4', label:'AI 輸出', desc:'將選出的壓力 + 支撐指標名稱 + 捨入數值組成一句話' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="relative bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">STEP {step}</span>
              <span className="text-sm font-bold text-gray-900">{label}</span>
              <span className="text-xs text-gray-500 leading-relaxed">{desc}</span>
              {step !== '4' && (
                <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-bold z-10">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── § 2 趨勢判讀 ── */}
      <section>
        <SectionHeader num="2" title="趨勢判讀規則"
          sub="趨勢決定後續使用哪一份候選清單，是選線的前提條件。" />

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold text-gray-500 w-20">判讀</th>
                <th className="px-5 py-2.5 text-left font-semibold text-gray-700">判斷條件</th>
                <th className="px-5 py-2.5 text-left font-semibold text-gray-500">意涵</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {([
                { trend:'bull',     label:'多頭', cond:'收盤 > MA20  且  MA20 > MA60', meaning:'均線多頭排列，趨勢向上',       bg:'bg-red-50'  },
                { trend:'bear',     label:'空頭', cond:'收盤 < MA20  且  MA20 < MA60', meaning:'均線空頭排列，趨勢向下',       bg:'bg-blue-50' },
                { trend:'sideways', label:'盤整', cond:'其餘情況',                      meaning:'均線糾結，方向不明確',         bg:'bg-gray-50' },
              ] as const).map(r => (
                <tr key={r.trend} className={r.bg}>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded border ${trendCls[r.trend]}`}>{r.label}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{r.cond}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">{r.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── § 3 技術指標庫 ── */}
      <section>
        <SectionHeader num="3" title="技術指標庫"
          sub="依訊號有效天數分為短 / 中 / 長期，共 32 個指標。點選期別展開清單。" />

        <div className="space-y-2">
          {(['short', 'mid', 'long'] as Period[]).map(key => {
            const def = PERIOD_DEFS[key];
            const isOpen = openPeriod === key;
            return (
              <div key={key} className={`rounded-xl border overflow-hidden ${isOpen ? `border-l-4 ${def.borderCls} border-gray-200` : 'border-gray-200'}`}>
                <button
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-white hover:bg-gray-50 text-left transition-colors"
                  onClick={() => setOpenPeriod(isOpen ? null : key)}
                >
                  <span className={`text-xs font-bold px-2.5 py-1 rounded border ${def.tagCls}`}>{def.label}</span>
                  <span className="text-sm text-gray-500">{def.range}</span>
                  <span className="text-xs text-gray-400 ml-1">— {def.indicators.length} 個指標</span>
                  <span className="ml-auto text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {def.indicators.map((name, i) => (
                        <span key={i} className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-md px-3 py-1">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-900 space-y-0.5">
          <p className="font-semibold text-orange-800 mb-1">版本異動（v5.1）</p>
          <p><span className="font-bold">短期</span>：移除 SAR、中關、CDP 系列（4 個）、線性回歸值</p>
          <p><span className="font-bold">中期</span>：布林通道 3σ → 2σ</p>
          <p><span className="font-bold">長期</span>：MA250 / 250日最高低 → MA240 / 240日最高低；移除整數關卡點、2500日均線</p>
        </div>
      </section>

      {/* ── § 4 Cascade 三層選線 ── */}
      <section>
        <SectionHeader num="4" title="Cascade 選線機制"
          sub="以含括率最高的候選對為優先，逐層遞補，確保每個期別都能產出一組 SR 對。" />

        {/* 4-1 選線策略 */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">4-1 選線策略</p>
          <div className="space-y-1.5">
            {[
              { tier:'主要邏輯', label:'逐一試候選', cond:'含括率 > 70%', detail:'R > S、最小寬度（短 1%、中 2%、長 5%）', cls:'border-green-300 bg-green-50', badge:'bg-green-600 text-white' },
              { tier:'保底',    label:'N 日固定錨定對', cond:'無條件輸出', detail:'N 日最高 ≥ N 日最低由定義保證，R > S 必然成立，不依賴趨勢或 VP', cls:'border-orange-300 bg-orange-50', badge:'bg-orange-500 text-white' },
            ].map((t, i) => (
              <div key={i}>
                <div className={`rounded-xl border px-5 py-3 ${t.cls}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.badge}`}>{t.tier}</span>
                    <span className="text-xs font-semibold text-gray-600">{t.label}</span>
                    <span className="text-sm font-bold text-gray-800 ml-1">— {t.cond}</span>
                  </div>
                  <p className="text-xs text-gray-600 pl-1">{t.detail}</p>
                </div>
                {i < 1 && <p className="text-xs text-gray-400 px-5 py-1">↓ 全部候選失效</p>}
              </div>
            ))}
            <p className="text-xs text-gray-400 px-5 pt-1">↓ 保底無法計算（掛牌不足，N 日資料不夠）→ 靜默略過，不畫線</p>
          </div>
        </div>

        {/* 資料來源說明 */}
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <span className="font-semibold">含括率來源：</span>
          1,932 檔個股 K 線（2022-01-03 ～ 2026-04-28）× 408 檔 Volume Profile（2025-01-02 ～ 2026-04-20），
          涵蓋 34 個產業 × 3 期別 × 3 趨勢組合。
        </div>

        {/* 4-2 候選清單 */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">4-2 候選組合</p>

          {/* Period selector */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {(['short', 'mid', 'long'] as Period[]).map(p => (
              <button key={p}
                onClick={() => { setSrPeriod(p); if (p === 'short') setSrTrend('bull'); }}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg border transition-all ${srPeriod === p ? periodActiveCls[p] : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
              >
                {PERIOD_DEFS[p].label}
              </button>
            ))}
          </div>

          {/* Trend selector (mid/long only) */}
          {srPeriod !== 'short' && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['bull', 'bear', 'sideways'] as Trend[]).map(t => (
                <button key={t}
                  onClick={() => setSrTrend(t)}
                  className={`px-4 py-2 text-sm rounded-lg border font-bold transition-all ${srTrend === t ? trendCls[t] + ' shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                >
                  {trendLabel[t]}
                </button>
              ))}
            </div>
          )}

          {srPeriod === 'short' && (
            <div className="mb-3 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              短期三種趨勢<strong>通用同一份清單</strong>。VP5 可用時優先 #1 → #2 → #3；不可用時從 #3 開始。
            </div>
          )}

          <CandidateTable rows={candidateRows} lastResort={LAST_RESORT_LABELS[srPeriod]} />
        </div>

        {/* 4-3 LAST_RESORT */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">4-3 保底錨定對（LAST_RESORT）</p>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">期別</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-red-600">多頭</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-blue-600">空頭</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">盤整</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {[
                  { period:'短期', bull:'10日最低 ＋ 10日最高',   bear:'10日最低 ＋ 10日最高',   sw:'10日最低 ＋ 10日最高' },
                  { period:'中期', bull:'20日最低 ＋ 20日最高',   bear:'20日最低 ＋ 20日最高',   sw:'20日最低 ＋ 20日最高' },
                  { period:'長期', bull:'240日最低 ＋ 240日最高', bear:'240日最低 ＋ 240日最高', sw:'240日最低 ＋ 240日最高' },
                ].map(r => (
                  <tr key={r.period} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold text-gray-700">{r.period}</td>
                    <td className="px-4 py-2.5 text-red-700">{r.bull}</td>
                    <td className="px-4 py-2.5 text-blue-700">{r.bear}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.sw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2 px-1">
            最高 ≥ 最低由定義保證，R &gt; S 必然成立，不依賴趨勢或 VP。
          </p>
        </div>
      </section>

      {/* ── § 5 設計原則 ── */}
      <section>
        <SectionHeader num="5" title="設計原則：為何不分產業"
          sub="以下三項實證說明，通用候選清單的效力等同分產業，但工程成本大幅降低。" />

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { n:'1', title:'頂部候選完全重疊', body:'各期別 / 趨勢前幾名候選在 34 個產業的出現率均為 34/34，指標池完全相同。' },
            { n:'2', title:'差異只在排名不在指標', body:'產業間 rank=1 有輕微分歧，但差異候選都在通用清單前幾位，Cascade 自動遞補。' },
            { n:'3', title:'Cascade 本身即是軟性適配', body:'正常交易日大多在 #1 或 #2 候選命中（97–99%）。個股走勢異常時自動往下遞補。' },
          ].map(e => (
            <div key={e.n} className="bg-white border border-gray-200 rounded-xl px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{e.n}</span>
                <span className="text-sm font-semibold text-gray-800">{e.title}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{e.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">四項結論</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
            {[
              '指標池相同，無產業專屬指標',
              'Cascade 自動涵蓋產業間排名差異',
              '分產業僅讓命中率從 ~97% 升至 ~99%，但需維護 34 張 lookup table',
              '通用邏輯自動適應新上市股、產業重分類、指標資料缺失',
            ].map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="shrink-0 text-slate-400 font-bold mt-0.5">—</span>
                <span className="text-xs">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── AITab ────────────────────────────────────────────────────────────────────
function AITab() {
  return (
    <div className="space-y-8 text-gray-700">

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm leading-relaxed">
        <p className="font-semibold text-slate-800 mb-1">功能定義</p>
        <p>依短 / 中 / 長期 Cascade 選線結果，各輸出一行客觀事實描述。<strong>嚴格禁止主觀建議</strong>，只陳述指標名稱與數值。</p>
      </div>

      <section>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">輸出格式</h2>
        <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm space-y-2">
          {[
            { label:'短期', cls:'text-amber-400' },
            { label:'中期', cls:'text-violet-400' },
            { label:'長期', cls:'text-sky-400' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex gap-2">
              <span className={`font-bold ${cls} shrink-0`}>{label}：</span>
              <span className="text-gray-300">在 XXX 元有壓力（指標名稱），在 XXX 元有支撐（指標名稱）。</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">捨入規則</h2>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold text-gray-600">股價區間</th>
                <th className="px-5 py-2.5 text-left font-semibold text-gray-600">Tick 單位</th>
                <th className="px-5 py-2.5 text-left font-semibold text-gray-600">顯示精度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {[
                ['< 10 元',        '0.01', '0.05'],
                ['10 – 50 元',     '0.05', '0.1'],
                ['50 – 100 元',    '0.1',  '0.5'],
                ['100 – 500 元',   '0.5',  '1'],
                ['500 – 1,000 元', '1.0',  '5'],
                ['> 1,000 元',     '5.0',  '10'],
              ].map(([range, tick, disp], i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-2 text-gray-700">{range}</td>
                  <td className="px-5 py-2 text-gray-500 font-mono">{tick}</td>
                  <td className="px-5 py-2 font-semibold text-slate-700">{disp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2 px-1">
          捨入方向：支撐取<strong>下捨（floor）</strong>，壓力取<strong>上捨（ceil）</strong>。
        </p>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">撰寫規則</h2>
        <div className="space-y-2">
          {[
            { n:'1', title:'禁止主觀', desc:'嚴禁出現「建議」「操作」「應」「看好」等詞彙' },
            { n:'2', title:'數值先行', desc:'必須明確標註價格或區間邊界' },
            { n:'3', title:'指標來源', desc:'說明是由哪個高權重指標決定' },
            { n:'4', title:'一句話準則', desc:'不超過 50 字，直接陳述物理數據意義' },
            { n:'5', title:'顯示捨入', desc:'數值依上方級距規則捨入，支撐向下、壓力向上' },
          ].map(r => (
            <div key={r.n} className="flex gap-3 items-start bg-white border border-gray-200 rounded-xl px-4 py-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold mt-0.5">{r.n}</span>
              <div className="text-sm">
                <span className="font-semibold text-gray-800">{r.title}：</span>
                <span className="text-gray-600">{r.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">輸出範例</h2>
        <div className="space-y-2">
          {[
            { ex:'短期：在 153 元有壓力（5日最高價），在 146 元有支撐（5日VAL）。',    cls:'bg-amber-50 border-amber-200 text-amber-900' },
            { ex:'中期：在 175 元有壓力（上檔量密集區），在 162 元有支撐（MA20）。',   cls:'bg-violet-50 border-violet-200 text-violet-900' },
            { ex:'長期：在 200 元有壓力（240日最高價），在 168 元有支撐（MA60）。',    cls:'bg-sky-50 border-sky-200 text-sky-900' },
          ].map((e, i) => (
            <div key={i} className={`px-5 py-3 rounded-xl border text-sm font-medium ${e.cls}`}>{e.ex}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string }[] = [
  { key: 'sr', label: '選線邏輯' },
  { key: 'ai', label: 'AI 判讀' },
];

export default function ManualPage({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('sr');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900">支撐壓力選線決策邏輯</h1>
          </div>
          <button onClick={onBack}
            className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
            ← 返回
          </button>
        </div>
        <div className="flex px-6 gap-1 border-t border-gray-100">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === key
                  ? 'border-slate-700 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            {activeTab === 'sr' && <SRTab />}
            {activeTab === 'ai' && <AITab />}
          </div>
        </div>
      </div>
    </div>
  );
}
