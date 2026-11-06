export const updateInterval = 15 * 60_000;
const endpoint = 'https://api.steamcmd.net/v1/info/258550';
export const buildId = value => /^[1-9]\d{0,14}$/.test(String(value)) ? String(value) : null;
export const steamBranch = value => /^[a-zA-Z0-9_.-]{1,64}$/.test(String(value)) ? String(value).toLowerCase() : null;

export function compareBuilds(installed, latest) {
  if (!buildId(installed) || !buildId(latest)) return 'unavailable';
  if (installed === latest) return 'current';
  return Number(installed) < Number(latest) ? 'needed' : 'different';
}

export function createSteamBuildLookup({fetcher = globalThis.fetch, clock = Date.now} = {}) {
  let pending, branches, checkedAt = null, attemptedAt = null, failed = false;
  return async (branch, force = false) => {
    if (!pending && (attemptedAt === null || clock() - attemptedAt >= (force ? 10_000 : updateInterval))) {
      attemptedAt = clock();
      pending = (async () => {
        try {
          const response = await fetcher(endpoint, {signal: AbortSignal.timeout(8000), redirect: 'error'});
          if (!response.ok) throw Error('Steam lookup failed');
          const metadata = (await response.json()).data?.['258550']?.depots?.branches;
          if (!buildId(metadata?.public?.buildid)) throw Error('Missing public build');
          branches = metadata;
          checkedAt = clock();
          failed = false;
        } catch { failed = true; }
      })().finally(() => { pending = null; });
    }
    await pending;
    const latest = Object.hasOwn(branches ?? {}, branch) ? buildId(branches[branch]?.buildid) : null;
    return { latest, checkedAt, status: failed ? 'steam-error' : latest ? 'ok' : 'branch-unavailable' };
  };
}
