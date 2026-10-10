$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Installer integration test only runs in a disposable GitHub Actions VM.' }
$taskVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$taskRoot = Join-Path $env:RUNNER_TEMP ('qusu-install-' + [guid]::NewGuid())
$taskInstall = Join-Path $taskRoot 'application'
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
Start-Process -FilePath $taskUninstall -ArgumentList '/S' -WindowStyle Hidden -Wait
$taskDeadline = (Get-Date).AddSeconds(20)
while ((Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe')) -and (Get-Date) -lt $taskDeadline) { Start-Sleep -Milliseconds 200 }
if (Test-Path -LiteralPath (Join-Path $taskInstall 'QUSU Editor.exe')) { throw 'Uninstall did not remove launcher' }
Write-Host "Windows install, Electron cleanup, repeated upgrade and uninstall passed. Installed footprint: $taskSize bytes."
