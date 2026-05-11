param(
  [string]$BaseUrl = "https://mibloque-app.vercel.app"
)

$ErrorActionPreference = "Stop"

$routes = @(
  "/",
  "/login",
  "/admin",
  "/admin/cuotas"
)

Write-Host "Smoke test: $BaseUrl"
$failed = $false

foreach ($route in $routes) {
  $url = "$BaseUrl$route"
  try {
    $response = Invoke-WebRequest -Uri $url -MaximumRedirection 0 -UseBasicParsing -TimeoutSec 30
    $code = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
    } else {
      Write-Host "[FAIL] $route -> request error: $($_.Exception.Message)"
      $failed = $true
      continue
    }
  }

  if ($code -ge 500) {
    Write-Host "[FAIL] $route -> HTTP $code"
    $failed = $true
  } else {
    Write-Host "[OK]   $route -> HTTP $code"
  }
}

if ($failed) {
  Write-Host "Smoke test failed."
  exit 1
}

Write-Host "Smoke test passed."
exit 0
