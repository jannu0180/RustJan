# RustJan maintenance and publishing

- The authorized upstream is **https://github.com/jannu0180/RustJan**. Do not use another connected GitHub account for this project. Verify the authenticated login before mutations.
- The owner requested that future authorized application updates also update GitHub source and publish a versioned **portable Windows ZIP**, with release notes and SHA-256 checksum. Complete appropriate checks first. Do not publish for discussion-only requests or while the user has paused the task.
- Keep personal installations/data separate from source and release staging. Never commit/package `conf`, `logs`, credentials, real server settings, player history, map caches, imported personal sounds, research/decompilation material or machine-specific paths.
- Do not delete a user's active configuration/logs to prepare a release. Build from clean allowlisted source, inspect bundle/ASAR/archive contents, and check for private connection data before publishing.
- Source is public; releases contain RustJan.exe **inside the ZIP**. No installer or standalone setup EXE is requested. Preserve third-party notices.
- No outside collaborators are authorized by default. Issues and pull requests are welcome; publishing does not authorize granting others write/admin access.
- Use the synthetic 10-player demo for public screenshots, never a real server session.
- Keep desktop runtime/bundled assets separate from Git history. `scripts/fetch-icons.mjs` reconstructs the local icon cache from the hash manifest.
- An app update is not permission to execute destructive commands on a live Rust server. Test using isolated data/mocks. Tell the owner when a server-plugin update is required; the owner installs it on the Linux server.
