# NexusOPS Lambda Packaging Script
# Optimized for AWS Lambda (Fixed for architecture compatibility)

Write-Host "--- Starting Optimized NexusOPS Lambda Packaging ---" -ForegroundColor Cyan

# 1. Package BFF (Python)
# 🚨 IMPORTANT: Using --platform and --only-binary to ensure Linux compatibility
Write-Host "Packaging BFF (Python)..." -ForegroundColor Yellow
if (Test-Path "dist_bff") { Remove-Item -Recurse -Force "dist_bff" }
New-Item -ItemType Directory -Path "dist_bff"

Write-Host "Fetching Linux-compatible binaries for Lambda..." -ForegroundColor Gray
python -m pip install `
    --platform manylinux2014_x86_64 `
    --target dist_bff `
    --implementation cp `
    --python-version 3.11 `
    --only-binary=:all: `
    --upgrade `
    -r requirements.txt `
    --quiet

xcopy /S /E bff\* dist_bff\bff\ /Y /Q /Exclude:exclude.txt
if (Test-Path "bff_deployment.zip") { Remove-Item "bff_deployment.zip" }

Write-Host "Compressing BFF..." -ForegroundColor Gray
Compress-Archive -Path dist_bff\* -DestinationPath bff_deployment.zip
Write-Host "✅ Created bff_deployment.zip" -ForegroundColor Green

# 2. Package Orchestrator (Node.js)
Write-Host "`nPackaging Orchestrator (Node.js)..." -ForegroundColor Yellow
Set-Location "orchestrator"
npm run build
Set-Location ".."

if (Test-Path "dist_orchestrator") { Remove-Item -Recurse -Force "dist_orchestrator" }
New-Item -ItemType Directory -Path "dist_orchestrator"

xcopy /S /E orchestrator\dist\* dist_orchestrator\dist\ /Y /Q
Copy-Item "orchestrator\package.json" -Destination "dist_orchestrator\"

Set-Location "dist_orchestrator"
Write-Host "Installing Orchestrator dependencies..." -ForegroundColor Gray
npm install --omit=dev --quiet
Set-Location ".."

if (Test-Path "orchestrator_deployment.zip") { Remove-Item "orchestrator_deployment.zip" }
Compress-Archive -Path dist_orchestrator\* -DestinationPath orchestrator_deployment.zip
Write-Host "✅ Created orchestrator_deployment.zip" -ForegroundColor Green

Write-Host "`n🎉 Packaging Complete! Please re-upload the .zip files to AWS." -ForegroundColor Cyan
