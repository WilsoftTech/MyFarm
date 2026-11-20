$ErrorActionPreference='Stop'
Set-Location D:\Myfarm
$env:DATABASE_URL='postgresql://myfarm:isolated-ci-password@127.0.0.1:55476/myfarm_phase01_test'
$env:DIRECT_URL=$env:DATABASE_URL
$env:TEST_DATABASE_URL=$env:DATABASE_URL
function Check($label, [scriptblock]$action) {
  Write-Output "CHECK $label"
  $ErrorActionPreference='Continue'
  & $action
  if ($LASTEXITCODE -ne 0) { throw "$label failed with exit $LASTEXITCODE" }
  Write-Output "PASS $label"
}
Check 'lint' { npm.cmd run lint }
Check 'typecheck' { npm.cmd run typecheck }
Check 'boundaries' { npm.cmd run check:boundaries }
Check 'unit-component' { npm.cmd test }
Check 'integration' { npm.cmd run test:integration }
Check 'build' { npm.cmd run build }
Check 'anonymous-browser' { npm.cmd run test:e2e -- --reporter=line }
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:3211'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fixture-publishable-key'
Check 'fixture-build' { npm.cmd run build }
Check 'signed-in-desktop-mobile' { npm.cmd run test:e2e -- --config playwright.production.config.ts tests/browser/offline-actions-ui.spec.ts tests/browser/offline-replay-ui.spec.ts tests/browser/offline-shell-ui.spec.ts tests/browser/offline-sync-ui.spec.ts --reporter=line }
Write-Output 'VERIFICATION COMPLETE'