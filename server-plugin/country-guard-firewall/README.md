# Country Guard permanent IP blocks on Linux

Country Guard 1.1.0 saves newly rejected addresses and reasons in
\`oxide/data/RustJanCountryGuard/ip-blocks.jsonl\`. Existing blocks take
precedence over the country database and its allowlist. Old rejection
logs are historical records and are not imported automatically.

To keep blocks enforced even if Oxide or Country Guard stops, install the
optional firewall sync as a Linux administrator. It blocks exact IPv4
and IPv6 addresses on the Rust **game UDP port**. RCON, SSH and other
ports are outside its rules. This setup is for Rust running on the host;
containers with forwarded traffic need rules on their forwarding path.

Install Python 3.8+, nftables and systemd. Copy the three supplied files
as follows:

    sudo install -d /usr/local/libexec
    sudo install -m 0755 sync-ip-blocks.py /usr/local/libexec/rustjan-countryguard-sync.py
    sudo install -m 0644 rustjan-countryguard.service rustjan-countryguard.timer /etc/systemd/system/

Create \`/etc/rustjan-countryguard.conf\` as root with the correct path and
game port for your server. For example:

    JOURNAL=/srv/rust/oxide/data/RustJanCountryGuard/ip-blocks.jsonl
    GAME_PORT=28015

Then enable the sync and check its first run:

    sudo systemctl daemon-reload
    sudo systemctl enable --now rustjan-countryguard.timer
    sudo systemctl start rustjan-countryguard.service
    sudo systemctl status rustjan-countryguard.service
    sudo nft list table inet rustjan_countryguard

Rules are applied at boot and every 30 seconds. The plugin rejects a
newly identified address immediately; the firewall enforces it after
the next sync. The service keeps a root-owned copy in
\`/var/lib/rustjan-countryguard/blocked.jsonl\`, so removing the plugin or
its journal does not remove firewall blocks. Keep backups of both files.
RustJan's IP list shows the plugin's journal when the plugin responds.

On shared or dynamic IPs, a permanent address block can affect a future
user of the same address. This is independent of any Steam account.
