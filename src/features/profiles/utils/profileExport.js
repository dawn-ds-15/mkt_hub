export function downloadCsv(filename, rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value) => {
    let text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = '\uFEFF' + [columns, ...rows.map((row) => columns.map((key) => row[key]))].map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
