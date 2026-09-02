# Put a "Gold Watch" shortcut on the desktop, using the project icon.
# Run once:  powershell -ExecutionPolicy Bypass -File tasks\create-desktop-shortcut.ps1

$ErrorActionPreference = "Stop"

$Root   = Split-Path -Parent $PSScriptRoot
$target = Join-Path $Root "Gold Watch.cmd"
$icon   = Join-Path $Root "gold-watch.ico"

foreach ($f in @($target, $icon)) {
  if (-not (Test-Path $f)) { Write-Error "Not found: $f" }
}

$desktop = [Environment]::GetFolderPath("Desktop")
$link    = Join-Path $desktop "Gold Watch.lnk"

$sc = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
$sc.TargetPath       = $target
$sc.WorkingDirectory = $Root
$sc.IconLocation     = "$icon,0"
$sc.Description      = "Gold Watch control panel"
$sc.WindowStyle      = 7      # start the console minimised; only the panel shows
$sc.Save()

Write-Host "Created: $link"
Write-Host "Double-click the gold bar icon on the desktop to open the control panel."
