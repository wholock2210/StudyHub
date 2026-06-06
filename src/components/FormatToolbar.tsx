import { useState, useRef, useEffect, useCallback } from 'react';
import { FORMAT_COLORS } from '../utils/markdown';

interface FormatToolbarProps {
  targetId: string;
  value: string;
  onChange: (value: string) => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  compact?: boolean;
}

export default function FormatToolbar({ targetId, value, onChange, showPreview, onTogglePreview, compact }: FormatToolbarProps) {
  const [showColors, setShowColors] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const insertWrap = useCallback((prefix: string, suffix?: string) => {
    const textarea = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const s = suffix ?? prefix;
    const placeholder = selected || 'text';
    const newText = value.slice(0, start) + prefix + placeholder + s + value.slice(end);
    onChange(newText);
    const cursorPos = start + prefix.length + placeholder.length + s.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        selected ? cursorPos : start + prefix.length,
        selected ? cursorPos : start + prefix.length + placeholder.length
      );
    }, 0);
  }, [targetId, value, onChange]);

  const insertColor = useCallback((color: string) => {
    insertWrap(`{${color}}`, `{/${color}}`);
    setShowColors(false);
    setHexInput('');
  }, [insertWrap]);

  const handleHexSubmit = () => {
    const hex = hexInput.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
      insertColor(hex);
    }
  };

  const btnClass = compact
    ? 'w-7 h-7 flex items-center justify-center text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-700 dark:text-gray-300 hover:scale-110 active:scale-95'
    : 'px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-700 dark:text-gray-300 hover:scale-105 active:scale-95';

  const buttons = [
    { label: 'B', title: 'In đậm **text**', action: () => insertWrap('**'), cls: 'font-bold' },
    { label: 'I', title: 'In nghiêng *text*', action: () => insertWrap('*'), cls: 'italic' },
    { label: 'U', title: 'Gạch chân __text__', action: () => insertWrap('__'), cls: 'underline' },
    { label: 'S', title: 'Gạch ngang ~~text~~', action: () => insertWrap('~~'), cls: 'line-through' },
    { label: 'H', title: 'Tô sáng ==text==', action: () => insertWrap('=='), cls: '' },
    { label: '<>', title: 'Code `text`', action: () => insertWrap('`'), cls: 'font-mono text-[10px]' },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {buttons.map(btn => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.action}
          className={`${btnClass} ${btn.cls}`}
          title={btn.title}
        >
          {btn.label}
        </button>
      ))}

      {/* Color picker */}
      <div className="relative" ref={colorRef}>
        <button
          type="button"
          onClick={() => setShowColors(!showColors)}
          className={`${btnClass} flex items-center gap-1`}
          title="Màu chữ"
        >
          <span className="w-3.5 h-3.5 rounded-full bg-linear-to-br from-red-500 via-green-500 to-blue-500 border border-gray-300 dark:border-gray-600"></span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">▾</span>
        </button>
        {showColors && (
          <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-3 w-max max-w-[calc(100vw-2rem)] animate-scaleIn">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">Chọn màu</p>
            <div className="grid grid-cols-4 gap-1.5 mb-3 min-w-44">
              {FORMAT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => insertColor(color)}
                  className="group flex flex-col items-center gap-0.5 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span
                    className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-600 group-hover:scale-110 transition-transform shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300">{color}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Màu tuỳ chỉnh</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={hexInput}
                  onChange={e => setHexInput(e.target.value)}
                  placeholder="#ff6600"
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  onKeyDown={e => e.key === 'Enter' && handleHexSubmit()}
                />
                <button
                  type="button"
                  onClick={handleHexSubmit}
                  className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {onTogglePreview && (
        <>
          <span className="text-gray-300 dark:text-gray-600 mx-0.5">|</span>
          <button
            type="button"
            onClick={onTogglePreview}
            className={`${btnClass} ${showPreview ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300' : ''}`}
          >
            {showPreview ? 'Sửa' : 'Xem'}
          </button>
        </>
      )}
    </div>
  );
}
