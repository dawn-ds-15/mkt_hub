import { useEffect, useRef } from 'react';

const digitsOf = (v) => String(v ?? '').replace(/[^\d]/g, '');

const groupThousands = (str) => str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function caretForDigits(formatted, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if (ch >= '0' && ch <= '9') {
      seen += 1;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export default function NumberInput({ value, onChange, ...rest }) {
  const inputRef = useRef(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || composingRef.current) return;
    const next = digitsOf(value);
    if (digitsOf(el.value) !== next) {
      el.value = groupThousands(next);
    }
  }, [value]);

  const emit = (el) => {
    if (!onChange) return;
    onChange({ target: { name: el.name, id: el.id, value: digitsOf(el.value) } });
  };

  const applyFormat = (el) => {
    const sel = el.selectionStart ?? el.value.length;
    const digitsBeforeCaret = digitsOf(el.value.slice(0, sel)).length;
    const formatted = groupThousands(digitsOf(el.value));
    if (el.value !== formatted) {
      el.value = formatted;
      const pos = caretForDigits(formatted, digitsBeforeCaret);
      try { el.setSelectionRange(pos, pos); } catch { /* noop */ }
    }
  };

  const handleChange = (e) => {
    if (composingRef.current) return;
    applyFormat(e.target);
    emit(e.target);
  };

  const handleCompositionEnd = (e) => {
    composingRef.current = false;
    applyFormat(e.target);
    emit(e.target);
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      defaultValue={groupThousands(digitsOf(value))}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={handleCompositionEnd}
      onChange={handleChange}
    />
  );
}
