# =============================================================================
# deploy-web.ps1 — Exporta ZenMoney como web app y la publica en GitHub Pages
# =============================================================================
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\deploy-web.ps1
# Publica en: https://jeandangelo.github.io/ZenMoney/
#
# Qué hace (mismo camino probado en ZenTask):
#   1. `expo export` genera la web estática en dist/ (lee las EXPO_PUBLIC_* del .env)
#   2. Inyecta las etiquetas PWA (manifest, iconos, modo standalone) en el HTML
#   3. Sube dist/ a la rama gh-pages del repo (force push: la rama es solo build)
# =============================================================================
$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."

npx expo export --platform web
if ($LASTEXITCODE -ne 0) { throw "expo export fallo (codigo $LASTEXITCODE)" }

# Copiar manifest e iconos PWA al build
Copy-Item public\manifest.json dist\manifest.json -Force
Copy-Item public\icons dist\icons -Recurse -Force

# ── Etiquetas PWA en el <head> ───────────────────────────────────────────────
$index = "dist\index.html"
$tags = '<link rel="manifest" href="/ZenMoney/manifest.json"/>' +
        '<meta name="theme-color" content="#0D0D0D"/>' +
        '<link rel="apple-touch-icon" href="/ZenMoney/icons/icon-512.png"/>' +
        '<meta name="apple-mobile-web-app-capable" content="yes"/>' +
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>' +
        '<meta name="apple-mobile-web-app-title" content="ZenMoney"/>'
(Get-Content $index -Raw) -replace '</head>', "$tags</head>" | Set-Content $index -Encoding utf8 -NoNewline

# SPA fallback: GitHub Pages sirve 404.html para rutas desconocidas
Copy-Item dist\index.html dist\404.html -Force

# .nojekyll: que Pages no ignore carpetas con guion bajo (_expo)
New-Item -ItemType File dist\.nojekyll -Force | Out-Null

# ── Publicar dist/ como rama gh-pages ────────────────────────────────────────
Push-Location dist
try {
  git init -b gh-pages | Out-Null
  git add -A
  git commit -m "deploy web $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
  git push -f https://github.com/jeandangelo/ZenMoney.git gh-pages:gh-pages
} finally {
  Pop-Location
  if (Test-Path dist\.git) { Remove-Item dist\.git -Recurse -Force }
}

Write-Host ""
Write-Host "Publicado: https://jeandangelo.github.io/ZenMoney/" -ForegroundColor Green
