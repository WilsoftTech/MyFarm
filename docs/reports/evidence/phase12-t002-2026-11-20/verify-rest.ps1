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
Check 'schema-drift' { node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code }
Check 'build' { npm.cmd run build }
Check 'anonymous-desktop-mobile' { npm.cmd run test:e2e -- --reporter=line }
Write-Output 'VERIFICATION COMPLETE' | Tee-Object -FilePath $log -Append
