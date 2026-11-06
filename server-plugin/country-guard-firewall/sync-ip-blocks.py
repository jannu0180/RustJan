#!/usr/bin/env python3
"""Apply Country Guard's exact-address game-port blocks with nftables."""

import argparse
import ipaddress
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile


def read_ips(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return set()
    with os.fdopen(fd, "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError("IP journal must be a regular file")
        ips = set()
        for line in iter(lambda: stream.readline(65537), b""):
            if len(line) > 65536:
                raise ValueError("IP journal contains an oversized record")
            if not line.endswith(b"\n"):
                break
            try:
                value = json.loads(line)["IP"]
                if not isinstance(value, str) or "%" in value:
                    raise ValueError()
                ips.add(ipaddress.ip_address(value))
            except (ValueError, TypeError, KeyError):
                print("Skipped an invalid record in the IP journal.", flush=True)
        return ips


def nft_rules(ips, port):
    table = "inet rustjan_countryguard"
    lines = [
        f"add table {table}",
        f"delete table {table}",
        f"add table {table}",
        f"add chain {table} game_input {{ type filter hook input priority -5; policy accept; }}",
    ]
    for version, address_type, family in [(4, "ipv4_addr", "ip"), (6, "ipv6_addr", "ip6")]:
        addresses = sorted((ip for ip in ips if ip.version == version), key=int)
        if not addresses:
            continue
        name = f"blocked_v{version}"
        lines.append(f"add set {table} {name} {{ type {address_type}; }}")
        for start in range(0, len(addresses), 1000):
            batch = ", ".join(map(str, addresses[start:start + 1000]))
            lines.append(f"add element {table} {name} {{ {batch} }}")
        lines.append(f"add rule {table} game_input udp dport {port} {family} saddr @{name} drop")
    return "\n".join(lines) + "\n"


def save_snapshot(path, ips):
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            for address in sorted(ips, key=lambda ip: (ip.version, int(ip))):
                stream.write(json.dumps({"IP": str(address)}) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--journal", type=Path, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be a UDP port from 1 to 65535")
    if args.dry_run:
        print(nft_rules(read_ips(args.journal), args.port), end="")
        return
    snapshot = Path("/var/lib/rustjan-countryguard/blocked.jsonl")
    previous = read_ips(snapshot)
    ips = previous | read_ips(args.journal)
    if ips != previous:
        save_snapshot(snapshot, ips)
    subprocess.run(["/usr/sbin/nft", "-f", "-"], input=nft_rules(ips, args.port), text=True, check=True, timeout=20)


if __name__ == "__main__":
    main()
