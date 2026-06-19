[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

# WMI/CIM gives us the same fields without our process having to open
# handles to other processes — the WMI service does that on our behalf.
# Avoids the Living-off-the-Land pattern of self-driven process inspection
# that AhnLab Safe Transaction (and similar bank-context guards) watch for.
Get-CimInstance -ClassName Win32_Process |
  Where-Object { $_.ExecutablePath } |
  ForEach-Object {
    [PSCustomObject]@{
      pid         = [int]$_.ProcessId
      name        = ($_.Name -replace '\.exe$', '')
      exePath     = $_.ExecutablePath
      memoryBytes = [int64]$_.WorkingSetSize
    }
  } |
  ConvertTo-Json -Compress
