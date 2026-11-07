const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

async function run() {
  const gids = {
    'trien_lam': '1196431759',
    'ws_partner': '1364706643',
    'ws_tai_tro': '758963415',
    'ws_smartlog': '1406119876',
    'webinar': '920688791'
  };
  const outDir = path.join(__dirname, 'templates');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [name, gid] of Object.entries(gids)) {
    const url = 'https://docs.google.com/spreadsheets/d/1imjpGZ1y-BmNx46V9QkbvsaT5unwnSrF/export?format=csv&gid=' + gid;
    const content = await get(url);
    fs.writeFileSync(path.join(outDir, name + '.csv'), content);
    console.log('Saved ' + name + '.csv (' + content.length + ' chars)');
  }
}

run().catch(console.error);
