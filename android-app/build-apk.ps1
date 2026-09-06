$ErrorActionPreference='Stop'
if (Test-Path .\gradlew.bat) { .\gradlew.bat assembleDebug } else { Write-Host 'Open this folder in Android Studio first so Gradle can be configured.' -ForegroundColor Yellow }
