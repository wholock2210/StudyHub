import { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WordTranslator from './WordTranslator';

interface TranslatableTextProps {
  html: string;
  enabled: boolean;
  className?: string;
}

export default function TranslatableText({ html, enabled, className }: TranslatableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translator, setTranslator] = useState<{ word: string; position: { x: number; y: number } } | null>(null);
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Clean up highlight after animation
  useEffect(() => {
    if (!highlightedWord) return;
    const timer = setTimeout(() => setHighlightedWord(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedWord]);

  const getWordFromTarget = useCallback((target: EventTarget | null): string | null => {
    if (!target || !(target instanceof HTMLElement)) return null;
    // Walk up to find the word-span
    const el = target.closest('[data-word]') as HTMLElement | null;
    if (!el) return null;
    return el.dataset.word || el.textContent?.trim() || null;
  }, []);

  const showTranslator = useCallback((word: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setHighlightedWord(word);
    setTranslator({
      word,
      position: {
        x: rect.left + window.scrollX + rect.width / 2 - 160,
        y: rect.bottom + window.scrollY + 8,
      },
    });
  }, []);

  // Click handler (works for both mouse and touch tap)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    const word = getWordFromTarget(e.target);
    if (!word || word.length > 50 || word.includes(' ')) return;
    // Only translate single English words
    if (!/^[a-zA-Z'-]+$/.test(word)) return;
    const el = (e.target as HTMLElement).closest('[data-word]') as HTMLElement;
    if (el) showTranslator(word, el);
  }, [enabled, getWordFromTarget, showTranslator]);

  // Long press for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      const word = getWordFromTarget(e.target);
      if (!word || word.length > 50 || !/^[a-zA-Z'-]+$/.test(word)) return;
      const el = (e.target as HTMLElement).closest('[data-word]') as HTMLElement;
      if (el) {
        e.preventDefault();
        showTranslator(word, el);
      }
    }, 500);
  }, [enabled, getWordFromTarget, showTranslator]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    // Cancel long press if finger moves too much
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  if (!enabled) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Wrap each word in a span with data-word attribute, skipping HTML tags
  const wrappedHtml = html.replace(
    /(<[^>]*>)|([a-zA-Z'-]+)/g,
    (_match, tag, word) => {
      if (tag) return tag;
      const isHighlighted = highlightedWord === word;
      return `<span data-word="${word}" class="translatable-word${isHighlighted ? ' translatable-highlight' : ''}">${word}</span>`;
    }
  );

  return (
    <>
      <span
        ref={containerRef}
        className={`${className} translatable-container`}
        dangerouslySetInnerHTML={{ __html: wrappedHtml }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      />
      {translator && createPortal(
        <WordTranslator
          key={translator.word}
          word={translator.word}
          position={translator.position}
          onClose={() => {
            setTranslator(null);
            setHighlightedWord(null);
          }}
        />,
        document.body
      )}
    </>
  );
}
