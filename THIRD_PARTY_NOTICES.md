# Third-party notices

The MIT license in this repository applies to RustJan's original code. It does not replace any third-party license, grant rights to Facepunch's game artwork, or imply endorsement.

| Component | Source and rights |
| --- | --- |
| Electron 45.2.1 / Chromium / Node.js runtime | Electron's license is shipped as `LICENSE` in the Windows bundle; Chromium/dependency notices are in `LICENSES.chromium.html`. RustJan's own license is `LICENSE-RustJan.txt` in that bundle. |
| Country flags | [lipis/flag-icons](https://github.com/lipis/flag-icons), MIT. Original notice retained in `public/flags/LICENSE`. |
| Offline IP-country ranges | [sapics/ip-location-db user-country](https://github.com/sapics/ip-location-db), Public Domain Dedication and License 1.0 (PDDL). See `data/SOURCES.txt`. Public geographical data, not observations of RustJan users or any private server. |
| Rust item artwork | [Facepunch's public asset host](https://files.facepunch.com/), copyright Facepunch Studios and/or relevant rights holders. Used for identifying items in this unofficial Rust administration tool. Not included under MIT; no separate claim of ownership or unrestricted reuse. The source repository contains a download/hash manifest; the portable bundle includes local copies. |
| Item names / shortnames | Bundled catalogue from the [official Rust Wiki](https://wiki.facepunch.com/rust/) and public item definitions supplied by the running Rust server. Not player/server observations. |
| Build tools | `@electron/packager`, `@resvg/resvg-js`, Electron and their dependencies: see `desktop/package-lock.json` and the respective projects' licenses. They are development dependencies, not an additional Node.js installation required by release users. |
| Author portrait | Supplied by Jannu for RustJan's About view. Not a general-purpose stock image or part of the MIT code license. |

The three built-in notification tones are generated for RustJan. Users may import their own audio. No sounds copied from another administration program are included in the public source or release.

RustJan is not affiliated with or endorsed by Facepunch Studios. Third-party terms remain applicable, including Facepunch's [legal documents](https://facepunch.com/legal).
