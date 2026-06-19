[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

$paths = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

Get-ItemProperty $paths |
  Where-Object { $_.DisplayName } |
  ForEach-Object {
    [PSCustomObject]@{
      displayName     = $_.DisplayName
      publisher       = $_.Publisher
      installDate     = $_.InstallDate
      estimatedSizeKb = $_.EstimatedSize
      installLocation = $_.InstallLocation
      displayIcon     = $_.DisplayIcon
      displayVersion  = $_.DisplayVersion
    }
  } |
  ConvertTo-Json -Compress
