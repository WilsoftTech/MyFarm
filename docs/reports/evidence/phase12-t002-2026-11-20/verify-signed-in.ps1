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
Check 'browser-spec-lint' { node node_modules/eslint/bin/eslint.js tests/browser/voice-api.spec.ts }
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:3211'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fixture-publishable-key'
Check 'fixture-build' { npm.cmd run build }
Check 'signed-in-voice-export-desktop-mobile' { npm.cmd run test:e2e -- --config playwright.production.config.ts tests/browser/voice-api.spec.ts tests/browser/farm-export-ui.spec.ts --reporter=line }
Write-Output 'SIGNED-IN VERIFICATION COMPLETE' | Tee-Object -FilePath $log -Append
