$ErrorActionPreference = "SilentlyContinue"

$AuditPayload = [ordered]@{}

$AuditPayload.Users = @(Get-LocalUser | Select-Object Name, Enabled, PasswordRequired, LastLogon)
$AuditPayload.Admins = @(Get-LocalGroupMember -Group "Administrators" | Select-Object Name, PrincipalSource)
$AuditPayload.GuestActive = @([bool](net user Guest | Select-String "Account active.*Yes"))

$AuditPayload.AccountPolicies = @(net accounts | Where-Object { $_.Trim() -ne "" })
$AuditPayload.Firewall = @(Get-NetFirewallProfile | Select-Object Name, Enabled)

$vulnServices = @("tlntsvr", "ftpsvc", "rshsvc", "snmp", "TermService", "vnc", "teamviewer")
$AuditPayload.InsecureServices = @(Get-Service | Where-Object { $vulnServices -contains $_.Name } | Select-Object Name, DisplayName, Status)
$AuditPayload.ListeningPorts = @(Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess | Sort-Object LocalPort)

$AuditPayload.UnquotedPaths = @(gwmi win32_service | Where-Object { $_.PathName -notlike '"*' -and $_.PathName -like '* *' } | Select-Object Name, PathName)

$AuditPayload.WMISubscriptions = @(Get-WmiObject -Namespace root\subscription -Class __EventConsumer | Select-Object __CLASS, Name, CommandLineTemplate, ExecutablePath)

$AuditPayload.RegistryRun = [ordered]@{
    HKLM = @(Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Run | Select-Object * -ExcludeProperty PSPath, PSChildName, PSParentPath, PSDrive, PSProvider)
    HKCU = @(Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Run | Select-Object * -ExcludeProperty PSPath, PSChildName, PSParentPath, PSDrive, PSProvider)
    Shell = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name Shell).Shell
    Userinit = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name Userinit).Userinit
    LogonScript = (Get-ItemProperty "HKCU:\Environment" -Name UserInitMprLogonScript).UserInitMprLogonScript
}

$AuditPayload.HiddenShares = @(Get-SmbShare | Where-Object { $_.Name -like "*$" -and $_.Name -notmatch "^(IPC|ADMIN|C)$" } | Select-Object Name, Path)
$AuditPayload.SuspiciousTasks = @(Get-ScheduledTask | Where-Object { $_.Principal.UserId -eq "SYSTEM" -and $_.State -ne "Disabled" } | Select-Object TaskName, TaskPath | Select-Object -First 20)

$exts = @("*.mp3", "*.mp4", "*.avi", "*.mov", "*.exe", "*.bat", "*.zip", "*.torrent")
$prohibitedFiles = @()
$userProfiles = Get-ChildItem "C:\Users" -Directory | Select-Object -ExpandProperty FullName
foreach ($profile in $userProfiles) {
    $searchPaths = @("$profile\Downloads", "$profile\Desktop", "$profile\Documents")
    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            $prohibitedFiles += Get-ChildItem -Path $path -Include $exts -Recurse -File | Select-Object FullName, Length | Select-Object -First 15
        }
    }
}
$AuditPayload.ProhibitedFiles = $prohibitedFiles

$AuditPayload.RiskyFeatures = @(Get-WindowsOptionalFeature -Online | Where-Object { $_.State -eq "Enabled" -and ($_.FeatureName -match "Media|Printing|TelnetClient") } | Select-Object FeatureName)

try {
    $updateSession = New-Object -ComObject Microsoft.Update.Session
    $updateSearcher = $updateSession.CreateUpdateSearcher()
    $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Software'")
    $AuditPayload.MissingUpdatesCount = $searchResult.Updates.Count
} catch {
    $AuditPayload.MissingUpdatesCount = "Error checking updates."
}

$AuditPayload | ConvertTo-Json -Depth 5 -Compress