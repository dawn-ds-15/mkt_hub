const fs = require('fs');
const path = require('path');

function parseCsv(content) {
  const lines = content.split(/\r?\n/);
  const tasks = [];
  let currentGroup = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect group headers like " ▶ 1. KẾ HOẠCH, CHI PHÍ & KPIs"
    if (line.includes('▶') || line.includes('✦') || line.match(/^[0-9]+\.\s+[A-ZÀ-Ỹ\s,&]+/i)) {
      const match = line.match(/[0-9]+\.\s*([^,"]+)/);
      if (match) {
        currentGroup = match[1].trim();
      }
      continue;
    }

    // Parse CSV line handling quotes
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim());

    if (cells.length < 2) continue;
    const stt = cells[0];
    const name = cells[1];
    const desc = cells[2] || '';
    const pic = cells[3] || '';
    const stakeholders = cells[4] || '';
    const startOffset = cells[5] || '';
    const endOffset = cells[6] || '';
    const status = cells[7] || 'Planning';
    const priority = cells[8] || 'Medium';

    if (!name || name === 'Hạng Mục / Task' || name.startsWith('✦') || name.startsWith('Tên sự kiện')) {
      continue;
    }

    // Convert priority to High / Medium / Low
    let prio = 'Medium';
    if (priority.toLowerCase().includes('cao')) prio = 'High';
    else if (priority.toLowerCase().includes('thấp')) prio = 'Low';
    else if (priority.toLowerCase().includes('khẩn')) prio = 'Critical';

    // Parse T-X days offset
    let daysBeforeDeadline = 7;
    const matchDays = (endOffset || startOffset).match(/T\s*-\s*([0-9]+)/i);
    if (matchDays) {
      daysBeforeDeadline = parseInt(matchDays[1], 10);
    } else if ((endOffset || startOffset).toLowerCase().includes('t-')) {
      const m = (endOffset || startOffset).match(/([0-9]+)/);
      if (m) daysBeforeDeadline = parseInt(m[1], 10);
    }

    tasks.push({
      group: currentGroup,
      name: name.replace(/^"|"$/g, '').trim(),
      description: desc.replace(/^"|"$/g, '').trim(),
      priority: prio,
      stakeholders: stakeholders.replace(/^"|"$/g, '').trim(),
      daysBeforeDeadline,
      startOffset,
      endOffset,
    });
  }
  return tasks;
}

const templates = {
  exhibition: parseCsv(fs.readFileSync(path.join(__dirname, 'templates/trien_lam.csv'), 'utf8')),
  workshop_partner: parseCsv(fs.readFileSync(path.join(__dirname, 'templates/ws_partner.csv'), 'utf8')),
  workshop_tai_tro: parseCsv(fs.readFileSync(path.join(__dirname, 'templates/ws_tai_tro.csv'), 'utf8')),
  workshop_smartlog: parseCsv(fs.readFileSync(path.join(__dirname, 'templates/ws_smartlog.csv'), 'utf8')),
  webinar: parseCsv(fs.readFileSync(path.join(__dirname, 'templates/webinar.csv'), 'utf8')),
};

fs.writeFileSync(
  path.join(__dirname, '../src/modules/projects-tasks/event-templates.data.ts'),
  'export const EVENT_TEMPLATES_DATA = ' + JSON.stringify(templates, null, 2) + ';\n'
);

console.log('Generated event-templates.data.ts successfully!');
console.log('Exhibition tasks:', templates.exhibition.length);
console.log('Workshop Partner tasks:', templates.workshop_partner.length);
console.log('Workshop Tai Tro tasks:', templates.workshop_tai_tro.length);
console.log('Workshop Smartlog tasks:', templates.workshop_smartlog.length);
console.log('Webinar tasks:', templates.webinar.length);
