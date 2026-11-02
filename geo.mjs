import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
export function addressOnly(value) {
  const input = String(value || '').trim();
  if (input.startsWith('[')) return input.slice(1, input.indexOf(']'));
  if (isIP(input)) return input;
  const host = input.replace(/:\d+$/, '');
  return isIP(host) ? host : '';
}
function ipv4(ip) { return ip.split('.').reduce((sum, part) => sum * 256 + Number(part), 0); }
function ipv6(ip) {
  if (ip.includes('.')) { const i = ip.lastIndexOf(':'); const value = ipv4(ip.slice(i + 1)); ip = `${ip.slice(0, i)}:${(value >>> 16).toString(16)}:${(value & 65535).toString(16)}`; }
  const [left, right] = ip.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const parts = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill('0'), ...b];
  return parts.reduce((sum, part) => (sum << 16n) + BigInt(`0x${part || '0'}`), 0n);
}
export async function loadCountries(directory) {
  const tables = {};
  for (const family of [4, 6]) {
    try {
      const data = await readFile(new URL(`country-ipv${family}.csv`, directory), 'utf8');
      const rows = data.trim().split(/\r?\n/).map(line => { const [start, end, country] = line.split(','); return [family === 4 ? Number(start) : BigInt(start), family === 4 ? Number(end) : BigInt(end), country]; });
      tables[family] = rows;
    } catch { tables[family] = []; }
  }
  const cache = new Map();
  return function country(address) {
    const ip = addressOnly(address), family = isIP(ip);
    if (!family || /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip) || ip === '::1' || /^(?:fc|fd|fe80:)/i.test(ip)) return null;
    if (cache.has(ip)) return cache.get(ip);
    const value = family === 4 ? ipv4(ip) : ipv6(ip), rows = tables[family];
    let lo = 0, hi = rows.length - 1, result = null;
    while (lo <= hi) { const mid = (lo + hi) >>> 1, row = rows[mid]; if (value < row[0]) hi = mid - 1; else if (value > row[1]) lo = mid + 1; else { result = /^[A-Z]{2}$/.test(row[2]) ? row[2] : null; break; } }
    if (cache.size > 10000) cache.clear(); cache.set(ip, result); return result;
  };
}
