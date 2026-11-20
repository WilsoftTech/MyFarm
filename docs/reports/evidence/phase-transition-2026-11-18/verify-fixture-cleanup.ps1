$ErrorActionPreference='Stop'
Set-Location D:\Myfarm
$env:DATABASE_URL='postgresql://myfarm:isolated-ci-password@127.0.0.1:55476/myfarm_phase01_test'
$env:DIRECT_URL=$env:DATABASE_URL
$env:TEST_DATABASE_URL=$env:DATABASE_URL
function Check($label, [scriptblock]$action) {
  Write-Output "CHECK $label"
  $ErrorActionPreference='Continue'
  & $action
  if($LASTEXITCODE -ne 0){throw "$label failed with exit $LASTEXITCODE"}
  Write-Output "PASS $label"
}
Check 'lint' { npm.cmd run lint }
Check 'typecheck' { npm.cmd run typecheck }
Check 'signed-in-desktop-mobile' { npm.cmd run test:e2e -- --config playwright.production.config.ts tests/browser/offline-actions-ui.spec.ts tests/browser/offline-replay-ui.spec.ts tests/browser/offline-shell-ui.spec.ts tests/browser/offline-sync-ui.spec.ts --reporter=line }
Write-Output 'VERIFICATION COMPLETE'