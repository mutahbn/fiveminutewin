# ============================================================
#  The Five-Minute Win - publish to GitHub (one-shot)
#  Run from PowerShell inside E:\fiveminutewin\repo
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Publish to GitHub ===" -ForegroundColor Cyan

# --- 0. Check git ---
try { $gitV = git --version } catch {
  Write-Host "Git is not installed. Run this once, then re-run this script:" -ForegroundColor Red
  Write-Host "  winget install --id Git.Git -e" -ForegroundColor Yellow
  Write-Host "(or download from https://git-scm.com) - then CLOSE and REOPEN PowerShell."
  exit 1
}
Write-Host "Git found: $gitV"

# --- 1. Identity ---
git config --global user.name  2>$null | Out-Null
if (-not (git config --global user.name)) { git config --global user.name "mutahbn" }
if (-not (git config --global user.email)) { git config --global user.email "mutahbn@gmail.com" }

# --- 1.5 Place the GitHub Actions workflow (shipped under a neutral name) ---
if (Test-Path "github-workflow-deploy.yml") {
  New-Item -ItemType Directory -Force -Path ".github\workflows" | Out-Null
  Move-Item -Force "github-workflow-deploy.yml" ".github\workflows\deploy.yml"
  Write-Host "Installed GitHub Actions workflow."
}

# --- 2. Init, commit ---
if (-not (Test-Path ".git")) { git init -b main | Out-Null }
git add -A
$staged = git diff --cached --name-only
if ($staged) {
  git commit -m "The Five-Minute Win: daily real-life AI missions - production site, curriculum, and infra" -m "Live at fiveminutewin.com. Cloudflare Workers + D1 + Workers AI backend, single-file no-framework frontend, markdown-as-curriculum content pipeline with validated seed generation, capped free AI generation with privacy-hashed visitors, guided-helper endpoint, and push-to-deploy via GitHub Actions." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
} else {
  Write-Host "Nothing new to commit."
}

# --- 3. Remote + push ---
$hasRemote = git remote | Select-String "origin"
if (-not $hasRemote) { git remote add origin https://github.com/mutahbn/fiveminutewin.git }
Write-Host ""
Write-Host "Pushing... a GitHub sign-in window may pop up - approve it (you are already logged in)."
git push -u origin main

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Your project is live at: https://github.com/mutahbn/fiveminutewin"
