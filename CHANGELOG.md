# Changelog

## 1.5.5

- Country Guard 1.1.0 saves rejected IP addresses permanently on each server and lists them separately from Steam account bans in the desktop app.
- Optional Linux nftables sync preserves and applies these IP blocks even when Country Guard or Oxide is down.

## 1.5.4

- Added a read-only Rust server update check to Overview, with a manual check button and a Windows notification when a newer Steam build is available.
- Update RustJanBridge to 1.5.0 on the server to report the installed Steam Build ID. The check runs on connection and every 15 minutes, including while in the tray.

## 1.5.3 — 2026-11-02

First public portable Windows ZIP release.

- Three-server WebRCON monitoring, tray operation and optional encrypted password storage.
- Persistent chat/console logs, player visits/name history, maps and visitor statistics.
- Local item catalogue/icons, explicit item delivery and Oxide/uMod plugin controls.
- Server-specific plugin homepage bookmarks.
- LiveMap player focus, optional sleepers/TCs and bridge flight/loot events.
- Multiple server-specific hide/highlight rules, colour selection and one-shot local audio notifications.
- Three generated built-in tones and optional user audio import; no personal imported sounds distributed.
- English/Estonian interface and an isolated 10-player demo for screenshots.
- Documentation, privacy exclusions, checksums, ZIP download statistics and CI.

Optional server plugins: RustJanBridge 1.4.0 and RustJanCountryGuard 1.0.2. The desktop app does not install plugins on a server automatically.
