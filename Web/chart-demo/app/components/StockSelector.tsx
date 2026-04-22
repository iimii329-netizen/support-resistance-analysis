'use client';

import { useState, useRef, useEffect } from 'react';
import { StockData } from '../types';

interface Props {
  stocks: StockData[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function StockSelector({ stocks, selectedId, onSelect }: Props) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const wrapperRef              = useRef<HTMLDivElement>(null);

  // 點外側關閉下拉選單
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 過濾清單
  const filtered = query.trim()
    ? stocks.filter(
        (s) =>
          s.stock_id.includes(query.trim()) ||
          s.name.includes(query.trim())
      )
    : stocks;

  const selected = stocks.find((s) => s.stock_id === selectedId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">

      {/* 搜尋框 + 下拉 */}
      <div ref={wrapperRef} className="relative">
        <input
          type="text"
          value={query}
          placeholder="輸入代號或名稱"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-36 px-2 py-1 text-sm border border-gray-300 rounded
                     focus:outline-none focus:border-blue-400"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-50 top-full left-0 mt-1 w-44 bg-white border
                         border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((s) => (
              <li
                key={s.stock_id}
                onMouseDown={() => handleSelect(s.stock_id)}
                className={[
                  'flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer',
                  s.stock_id === selectedId
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="font-medium">{s.stock_id}</span>
                <span className="text-gray-500 text-xs">{s.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 快捷按鈕 */}
      <div className="flex gap-1.5">
        {stocks.map((s) => (
          <button
            key={s.stock_id}
            onClick={() => handleSelect(s.stock_id)}
            className={[
              'px-2.5 py-1 text-xs rounded border transition-colors',
              s.stock_id === selectedId
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600',
            ].join(' ')}
          >
            {s.stock_id}
          </button>
        ))}
      </div>

      {/* 目前選取股票資訊 */}
      {selected && (
        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-800">{selected.name}</span>
          <span className="text-base font-bold text-gray-900">
            {selected.current_price.toLocaleString()}
          </span>
          <span
            className={[
              'text-sm font-medium',
              selected.change_pct >= 0 ? 'text-red-500' : 'text-green-600',
            ].join(' ')}
          >
            {selected.change_pct >= 0 ? '+' : ''}{selected.change_pct.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
