# Security and private reports

Do not publish RCON passwords, tokens, `conf/`, `logs/`, player IP addresses, private chat or unredacted screenshots in an issue. Use fictional sample data when reporting a bug.

For a vulnerability that could expose credentials or allow unauthorized commands, use GitHub's **Report a vulnerability** / private security reporting feature on this repository, if available. Do not post exploitation details publicly before the maintainer has had a chance to review them.

Keep WebRCON access restricted to the intended administrators. Plain WebSocket (`ws://`) is not encrypted; use a trusted network or a properly configured secure connection. The local dashboard binds to loopback, and is not intended to be exposed as a public web service.

This project currently has no guaranteed response time or supported-version service agreement. Updates are published in GitHub Releases; keep your own backups before changing a live server.
