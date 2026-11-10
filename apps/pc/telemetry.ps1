$ErrorActionPreference = 'Stop'
$temperatures = @()
foreach ($source in @('LibreHardwareMonitor', 'OpenHardwareMonitor')) {
    try {
        $temperatures += @(Get-CimInstance -Namespace "root/$source" -ClassName Sensor -ErrorAction Stop |
            Where-Object { $_.SensorType -eq 'Temperature' -and $null -ne $_.Value } |
            ForEach-Object { @{ name = $_.Name; celsius = [double]$_.Value; source = $source } })
    } catch {}
    if ($temperatures.Count) { break }
}
# ACPI zones are motherboard/firmware readings, not necessarily CPU temperatures.
if (-not $temperatures.Count) {
    try {
        $temperatures = @(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature |
            Where-Object { $_.CurrentTemperature -gt 0 } |
            ForEach-Object { @{ name = 'ACPI thermal zone'; celsius = [math]::Round(($_.CurrentTemperature / 10) - 273.15, 1); source = 'ACPI' } })
    } catch {}
}
$network = @()
try {
    $network = @(Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object {
        $adapter = $_
        $stats = $adapter | Get-NetAdapterStatistics
        @{ id = [string]$adapter.InterfaceGuid; name = $adapter.Name; received = [double]$stats.ReceivedBytes; sent = [double]$stats.SentBytes; link = [string]$adapter.LinkSpeed }
    })
} catch {}
@{ temperatures = @($temperatures); network = @($network) } | ConvertTo-Json -Depth 5 -Compress
