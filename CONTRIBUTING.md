# Bugs, suggestions and contributions

Anyone may download RustJan and open an issue. Use the bug/feature templates and include the app version, Windows version, server/Oxide/bridge versions if relevant, expected behaviour and reproducible steps.

Remove all secrets and player-identifying information from logs and screenshots. Prefer the built-in demo or an isolated test server. Do not attach your `conf` or `logs` folders.

Only the repository owner and explicitly authorized writers can push changes here. Public access does not grant write access. MIT-licensed source may be forked and modified in a separate repository. Pull requests are proposals: Jannu decides which changes to accept.

Run `node --test tests/*.test.mjs` using Node.js 24 before proposing a code change. Do not add telemetry, hosted credential storage or runtime icon downloads without discussing the change. Keep English/Estonian UI behaviour and data isolation between server slots intact.
