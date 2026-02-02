import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(__dirname, '..', 'Kmtime', '251025'), 'utf8');
const keyIdx = raw.indexOf('"first200"');
const start = raw.lastIndexOf('{', keyIdx);
const json = raw.slice(start).trimEnd() + '}';
console.log('start', start, 'keyIdx', keyIdx);
console.log('first 80:', JSON.stringify(json.slice(0, 80)));
console.log('last 30:', JSON.stringify(json.slice(-30)));
console.log('length', json.length);
try {
  const o = JSON.parse(json);
  console.log('keys', Object.keys(o));
  console.log('first200 length', o.first200?.length);
  const first = o.first200?.[0];
  console.log('first horse', first?.start?.horse?.name ?? first?.horse?.name);
} catch (e) {
  console.log('parse error', e.message);
}
