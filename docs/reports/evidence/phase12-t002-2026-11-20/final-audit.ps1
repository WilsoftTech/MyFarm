$ErrorActionPreference = 'Continue'
Set-Location D:\Myfarm
$env:TEST_DATABASE_URL = 'postgresql://myfarm:isolated-ci-password@127.0.0.1:55479/myfarm_phase01_test'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:DIRECT_URL = $env:TEST_DATABASE_URL
$log = 'D:\Myfarm\.cache\phase12-t002\verification.log'
function Check($label, [scriptblock]$action) {
  Write-Output "CHECK $label" | Tee-Object -FilePath $log -Append
  & $action 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) { throw "$label failed with exit $LASTEXITCODE" }
  Write-Output "PASS $label" | Tee-Object -FilePath $log -Append
}
Check 'final-lint' { npm.cmd run lint }
Check 'final-typecheck' { npm.cmd run typecheck }
Check 'final-diff' { git diff --check }
Get-Content -LiteralPath $log -Raw | Set-Content -LiteralPath 'D:\Myfarm\docs\reports\evidence\phase12-t002-2026-11-20\verification.log' -Encoding UTF8
Write-Output 'FINAL AUDIT COMPLETE'
