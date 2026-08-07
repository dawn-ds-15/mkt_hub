import { useState, useEffect } from 'react';

function formatNumber(str) {
  if (!str) return '';
  const cleaned = str.replace(/[^\d]/g, '');
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export default function NumberInput({ value, onChange, ...rest }) {
  const [text, setText] = useState('');

  useEffect(() => {
    const raw = String(value ?? '').replace(/[^\d]/g, '');
    setText(formatNumber(raw));
  }, [value]);

  const handleChange = (e) => {
    const cleaned = e.target.value.replace(/[^\d]/g, '');
    setText(formatNumber(cleaned));
    if (onChange) {
      onChange({ ...e, target: { ...e.target, value: cleaned } });
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      {...rest}
    />
  );
}
