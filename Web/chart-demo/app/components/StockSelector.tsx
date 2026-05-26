'use client';

const STOCK_LIST = [
  { id: '1101.TW', code: '1101' },
  { id: '1201.TW', code: '1201' },
  { id: '1240.TW', code: '1240' },
  { id: '1268.TW', code: '1268' },
  { id: '1301.TW', code: '1301' },
  { id: '1316.TW', code: '1316' },
  { id: '1319.TW', code: '1319' },
  { id: '1342.TW', code: '1342' },
  { id: '1409.TW', code: '1409' },
  { id: '1432.TW', code: '1432' },
  { id: '1503.TW', code: '1503' },
  { id: '1603.TW', code: '1603' },
  { id: '1707.TW', code: '1707' },
  { id: '1708.TW', code: '1708' },
  { id: '1802.TW', code: '1802' },
  { id: '1815.TW', code: '1815' },
  { id: '1907.TW', code: '1907' },
  { id: '2002.TW', code: '2002' },
  { id: '2103.TW', code: '2103' },
  { id: '2317.TW', code: '2317' },
  { id: '2323.TW', code: '2323' },
  { id: '2330.TW', code: '2330' },
  { id: '2347.TW', code: '2347' },
  { id: '2382.TW', code: '2382' },
  { id: '2412.TW', code: '2412' },
  { id: '2603.TW', code: '2603' },
  { id: '2881.TW', code: '2881' },
  { id: '2903.TW', code: '2903' },
  { id: '2926.TW', code: '2926' },
  { id: '2947.TW', code: '2947' },
  { id: '3158.TW', code: '3158' },
  { id: '3708.TW', code: '3708' },
  { id: '6505.TW', code: '6505' },
  { id: '8044.TW', code: '8044' },
] as const;

interface SRLevelsSummary {
  name: string;
  close: number;
  change_pct: number;
}

interface Props {
  srLevelsData: Record<string, SRLevelsSummary>;
  selectedId: string;
  onSelect: (id: string) => void;
}

function fmtClose(v: number): string {
  if (v < 10)  return v.toFixed(2);
  if (v < 100) return v.toFixed(1);
  return v.toFixed(0);
}

export default function StockSelector({ srLevelsData, selectedId, onSelect }: Props) {
  const selectedData = selectedId ? srLevelsData[selectedId] : null;

  return (
    <div className="bg-white border-b border-gray-200 px-5 pt-2.5 pb-2.5">
      {/* 已選股票資訊 */}
      <div className="flex items-center gap-2.5 mb-2 h-6">
        <span className="text-xs font-bold text-gray-400 shrink-0">選股</span>
        {selectedData && (
          <>
            <span className="text-sm font-semibold text-gray-800">{selectedData.name}</span>
            <span className="text-sm font-bold tabular-nums text-gray-900">
              {fmtClose(selectedData.close)} 元
            </span>
            <span className={[
              'text-sm font-bold tabular-nums',
              selectedData.change_pct >= 0 ? 'text-red-600' : 'text-green-700',
            ].join(' ')}>
              {selectedData.change_pct >= 0 ? '▲' : '▼'}{Math.abs(selectedData.change_pct).toFixed(2)}%
            </span>
          </>
        )}
      </div>

      {/* 全部 34 支股票按鈕 */}
      <div className="flex flex-wrap gap-1.5">
        {STOCK_LIST.map(s => {
          const isSelected = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={[
                'px-2 py-1 rounded-md border text-xs font-bold tabular-nums transition-all shrink-0',
                isSelected
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50',
              ].join(' ')}
            >
              {s.code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
