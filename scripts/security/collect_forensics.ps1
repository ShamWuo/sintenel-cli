# Sintenel-CLI: Windows Forensic Evidence Collection Script
# Purpose: Deep dive into forensic artifacts for CyberPatriot.
# Safety: Read-only. Does not modify artifacts.

Write-Output "=== STARTING FORENSIC DATA COLLECTION ==="

Write-Output "`n=== EVENT LOG AUDIT (SUCCESSFUL LOGONS) ==="
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624} -MaxEvents 20 | Select-Object TimeCreated, @{n='TargetUser';e={$_.Properties[5].Value}}, @{n='IpAddress';e={$_.Properties[18].Value}} | Format-Table -AutoSize

Write-Output "`n=== EVENT LOG AUDIT (FAILED LOGONS) ==="
Get-WinEvent -FilterHashtable @{LogName='Security';ID=4625} -MaxEvents 20 | Select-Object TimeCreated, @{n='TargetUser';e={$_.Properties[5].Value}}, @{n='IpAddress';e={$_.Properties[19].Value}} | Format-Table -AutoSize

Write-Output "`n=== RECENTLY MODIFIED FILES IN SYSTEM32 ==="
Get-ChildItem -Path C:\Windows\System32 -File | Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-1) } | Select-Object FullName, LastWriteTime | Format-Table -AutoSize

Write-Output "`n=== CRITICAL REGISTRY KEYS (PREFETCH/SHIMCACHE LOGGING) ==="
# Check if Prefetch is enabled
Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters" -Name EnablePrefetcher | Select-Object EnablePrefetcher

Write-Output "`n=== SUSPICIOUS EXECUTABLES IN TEMP/DOWNLOADS ==="
$exts = @("*.exe", "*.ps1", "*.bat", "*.vbs", "*.sh")
$searchPaths = @("C:\Windows\Temp", "C:\Users\*\Downloads", "C:\Users\*\Desktop", "C:\Users\*\AppData\Local\Temp")
foreach ($path in $searchPaths) {
    if (Test-Path $path) {
        Get-ChildItem -Path $path -Include $exts -Recurse -File | Select-Object FullName, @{n='MD5';e={(Get-FileHash $_.FullName -Algorithm MD5).Hash}}, LastWriteTime | Select-Object -First 30 | Format-Table -AutoSize
    }
}

Write-Output "`n=== DNS CACHE ARTIFACTS (ESTABLISHED DOMAINS) ==="
Get-DnsClientCache | Select-Object EntryName, Data | Select-Object -First 20 | Format-Table -AutoSize

Write-Output "`n=== ACTIVE SESSIONS (TERMINAL SERVICES) ==="
qwinsta | Select-Object -Skip 1 | Format-Table -AutoSize

Write-Output "=== FORENSIC COLLECTION COMPLETE ==="
