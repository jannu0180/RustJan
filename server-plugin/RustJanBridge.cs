using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Oxide.Core;
using UnityEngine;
using Network;

namespace Oxide.Plugins
{
    [Info("RustJan Bridge", "RustJan", "1.4.0")]
    [Description("Read-only RCON data for the local RustJan dashboard. No web services or credentials.")]
    public class RustJanBridge : RustPlugin
    {
        private byte[] cachedImage;
        private readonly HashSet<BuildingPrivlidge> cupboards = new HashSet<BuildingPrivlidge>();
        private float cachedScale;
        private int imageWidth;
        private int imageHeight;

        private bool ServerOnly(ConsoleSystem.Arg arg)
        {
            if (arg.Connection == null) return true;
            arg.ReplyWith("RustJan commands are only available from the server console/RCON.");
            return false;
        }

        private class Tracked { public BaseEntity Entity; public string Kind; public double CreatedAt; }
        private class Point { public float x; public float y; public float z; public Point(Vector3 p) { x=p.x; y=p.y; z=p.z; } }
        private class MapEvent { public string Id; public string Kind; public Point Position; public Point Direction; public double CreatedAt; public double ExpiresAt; }
        private readonly Dictionary<string, Tracked> tracked = new Dictionary<string, Tracked>();
        private readonly List<MapEvent> crashes = new List<MapEvent>();
        private static double UtcMs() { return (DateTime.UtcNow - new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds; }
        private string EventKind(BaseEntity entity)
        {
            if(entity == null) return null;
            string prefab = (entity.ShortPrefabName ?? "").ToLowerInvariant();
            string type = entity.GetType().Name;
            if(type == "CargoPlane" || prefab.Contains("cargoplane")) return "plane";
            if(type == "PatrolHelicopter" || prefab.Contains("patrolhelicopter")) return "helicopter";
            if(type == "SupplyDrop" || prefab.Contains("supply_drop")) return "airdrop";
            if(prefab.Contains("heli_crate") || prefab.Contains("helicopter_crate")) return "helicrate";
            return null;
        }
        private void Track(BaseEntity entity)
        {
            string kind = EventKind(entity);
            if(kind == null || entity.net == null || tracked.Count >= 256) return;
            string id = entity.net.ID.ToString();
            if(!tracked.ContainsKey(id)) tracked[id] = new Tracked { Entity=entity, Kind=kind, CreatedAt=UtcMs() };
        }
        private void OnServerInitialized()
        {
            foreach(var entity in BaseNetworkable.serverEntities) { Track(entity as BaseEntity); var tc=entity as BuildingPrivlidge; if(tc!=null)cupboards.Add(tc); }
        }
        private void OnEntitySpawned(BaseNetworkable entity) { Track(entity as BaseEntity); var tc=entity as BuildingPrivlidge;if(tc!=null)cupboards.Add(tc); }
        private void OnEntityKill(BaseNetworkable entity)
        {
            var tc=entity as BuildingPrivlidge;if(tc!=null)cupboards.Remove(tc);
            var value = entity as BaseEntity;
            if(value != null && value.net != null) tracked.Remove(value.net.ID.ToString());
        }
        private void OnEntityDeath(BaseCombatEntity entity, HitInfo info)
        {
            if(EventKind(entity) != "helicopter") return;
            double at = UtcMs();
            crashes.Add(new MapEvent { Id="crash-"+at.ToString("F0",CultureInfo.InvariantCulture), Kind="crash", Position=new Point(entity.transform.position), CreatedAt=at, ExpiresAt=at+600000 });
            if(crashes.Count > 64) crashes.RemoveAt(0);
        }
        [ConsoleCommand("rustjan.events")]
        private void EventSnapshot(ConsoleSystem.Arg arg)
        {
            if(!ServerOnly(arg)) return;
            double at = UtcMs();
            var rows = new List<MapEvent>();
            foreach(var pair in tracked.ToArray())
            {
                var entry=pair.Value; var entity=entry.Entity;
                if(entity == null || entity.IsDestroyed) { tracked.Remove(pair.Key); continue; }
                rows.Add(new MapEvent { Id=pair.Key, Kind=entry.Kind, Position=new Point(entity.transform.position), Direction=new Point(entity.transform.forward), CreatedAt=entry.CreatedAt, ExpiresAt=0 });
            }
            crashes.RemoveAll(entry => entry.ExpiresAt <= at);
            rows.AddRange(crashes);
            arg.ReplyWith(JsonConvert.SerializeObject(new { Schema=1, PluginVersion="1.4.0", Events=rows }));
        }

        [ConsoleCommand("rustjan.layers")]
        private void Layers(ConsoleSystem.Arg arg)
        {
            if(!ServerOnly(arg)) return;
            bool sleepers=arg.Args!=null && arg.Args.Length>0 && arg.Args[0].ToString()=="1";
            bool tcs=arg.Args!=null && arg.Args.Length>1 && arg.Args[1].ToString()=="1";
            var sleeping=(sleepers?BasePlayer.sleepingPlayerList.Where(p=>p!=null && !p.IsDestroyed):Enumerable.Empty<BasePlayer>()).Take(10000).Select(p=>new {SteamID=p.UserIDString,DisplayName=p.displayName,Position=new Point(p.transform.position)}).ToArray();
            var buildings=(tcs?cupboards.Where(p=>p!=null && !p.IsDestroyed):Enumerable.Empty<BuildingPrivlidge>()).Take(10000).Select(p=>new {Id=p.net.ID.ToString(),Owner=p.OwnerID.ToString(),Position=new Point(p.transform.position)}).ToArray();
            arg.ReplyWith(JsonConvert.SerializeObject(new {Schema=1,Sleepers=sleeping,Cupboards=buildings,Truncated=(sleepers&&BasePlayer.sleepingPlayerList.Count>10000)||(tcs&&cupboards.Count>10000)}));
        }

        [ConsoleCommand("rustjan.items")]
        private void Items(ConsoleSystem.Arg arg)
        {
            if(!ServerOnly(arg))return;
            arg.ReplyWith(JsonConvert.SerializeObject(ItemManager.itemList.Select(i=>new {shortname=i.shortname,name=i.displayName.english,category=i.category.ToString()}).ToArray()));
        }

        [ConsoleCommand("rustjan.time")]
        private void GameTime(ConsoleSystem.Arg arg)
        {
            if (!ServerOnly(arg)) return;
            var sky = TOD_Sky.Instance;
            if (sky == null) { arg.ReplyWith("Time unavailable"); return; }
            arg.ReplyWith(JsonConvert.SerializeObject(new { Hour = sky.Cycle.Hour, IsNight = sky.IsNight }));
        }

        [ConsoleCommand("rustjan.players")]
        private void PlayerList(ConsoleSystem.Arg arg)
        {
            if (!ServerOnly(arg)) return;
            var rows = BasePlayer.activePlayerList.Where(p => p != null && p.net != null && p.net.connection != null).Select(p => new
            {
                SteamID = p.UserIDString,
                DisplayName = p.displayName,
                Ping = Net.sv.GetAveragePing(p.net.connection),
                Address = p.net.connection.ipaddress,
                ConnectedSeconds = p.net.connection.GetSecondsConnected(),
                Health = p.Health(),
                Position = new { x = p.transform.position.x, y = p.transform.position.y, z = p.transform.position.z },
                TeamId = p.currentTeam.ToString()
            }).ToArray();
            arg.ReplyWith(JsonConvert.SerializeObject(rows));
        }

        [ConsoleCommand("rustjan.rendermap")]
        private void RenderMap(ConsoleSystem.Arg arg)
        {
            if (!ServerOnly(arg)) return;
            float scale = 0.3f;
            if (arg.Args != null && arg.Args.Length > 0)
                float.TryParse(arg.Args[0].ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out scale);
            scale = Mathf.Clamp(scale, 0.1f, 0.5f);
            if (cachedImage == null || Math.Abs(cachedScale - scale) > 0.001f)
            {
                Color background;
                cachedImage = MapImageRenderer.Render(out imageWidth, out imageHeight, out background, scale, false);
                cachedScale = scale;
            }
            arg.ReplyWith(JsonConvert.SerializeObject(new
            {
                Width = imageWidth,
                Height = imageHeight,
                WorldSize = World.Size,
                Scale = cachedScale,
                Base64 = Convert.ToBase64String(cachedImage)
            }));
        }

        [ConsoleCommand("rustjan.plugins")]
        private void PluginList(ConsoleSystem.Arg arg)
        {
            if (!ServerOnly(arg)) return;
            var loaded = plugins.GetAll().Where(p => !p.IsCorePlugin).ToDictionary(p => p.Name, p => p, StringComparer.OrdinalIgnoreCase);
            var rows = Directory.GetFiles(Interface.Oxide.PluginDirectory, "*.cs").Select(file =>
            {
                string fileName = Path.GetFileNameWithoutExtension(file);
                Oxide.Core.Plugins.Plugin plugin;
                loaded.TryGetValue(fileName, out plugin);
                string title = plugin != null ? plugin.Title : fileName;
                string version = plugin != null ? plugin.Version.ToString() : null;
                string author = plugin != null ? plugin.Author : "";
                if (plugin == null && new FileInfo(file).Length < 1024 * 1024)
                {
                    try
                    {
                        var match = Regex.Match(File.ReadAllText(file), @"\[Info\(\s*""([^""]+)""\s*,\s*""([^""]+)""\s*,\s*""([^""]+)""");
                        if (match.Success) { title = match.Groups[1].Value; author = match.Groups[2].Value; version = match.Groups[3].Value; }
                    }
                    catch { }
                }
                return new { name = title, file = fileName, version = version, author = author, status = plugin == null ? "disabled" : "enabled", error = "" };
            }).ToArray();
            arg.ReplyWith(JsonConvert.SerializeObject(rows));
        }
    }
}
