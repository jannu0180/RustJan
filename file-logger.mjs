import { EventEmitter } from 'node:events';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
const date = value => { const p = parts(value); return `${p.year}-${p.month}-${p.day}`; };
const timestamp = value => { const p = parts(value); return `[${p.month}.${p.day}-${p.hour}.${p.minute}]`; };
export const serverFolder = value => { const name = String(value || 'Server').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || 'Server'; return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name; };
const oneLine = value => String(value ?? '').replace(/[\r\n]/g, ' ');
export function formatLogEntry(kind, entry, { demo = false } = {}) {
  const prefix = `${timestamp(entry.time)} - ${demo ? '[DEMO] ' : ''}${kind === 'chat' ? `${oneLine(entry.name)}: ` : `[${oneLine(entry.type).toUpperCase()}] `}`;
  const lines = String(entry.message ?? '').replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines.map(line => `${prefix}${line}\r\n`).join('');
}
export class SessionLogger extends EventEmitter {
  constructor(directory, { clock = () => Date.now(), redact = value => String(value) } = {}) {
    super(); this.directory = directory; this.clock = clock; this.redact = redact;
    const p = parts(clock()); this.session = `${p.hour}${p.minute}${p.second}.${String(clock() % 1000).padStart(3, '0')}.${process.pid}.${randomBytes(3).toString('hex')}`;
    this.enabled = { chat: false, console: false }; this.files = new Map(); this.handles = new Map(); this.queue = Promise.resolve(); this.error = null; this.closed = false;
  }
  configure(value) { this.enabled = { chat: value.chat === true, console: value.console === true }; this.emit('status'); }
  status() { return { ...this.enabled, directory: this.directory, session: this.session, files: Object.fromEntries(this.files), error: this.error }; }
  record(kind, entry, { server = '', demo = false } = {}) {
    if (!this.enabled[kind] || this.closed) return;
    const received = this.clock(), day = date(received), folder = server ? serverFolder(server) : '', key = `${folder ? folder + ':' : ''}${kind}:${day}`;
    const directory = path.join(this.directory, folder);
    const line = this.redact(formatLogEntry(kind, { ...entry, time: entry.time || received }, { demo }));
    this.queue = this.queue.then(async () => {
      await mkdir(directory, { recursive: true });
      let handle = this.handles.get(key);
      if (!handle) {
        const prefix = kind === 'chat' ? 'chat' : 'konsool';
        let file;
        for (let attempt = 0; attempt < 100; attempt++) {
          file = path.join(directory, `${prefix}.${day}.${this.session}${attempt ? `_${attempt}` : ''}.txt`);
          try { handle = await open(file, 'ax', 0o600); break; } catch(e) { if (e.code !== 'EEXIST') throw e; }
        }
        if (!handle) throw new Error('Logifailile ei leitud vaba nime.');
        this.handles.set(key, handle); this.files.set(key, file); this.emit('status');
        for (const [oldKey, oldHandle] of this.handles) { if (!oldKey.endsWith(day)) { await oldHandle.close(); this.handles.delete(oldKey); } }
      }
      await handle.appendFile(line, 'utf8');
      if (this.error) { this.error = null; this.emit('status'); }
    }).catch(error => { this.error = `Logi kirjutamine ebaõnnestus (${error.code || error.message}).`; this.emit('status'); });
  }
  async flush() { await this.queue; }
  close() { if (this.closePromise) return this.closePromise; this.closed = true; this.closePromise = (async () => { await this.queue; for (const h of this.handles.values()) await h.close(); this.handles.clear(); })(); return this.closePromise; }
}
