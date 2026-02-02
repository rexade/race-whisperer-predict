// Test parseFile for 251115 only
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildPath = path.join(__dirname, 'buildKmTimeData.js');
const script = fs.readFileSync(buildPath, 'utf8');
// Run parseFile from build script by eval in same globals
const kmtimeDir = path.join(__dirname, '..', 'Kmtime');
const fullPath = path.join(kmtimeDir, '251115');
const dateKey = '2025-11-15';
// Minimal inline parse for one file
const text = fs.readFileSync(fullPath, 'utf8');
let root = null;
const start = text.indexOf('{');
if (start >= 0) {
  // Try parse whole object - may fail if no closing }
  const end = text.length;
  try {
    root = JSON.parse(text.slice(start, end));
  } catch {
    const first200Key = text.indexOf('"first200"');
    const bracketStart = text.indexOf('[', first200Key);
    if (bracketStart >= 0) {
      // Use skipValue logic from build script
      const skipString = (text, i) => {
        if (text[i] !== '"') return i;
        i++;
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; if (text[i - 1] === 'u') i += 4; continue; }
          if (text[i] === '"') return i + 1;
          i++;
        }
        return i;
      };
      const skipValue = (text, i) => {
        const c = text[i];
        if (c === '"') return skipString(text, i);
        if (c === '[') {
          let depth = 1;
          i++;
          while (i < text.length && depth > 0) {
            if (text[i] === '"') { i = skipString(text, i); continue; }
            if (text[i] === '[') { depth++; i++; continue; }
            if (text[i] === ']') { depth--; i++; continue; }
            if (text[i] === '{') { i = skipValue(text, i); continue; }
            i++;
          }
          return i;
        }
        return i + 1;
      };
      const arrayEnd = skipValue(text, bracketStart);
      const arr = JSON.parse(text.slice(bracketStart, arrayEnd));
      root = { first200: arr };
    }
  }
}
const records = [];
if (root && typeof root === 'object') {
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    const arr = Array.isArray(value) ? value : [value];
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') continue;
      const horseName = entry?.start?.horse?.name ?? entry?.horse?.name;
      const timings = entry?.start?.timings ?? entry?.timings ?? {};
      if (horseName && (timings.first200 != null || timings.last200 != null)) {
        records.push({ horseName: String(horseName).trim() });
      }
      for (const k of Object.keys(entry)) {
        const v = entry[k];
        if (v && typeof v === 'object' && (k === 'start' || k === 'race')) continue;
        if (Array.isArray(v)) collect(v);
        else if (v && typeof v === 'object') collect(v);
      }
    }
  };
  if (Array.isArray(root)) collect(root);
  else for (const key of Object.keys(root)) {
    const val = root[key];
    if (Array.isArray(val)) collect(val);
    else if (val && typeof val === 'object') collect(val);
  }
}
console.log('251115 records:', records.length);
const tui = records.find(r => r.horseName === 'Tui Southwind');
console.log('Tui Southwind in records:', !!tui);
