import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
export const credentialKey = p => `${p.secure ? 'wss' : 'ws'}://${String(p.host).toLowerCase()}:${Number(p.port)}`;
export async function protectSecret(value, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('Parooli turvaline salvestamine vajab Windowsi.');
  const script = `$ErrorActionPreference='Stop'; [Console]::InputEncoding=[Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd() | ConvertFrom-Json; ${decrypt ? "$b=[Convert]::FromBase64String($v); $p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($p))" : "$b=[Text.Encoding]::UTF8.GetBytes($v); $p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($p))"}`;
  return new Promise((resolve, reject) => {
    const child = execFile(`${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`, ['-NoLogo','-NoProfile','-NonInteractive','-Command',script], { windowsHide: true, timeout: 15000, maxBuffer: 32768, encoding: 'utf8' }, (error, stdout, stderr) => error ? reject(new Error('Windows ei saanud salvestatud parooli krüpteerida või avada.', { cause: { code: error.code, detail: stderr } })) : resolve(stdout));
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(value));
  });
}
export class CredentialVault {
  constructor(directory, legacyDirectory = null) { this.directory = directory; this.file = path.join(directory, 'credentials.json'); this.legacyDirectory = legacyDirectory; this.queue = Promise.resolve(); }
  async migrate() {
    if (!this.legacyDirectory) return false;
    try { await readFile(this.file); return false; } catch(e) { if (e.code !== 'ENOENT') throw e; }
    let entries;
    try { entries = JSON.parse(await readFile(path.join(this.legacyDirectory, 'credentials.json'), 'utf8')); } catch(e) { if (e.code === 'ENOENT') return false; throw new Error('Vana paroolifaili ülekandmine ebaõnnestus.'); }
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Vana paroolifaili vorming on vigane.');
    await this.write(entries); return true;
  }
  async entries() { try { const parsed = JSON.parse(await readFile(this.file, 'utf8')); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch (e) { if (e.code === 'ENOENT') return {}; throw new Error('Salvestatud paroolide fail on vigane. Taasta varukoopia või unusta salvestatud paroolid.'); } }
  async metadata() { const entries = await this.entries(); return { supported: process.platform === 'win32', profiles: Object.values(entries).map(e => e.profile) }; }
  async read(profile) { const entry = (await this.entries())[credentialKey(profile)]; if (!entry) throw new Error('Selle serveri parooli pole salvestatud.'); return protectSecret(entry.cipher, true); }
  async save(profile, password) {
    const cipher = await protectSecret(password);
    const work = this.queue.then(async () => { const entries = await this.entries(); entries[credentialKey(profile)] = { profile, cipher }; await this.write(entries); });
    this.queue = work.catch(() => {}); return work;
  }
  async write(entries) { await mkdir(this.directory, { recursive: true }); const temp = `${this.file}.tmp`; await writeFile(temp, JSON.stringify(entries), { mode: 0o600 }); await rename(temp, this.file); }
  async forget() { const work = this.queue.then(() => this.write({})); this.queue = work.catch(() => {}); return work; }
}
