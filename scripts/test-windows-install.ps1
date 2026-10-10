$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Installer integration test only runs in a disposable GitHub Actions VM.' }
$taskVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$taskRoot = Join-Path $env:RUNNER_TEMP ('qusu-install-' + [guid]::NewGuid())
$taskInstall = Join-Path $taskRoot '中文 路径\QUSU Editor'
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null
function Install-Package([string]$package) {
  $taskProcess = Start-Process -FilePath $package -ArgumentList @('/S', ('/D=' + $taskInstall)) -WindowStyle Hidden -PassThru -Wait
  if ($taskProcess.ExitCode -ne 0) { throw "Installer failed: $($taskProcess.ExitCode)" }
  if (!(Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe'))) { throw 'Installed launcher missing' }
}
$taskOldInstaller = Join-Path $taskRoot 'old-version.exe'
Invoke-WebRequest 'https://github.com/Acerocloud/qusu-editor/releases/download/v1.2.0/QUSU-Editor-1.2.0-win-x64.exe' -OutFile $taskOldInstaller
Install-Package $taskOldInstaller
if (!(Test-Path -LiteralPath (Join-Path $taskInstall 'resources\app.asar'))) { throw 'Legacy Electron install is missing' }
$env:QUSU_TEST_LEGACY_EXECUTABLE = Join-Path $taskInstall 'QUSU Editor.exe'
node scripts/test-desktop.mjs
if ($LASTEXITCODE -ne 0) { throw 'Legacy-to-native browser persistence test failed' }
Remove-Item Env:\QUSU_TEST_LEGACY_EXECUTABLE
$taskNewInstaller = Join-Path (Get-Location) "release\QUSU-Editor-$taskVersion-win-x64.exe"
Install-Package $taskNewInstaller
if (Test-Path -LiteralPath (Join-Path $taskInstall 'resources')) { throw 'Old Electron resources remain after upgrade' }
if (Test-Path -LiteralPath (Join-Path $taskInstall 'chrome_100_percent.pak')) { throw 'Old Chromium files remain after upgrade' }
$taskSize = (Get-ChildItem -LiteralPath $taskInstall -File -Recurse | Measure-Object -Property Length -Sum).Sum
if ($taskSize -gt 20000000) { throw "Installed app is unexpectedly large: $taskSize" }
$env:QUSU_TEST_EXECUTABLE = Join-Path $taskInstall 'QUSU Editor.exe'
node scripts/test-desktop.mjs
if ($LASTEXITCODE -ne 0) { throw 'Installed launcher test failed' }
Remove-Item Env:\QUSU_TEST_EXECUTABLE
Install-Package $taskNewInstaller
if ((Get-ChildItem -LiteralPath $taskInstall -File).Count -ne 4) { throw 'Repeated installation left unexpected files' }
$taskUninstall = Join-Path $taskInstall 'Uninstall QUSU Editor.exe'
# Inspect only dialogs belonging to our own uninstaller in this disposable VM.
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class QusuDialogTest {
  private delegate bool EnumCallback(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumCallback callback, IntPtr data);
  [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumCallback callback, IntPtr data);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowTextW(IntPtr window, StringBuilder text, int maximum);
  [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr window);
  [DllImport("user32.dll")] private static extern bool IsWindowEnabled(IntPtr window);
  [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  public static string Text(IntPtr window) { var text=new StringBuilder(4096); GetWindowTextW(window,text,text.Capacity); return text.ToString(); }
  public static IntPtr[] Windows(int pid) { var result=new List<IntPtr>(); EnumWindows((window,data)=>{ uint owner; GetWindowThreadProcessId(window,out owner); if(owner==pid)result.Add(window); return true; },IntPtr.Zero); return result.ToArray(); }
  public static string ChildrenText(IntPtr parent) { var result=new List<string>(); EnumChildWindows(parent,(window,data)=>{result.Add(Text(window));return true;},IntPtr.Zero); return String.Join("\n",result); }
  public static bool StartUninstall(IntPtr parent) { IntPtr button=IntPtr.Zero; EnumChildWindows(parent,(window,data)=>{if(GetDlgCtrlID(window)==1&&IsWindowEnabled(window)&&(Text(window).Contains("卸载")||Text(window).Contains("Uninstall")))button=window;return true;},IntPtr.Zero); if(button==IntPtr.Zero)return false; return PostMessageW(parent,0x111,new IntPtr(1),button); }
}
'@
$env:QUSU_TEST_USER_DATA = Join-Path $taskRoot 'busy-app-test'
New-Item -ItemType Directory -Path $env:QUSU_TEST_USER_DATA -Force | Out-Null
$taskHost = Start-Process -FilePath (Join-Path $taskInstall 'QUSU Editor.exe') -WindowStyle Hidden -PassThru
$taskDialogProcess = $null
try {
  $taskDeadline=(Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 200
    try { $taskReady=(Invoke-RestMethod 'http://127.0.0.1:17863/.qusu-launcher' -TimeoutSec 1).version -eq $taskVersion } catch { $taskReady=$false }
  } while (!$taskReady -and (Get-Date) -lt $taskDeadline)
  if (!$taskReady) { throw 'Busy application did not start' }
  $taskBlocked=Start-Process -FilePath $taskNewInstaller -ArgumentList @('/S',('/D='+$taskInstall)) -WindowStyle Hidden -Wait -PassThru
  if ($taskBlocked.ExitCode -ne 2) { throw "Running-app installation was not safely blocked: $($taskBlocked.ExitCode)" }
  $taskBlocked=Start-Process -FilePath $taskUninstall -ArgumentList @('/S',('_?='+$taskInstall)) -WindowStyle Hidden -Wait -PassThru
  if ($taskBlocked.ExitCode -ne 2) { throw "Running-app uninstallation was not safely blocked: $($taskBlocked.ExitCode)" }
  $taskDialogProcess=Start-Process -FilePath $taskUninstall -ArgumentList ('_?='+$taskInstall) -WindowStyle Hidden -PassThru
  $taskExpected='请先从系统托盘退出 QUSU Editor，再点击重试卸载。'
  $taskDeadline=(Get-Date).AddSeconds(15)
  $taskStarted=$false; $taskMessage=''
  do {
    foreach ($taskWindow in [QusuDialogTest]::Windows($taskDialogProcess.Id)) {
      $taskText=[QusuDialogTest]::ChildrenText($taskWindow)
      if ($taskText.Contains($taskExpected)) { $taskMessage=$taskText; break }
      if (!$taskStarted -and [QusuDialogTest]::StartUninstall($taskWindow)) { $taskStarted=$true }
    }
    if (!$taskMessage) { Start-Sleep -Milliseconds 200 }
  } while (!$taskMessage -and (Get-Date) -lt $taskDeadline)
  if (!$taskMessage.Contains($taskExpected)) { throw "Chinese uninstall message is missing or corrupted: $taskText" }
  if ($taskHost.HasExited -or !(Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe'))) { throw 'Blocked uninstall affected the running application' }
  Write-Host "Verified real Unicode uninstall dialog: $taskExpected"
} finally {
  # These PIDs were created above solely for integration testing.
  if ($taskDialogProcess -and !$taskDialogProcess.HasExited) { Stop-Process -Id $taskDialogProcess.Id -Force }
  if (!$taskHost.HasExited) { Stop-Process -Id $taskHost.Id -Force }
  Remove-Item Env:\QUSU_TEST_USER_DATA
}
Start-Process -FilePath $taskUninstall -ArgumentList '/S' -WindowStyle Hidden -Wait
$taskDeadline = (Get-Date).AddSeconds(20)
while ((Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe')) -and (Get-Date) -lt $taskDeadline) { Start-Sleep -Milliseconds 200 }
if (Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe')) { throw 'Uninstall did not remove launcher' }
Write-Host "Windows install, Electron cleanup, repeated upgrade and uninstall passed. Installed footprint: $taskSize bytes."
foreach ($taskPreviousVersion in @('1.3.0','1.3.1')) {
  $taskPreviousInstaller=Join-Path $taskRoot "old-$taskPreviousVersion.exe"
  Invoke-WebRequest "https://github.com/Acerocloud/qusu-editor/releases/download/v$taskPreviousVersion/QUSU-Editor-$taskPreviousVersion-win-x64.exe" -OutFile $taskPreviousInstaller
  Install-Package $taskPreviousInstaller
  Install-Package $taskNewInstaller
  if ((Get-ChildItem -LiteralPath $taskInstall -File).Count -ne 4) { throw "Upgrade from $taskPreviousVersion left unexpected files" }
  Start-Process -FilePath $taskUninstall -ArgumentList '/S' -WindowStyle Hidden -Wait
  $taskDeadline=(Get-Date).AddSeconds(20)
  while ((Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe')) -and (Get-Date) -lt $taskDeadline) { Start-Sleep -Milliseconds 200 }
  if (Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe')) { throw 'Uninstall failed after legacy native upgrade' }
  Write-Host "Upgrade from native version $taskPreviousVersion passed in a Chinese path containing spaces."
}
