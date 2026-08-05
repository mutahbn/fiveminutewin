# ============================================================
#  The Five-Minute Win - one-shot deploy script (ASCII-safe)
#  Run from PowerShell inside E:\fiveminutewin\site
# ============================================================

$ErrorActionPreference = "Stop"
$env:WRANGLER_SEND_METRICS = "false"

Write-Host ""
Write-Host "=== The Five-Minute Win - Deploy ===" -ForegroundColor Cyan

# --- 0. Check Node.js ---
try { $nodeV = node --version } catch {
  Write-Host "Node.js is not installed. Install the LTS version from https://nodejs.org then run this script again." -ForegroundColor Red
  exit 1
}
Write-Host "Node.js found: $nodeV"

# --- 1. Token ---
$token = Read-Host "Paste your Cloudflare API token and press Enter"
$env:CLOUDFLARE_API_TOKEN = $token.Trim()

# --- 2. Dependencies ---
Write-Host ""
Write-Host "Installing dependencies (first run takes a minute)..."
npm install --no-fund --no-audit | Out-Null

# --- 3. Verify token ---
Write-Host ""
Write-Host "Verifying Cloudflare access..."
npx wrangler whoami

# --- 4. Create the database (only if not created yet) ---
$toml = Get-Content wrangler.toml -Raw
if ($toml -match "REPLACE_AFTER_CREATE") {
  Write-Host ""
  Write-Host "Creating production database 'fmw'..."
  $out = npx wrangler d1 create fmw 2>&1 | Out-String
  Write-Host $out
  if ($out -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') {
    $dbid = $Matches[1]
    (Get-Content wrangler.toml -Raw) -replace "REPLACE_AFTER_CREATE", $dbid | Set-Content wrangler.toml -NoNewline
    Write-Host "Database created and configured: $dbid" -ForegroundColor Green
  } else {
    Write-Host "Could not find the database id in the output above. Copy that output to Claude." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host ""
  Write-Host "Database already configured - skipping creation."
}

# --- 5. Load schema + all 7 missions ---
Write-Host ""
Write-Host "Loading schema and missions into the production database..."
"y" | npx wrangler d1 execute fmw --remote --file=db/schema.sql
"y" | npx wrangler d1 execute fmw --remote --file=db/seed.sql

# --- 6. Secrets ---
# Generates a fresh random salt for visitor hashing. Note: re-running rotates the
# salt, which harmlessly resets the day's per-visitor generation counters.
Write-Host ""
Write-Host "Setting the visitor-privacy salt..."
$salt = -join (1..48 | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
"$salt" | npx wrangler secret put VISITOR_SALT

# --- 7. Deploy ---
Write-Host ""
Write-Host "Deploying the site..."
npx wrangler deploy

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Look a few lines up for a URL ending in workers.dev - that is your live site."
Write-Host "Copy the last 15 lines of this window and paste them to Claude."
Write-Host ""
Write-Host "If deploy asked you to pick a workers.dev subdomain, type: fiveminutewin"
Write-Host "then press Enter, and run this script once more."
