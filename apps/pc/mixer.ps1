param([int]$OwnerPid = 0)
$ErrorActionPreference = 'Stop'
# Windows Core Audio: default output endpoint and its per-application sessions.
# Reads one JSON command per line on stdin, writes one JSON reply per line.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
namespace WinMoreAudio {
 [StructLayout(LayoutKind.Sequential)] struct PropertyKey { public Guid fmtid; public int pid; }
 [StructLayout(LayoutKind.Sequential)] struct PropVariant { public ushort vt; public ushort r1, r2, r3; public IntPtr value; public IntPtr extra; }
 [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom {}
 [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int flow, int mask, out IntPtr devices);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
 }
 [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object result);
  [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore store);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
 }
 [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IPropertyStore {
  [PreserveSig] int GetCount(out int count);
  [PreserveSig] int GetAt(int index, out PropertyKey key);
  [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
 }
 [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IAudioEndpointVolume {
  [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
  [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
  [PreserveSig] int GetChannelCount(out uint count);
  [PreserveSig] int SetMasterVolumeLevel(float level, ref Guid context);
  [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
  [PreserveSig] int GetMasterVolumeLevel(out float level);
  [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
  [PreserveSig] int SetChannelVolumeLevel(uint channel, float level, ref Guid context);
  [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid context);
  [PreserveSig] int GetChannelVolumeLevel(uint channel, out float level);
  [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool muted, ref Guid context);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
 }
 [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IAudioSessionManager2 {
  [PreserveSig] int GetAudioSessionControl(IntPtr session, int flags, out IntPtr control);
  [PreserveSig] int GetSimpleAudioVolume(IntPtr session, int flags, out IntPtr volume);
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
 }
 [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int count);
  [PreserveSig] int GetSession(int index, out IntPtr session);
 }
 [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IAudioSessionControl2 {
  [PreserveSig] int GetState(out int state);
  [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
  [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
  [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
  [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
  [PreserveSig] int GetGroupingParam(out Guid grouping);
  [PreserveSig] int SetGroupingParam(ref Guid grouping, ref Guid context);
  [PreserveSig] int RegisterAudioSessionNotification(IntPtr notify);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr notify);
  [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
  [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
  [PreserveSig] int GetProcessId(out uint pid);
  [PreserveSig] int IsSystemSoundsSession();
 }
 [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface ISimpleAudioVolume {
  [PreserveSig] int SetMasterVolume(float level, ref Guid context);
  [PreserveSig] int GetMasterVolume(out float level);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool muted, ref Guid context);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
 }
 public class AudioApp {
  public string id { get; set; } public string name { get; set; } public string path { get; set; }
  public int volume { get; set; } public bool muted { get; set; } public bool active { get; set; } public bool system { get; set; }
  public int[] pids { get; set; }
 }
 public class AudioMixer {
  public string device { get; set; } public int volume { get; set; } public bool muted { get; set; }
  public List<AudioApp> apps { get; set; }
 }
 class Session { public string key; public uint pid; public ISimpleAudioVolume volume; public IAudioSessionControl2 control; }
 public static class Mixer {
  const int Render = 0, Multimedia = 1, ClsctxAll = 23;
  static Guid Context = Guid.Empty;
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(int access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref int size);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant value);
  static void Check(int hr) { if (hr < 0) Marshal.ThrowExceptionForHR(hr); }
  static IMMDevice Device() {
   var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
   IMMDevice device; Check(enumerator.GetDefaultAudioEndpoint(Render, Multimedia, out device)); return device;
  }
  static T Activate<T>(IMMDevice device) {
   var iid = typeof(T).GUID; object result; Check(device.Activate(ref iid, ClsctxAll, IntPtr.Zero, out result)); return (T)result;
  }
  static string FriendlyName(IMMDevice device) {
   try {
    IPropertyStore store; Check(device.OpenPropertyStore(0, out store));
    var key = new PropertyKey { fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid = 14 };
    PropVariant value; Check(store.GetValue(ref key, out value));
    string name = value.vt == 31 ? Marshal.PtrToStringUni(value.value) : null;
    PropVariantClear(ref value); return name ?? "Speakers";
   } catch { return "Speakers"; }
  }
  static string ImagePath(uint pid) {
   IntPtr handle = OpenProcess(0x1000, false, pid);
   if (handle == IntPtr.Zero) return null;
   try { var name = new StringBuilder(1024); int size = name.Capacity; return QueryFullProcessImageName(handle, 0, name, ref size) ? name.ToString() : null; }
   finally { CloseHandle(handle); }
  }
  static string AppName(string path, uint pid, string display) {
   if (!String.IsNullOrEmpty(display) && !display.StartsWith("@")) return display;
   if (path != null) {
    try { var description = FileVersionInfo.GetVersionInfo(path).FileDescription; if (!String.IsNullOrWhiteSpace(description)) return description.Trim(); } catch {}
    return System.IO.Path.GetFileNameWithoutExtension(path);
   }
   try { return Process.GetProcessById((int)pid).ProcessName; } catch { return "Application"; }
  }
  static List<Session> Sessions(IMMDevice device, Dictionary<string, AudioApp> apps, List<string> order) {
   var result = new List<Session>();
   var manager = Activate<IAudioSessionManager2>(device);
   IAudioSessionEnumerator sessions; Check(manager.GetSessionEnumerator(out sessions));
   int count; Check(sessions.GetCount(out count));
   for (int i = 0; i < count; i++) {
    IntPtr pointer; if (sessions.GetSession(i, out pointer) < 0 || pointer == IntPtr.Zero) continue;
    object raw = Marshal.GetObjectForIUnknown(pointer); Marshal.Release(pointer);
    var control = raw as IAudioSessionControl2; var volume = raw as ISimpleAudioVolume;
    if (control == null || volume == null) continue;
    int state; control.GetState(out state); if (state == 2) continue;
    uint pid; control.GetProcessId(out pid);
    bool system = control.IsSystemSoundsSession() == 0;
    string path = system ? null : ImagePath(pid);
    string key = system ? "system" : path != null ? path.ToLowerInvariant() : "pid:" + pid;
    result.Add(new Session { key = key, pid = pid, volume = volume, control = control });
    if (apps == null) continue;
    float level; volume.GetMasterVolume(out level); bool muted; volume.GetMute(out muted);
    AudioApp app;
    if (!apps.TryGetValue(key, out app)) {
     string display; control.GetDisplayName(out display);
     app = new AudioApp { id = key, name = system ? "System sounds" : AppName(path, pid, display), path = path, volume = (int)Math.Round(level * 100), muted = muted, active = state == 1, system = system, pids = new int[0] };
     apps[key] = app; order.Add(key);
    } else if (state == 1 && !app.active) { app.active = true; app.volume = (int)Math.Round(level * 100); app.muted = muted; }
    var pids = new List<int>(app.pids); if (!pids.Contains((int)pid)) pids.Add((int)pid); app.pids = pids.ToArray();
   }
   return result;
  }
  public static AudioMixer Read() {
   var device = Device();
   var endpoint = Activate<IAudioEndpointVolume>(device);
   float level; Check(endpoint.GetMasterVolumeLevelScalar(out level)); bool muted; Check(endpoint.GetMute(out muted));
   var apps = new Dictionary<string, AudioApp>(); var order = new List<string>();
   Sessions(device, apps, order);
   var list = new List<AudioApp>(); foreach (var key in order) list.Add(apps[key]);
   return new AudioMixer { device = FriendlyName(device), volume = (int)Math.Round(level * 100), muted = muted, apps = list };
  }
  public static void Set(string id, int volume, int muted) {
   var device = Device();
   if (id == "master") {
    var endpoint = Activate<IAudioEndpointVolume>(device);
    if (volume >= 0) Check(endpoint.SetMasterVolumeLevelScalar(volume / 100f, ref Context));
    if (muted >= 0) Check(endpoint.SetMute(muted == 1, ref Context));
    return;
   }
   bool found = false;
   foreach (var session in Sessions(device, null, null)) {
    if (session.key != id) continue; found = true;
    if (volume >= 0) Check(session.volume.SetMasterVolume(volume / 100f, ref Context));
    if (muted >= 0) Check(session.volume.SetMute(muted == 1, ref Context));
   }
   if (!found) throw new InvalidOperationException("That app is no longer playing audio.");
  }
 }
}
'@
$owner = if ($OwnerPid -gt 0) { Get-Process -Id $OwnerPid -ErrorAction SilentlyContinue } else { $null }
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while ($true) {
 $line = [Console]::In.ReadLine()
 if ($null -eq $line -or ($owner -and $owner.HasExited)) { break }
 $reply = @{ seq = 0 }
 try {
  $request = $line | ConvertFrom-Json
  $reply.seq = $request.seq
  if ($request.op -eq 'read') { $reply.mixer = [WinMoreAudio.Mixer]::Read() }
  elseif ($request.op -eq 'set') {
   $volume = if ($null -ne $request.volume) { [int]$request.volume } else { -1 }
   $muted = if ($null -ne $request.muted) { [int][bool]$request.muted } else { -1 }
   [WinMoreAudio.Mixer]::Set([string]$request.id, $volume, $muted)
   $reply.ok = $true
  } else { throw 'Unknown mixer operation.' }
 } catch { $reply.error = $_.Exception.Message }
 [Console]::Out.WriteLine(($reply | ConvertTo-Json -Compress -Depth 6))
 [Console]::Out.Flush()
}
