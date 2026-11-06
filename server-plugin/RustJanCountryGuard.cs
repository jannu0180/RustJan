using System;
using System.IO;
using System.Net;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Oxide.Core;

namespace Oxide.Plugins
{
    [Info("RustJan Country Guard", "Jannu / RustJan", "1.1.0")]
    [Description("Offline country rules with permanent, server-local IP blocks.")]
    public class RustJanCountryGuard : RustPlugin
    {
        private Settings settings;
        private Range[] ipv4 = new Range[0], ipv6 = new Range[0];
        private bool ready;
        private readonly Dictionary<string, IpBlock> blocks = new Dictionary<string, IpBlock>();
        private bool canWriteBlocks;
        private class IpBlock { public string IP, Country, Reason, CreatedAt; }
        private string BlockFile { get { return Path.Combine(Interface.Oxide.DataDirectory, "RustJanCountryGuard", "ip-blocks.jsonl"); } }
        private class Settings
        {
            public bool Enabled = true;
            public List<string> BlockedCountries = new List<string> { "RU", "BY" };
            public List<string> AllowedSteamIds = new List<string>();
            public string RejectionReason = "Aggression against other countries.";
            public bool LogRejections = true;
        }
        private class Range { public byte[] Start, End; public string Country; }
        protected override void LoadDefaultConfig() { settings = new Settings(); SaveConfig(); }
        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                settings = Config.ReadObject<Settings>();
                if (settings == null || settings.BlockedCountries == null || settings.AllowedSteamIds == null || string.IsNullOrWhiteSpace(settings.RejectionReason)) throw new Exception("Missing configuration fields");
                settings.BlockedCountries = settings.BlockedCountries.ConvertAll(NormalizeCountry);
                SaveConfig(); // Removes obsolete unknown-country rejection settings from older versions.
            }
            catch (Exception error)
            {
                PrintError("Invalid config; plugin cannot enforce rules: " + error.Message);
                throw;
            }
        }
        protected override void SaveConfig() { Config.WriteObject(settings, true); }
        private static string NormalizeCountry(string value)
        {
            string code = (value ?? "").Trim().ToUpperInvariant();
            if (code.Length != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z') throw new Exception("Use a two-letter country code, e.g. RU, BY, EE");
            return code;
        }
        // Fixed-width unsigned arithmetic avoids a dependency on System.Numerics.
        private static byte[] DecimalAddress(string text, int width)
        {
            byte[] result = new byte[width];
            if (text.Length == 0) throw new Exception("Empty range endpoint");
            foreach (char digit in text)
            {
                if (digit < '0' || digit > '9') throw new Exception("Invalid numeric range endpoint");
                int carry = digit - '0';
                for (int i = width - 1; i >= 0; i--) { int n = result[i] * 10 + carry; result[i] = (byte)(n & 255); carry = n >> 8; }
                if (carry != 0) throw new Exception("Range endpoint overflow");
            }
            return result;
        }
        private static int Compare(byte[] a, byte[] b)
        {
            for (int i = 0; i < a.Length; i++) { int c = a[i].CompareTo(b[i]); if (c != 0) return c; }
            return 0;
        }
        private static Range[] ReadRanges(string file, int width)
        {
            var rows = new List<Range>();
            foreach (string line in File.ReadLines(file))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                string[] fields = line.Split(',');
                if (fields.Length != 3) throw new Exception("Invalid CSV row");
                var row = new Range { Start = DecimalAddress(fields[0], width), End = DecimalAddress(fields[1], width), Country = NormalizeCountry(fields[2]) };
                if (Compare(row.Start, row.End) > 0 || (rows.Count > 0 && Compare(rows[rows.Count - 1].End, row.Start) >= 0)) throw new Exception("Unsorted or overlapping ranges");
                rows.Add(row);
            }
            if (rows.Count == 0) throw new Exception("Empty country database");
            return rows.ToArray();
        }
        private void Init()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(BlockFile));
                if (File.Exists(BlockFile))
                    foreach (string line in File.ReadLines(BlockFile))
                    {
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        var block = JsonConvert.DeserializeObject<IpBlock>(line);
                        if (block == null || CanonicalIp(block.IP) != block.IP || string.IsNullOrEmpty(block.IP) ||
                            string.IsNullOrEmpty(block.Reason) || string.IsNullOrEmpty(block.CreatedAt))
                            throw new IOException("Invalid permanent IP block record.");
                        blocks[block.IP] = block;
                    }
                canWriteBlocks = true;
            }
            catch (Exception error) { PrintError("Permanent IP list could not be fully loaded: " + error.Message); }
            LoadDatabase();
        }

        private static string CanonicalIp(string text)
        {
            IPAddress address;
            if (!IPAddress.TryParse(text, out address)) return null;
            if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
            return new IPAddress(address.GetAddressBytes()).ToString();
        }
        private void LoadDatabase()
        {
            try
            {
                string folder = Path.Combine(Interface.Oxide.DataDirectory, "RustJanCountryGuard");
                var a = ReadRanges(Path.Combine(folder, "country-ipv4.csv"), 4);
                var b = ReadRanges(Path.Combine(folder, "country-ipv6.csv"), 16);
                ipv4 = a; ipv6 = b; ready = true;
                Puts("Offline database loaded: " + a.Length + " IPv4 and " + b.Length + " IPv6 ranges. Blocked: " + string.Join(", ", settings.BlockedCountries.ToArray()));
            }
            catch (Exception error) { PrintError("Country database unavailable: " + error.Message + ". Unidentified IPs are allowed. Install both CSV files and use rustjan.country reload."); }
        }
        private string Country(string text)
        {
            if (!ready) return null;
            IPAddress address;
            if (!IPAddress.TryParse(text, out address)) return null;
            if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
            byte[] bytes = address.GetAddressBytes();
            Range[] rows = bytes.Length == 4 ? ipv4 : ipv6;
            int low = 0, high = rows.Length - 1;
            while (low <= high)
            {
                int mid = low + (high - low) / 2; Range row = rows[mid];
                if (Compare(bytes, row.Start) < 0) high = mid - 1;
                else if (Compare(bytes, row.End) > 0) low = mid + 1;
                else return row.Country == "ZZ" ? null : row.Country;
            }
            return null;
        }
        private object CanUserLogin(string name, string id, string ipAddress)
        {
            string ip = CanonicalIp(ipAddress);
            IpBlock existing;
            if (ip != null && blocks.TryGetValue(ip, out existing)) return existing.Reason;
            if (!settings.Enabled || settings.AllowedSteamIds.Contains(id)) return null;
            string country = Country(ip);
            string reason = country != null && settings.BlockedCountries.Contains(country) ? settings.RejectionReason.Replace("{country}", country) : null;
            if (reason == null) return null;
            if (canWriteBlocks && ip != null)
            {
                var block = new IpBlock { IP = ip, Country = country, Reason = reason, CreatedAt = DateTime.UtcNow.ToString("o") };
                try
                {
                    byte[] row = System.Text.Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(block, Formatting.None) + "\n");
                    using (var stream = new FileStream(BlockFile, FileMode.Append, FileAccess.Write, FileShare.Read))
                    {
                        stream.Write(row, 0, row.Length);
                        stream.Flush(true);
                    }
                    blocks[ip] = block;
                }
                catch (Exception error)
                {
                    canWriteBlocks = false;
                    PrintError("Could not save permanent IP block: " + error.Message);
                }
            }
            if (settings.LogRejections) LogToFile("rejections", DateTime.UtcNow.ToString("o") + " SteamID=" + id + " IP=" + ipAddress + " Country=" + (country ?? "unknown") + " Reason=" + reason.Replace("\r", " ").Replace("\n", " "), this);
            return reason;
        }

        [ConsoleCommand("rustjan.countrybans")]
        private void CountryBans(ConsoleSystem.Arg arg)
        {
            if (arg.Connection != null) return;
            arg.ReplyWith(JsonConvert.SerializeObject(new { Schema = 1, Total = blocks.Count,
                StorageReady = canWriteBlocks,
                Blocks = blocks.Values.OrderByDescending(b => b.CreatedAt, StringComparer.Ordinal).Take(250).ToArray() }));
        }
        [ConsoleCommand("rustjan.country")]
        private void CountryCommand(ConsoleSystem.Arg arg)
        {
            if (arg.Connection != null) { arg.ReplyWith("Server console / RCON only."); return; }
            string[] args = new string[arg.Args == null ? 0 : arg.Args.Length];
            for (int i = 0; i < args.Length; i++) args[i] = arg.Args[i].ToString();
            try
            {
                if (args.Length == 0 || args[0] == "status") { arg.ReplyWith("Enabled=" + settings.Enabled + " Database=" + ready + " Unknown=Allowed Blocked=" + string.Join(",", settings.BlockedCountries.ToArray())); return; }
                if (args[0] == "reload") { LoadDatabase(); arg.ReplyWith("Database ready=" + ready); return; }
                if (args.Length >= 2 && (args[0] == "add" || args[0] == "remove"))
                {
                    string country = NormalizeCountry(args[1]);
                    if (args[0] == "remove") settings.BlockedCountries.RemoveAll(c => c == country);
                    else if (!settings.BlockedCountries.Contains(country)) settings.BlockedCountries.Add(country);
                }
                else if (args.Length >= 2 && args[0] == "reason") settings.RejectionReason = string.Join(" ", args, 1, args.Length - 1);
                else { arg.ReplyWith("rustjan.country status | add RU | remove RU | reason \"Message {country}\" | reload"); return; }
                SaveConfig(); arg.ReplyWith("Country rules saved.");
            }
            catch (Exception error) { arg.ReplyWith(error.Message); }
        }
    }
}
