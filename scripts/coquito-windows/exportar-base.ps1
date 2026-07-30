# ---------------------------------------------------------------------------
#  Exporta / respalda la base de datos de easy pos (Auto Piezas Coquito).
#
#  Lo ejecuta el acceso directo "Exportar datos easy pos" del escritorio
#  (o doble clic en "Exportar datos easy pos.bat" en C:\easypos-servidor).
#
#  Genera una carpeta con fecha en Documentos\easypos-exportaciones con:
#    respaldo-completo.backup  TODO el sistema, para restaurar tal cual
#                              (pg_restore); es EL respaldo de verdad.
#    respaldo-completo.sql     lo mismo en SQL legible; sirve para migrar
#                              a cualquier PostgreSQL.
#    *.csv                     productos, ventas, detalle, gastos, cortes,
#                              clientes y usuarios: se abren con Excel.
#  No toca la base (solo lee): se puede correr con el negocio operando.
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$DIR = $PSScriptRoot

try {
  # --- Conexion: se lee de .env.local (puerto incluido) --------------------
  $envFile = Join-Path $DIR ".env.local"
  if (-not (Test-Path $envFile)) { throw "no se encontro $envFile" }
  $urlLinea = (Get-Content $envFile) | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if ($urlLinea -notmatch 'postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([A-Za-z0-9_]+)') {
    throw "no se pudo leer DATABASE_URL de .env.local"
  }
  $PG_USER = $Matches[1]; $PG_PASS = $Matches[2]
  $PG_HOST = $Matches[3]; $PG_PORT = $Matches[4]; $PG_DB = $Matches[5]

  # --- Herramientas de PostgreSQL (la instalacion mas nueva, 12+) ----------
  $pg = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
    ForEach-Object {
      $m = 0; if ($_.Directory.Parent.Name -match '^(\d+)') { $m = [int]$Matches[1] }
      [pscustomobject]@{ Bin = $_.Directory.FullName; Major = $m }
    } | Where-Object { $_.Major -ge 12 } | Sort-Object Major -Descending | Select-Object -First 1
  if (-not $pg) { throw "no se encontro PostgreSQL (pg_dump) en esta PC" }
  $PGDUMP = Join-Path $pg.Bin "pg_dump.exe"
  $PSQL   = Join-Path $pg.Bin "psql.exe"

  # --- Carpeta de salida con fecha -----------------------------------------
  $docs = [Environment]::GetFolderPath('MyDocuments')
  $carpeta = Join-Path $docs ("easypos-exportaciones\" + (Get-Date -Format 'yyyy-MM-dd_HHmm'))
  New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
  Write-Host "Exportando la base '$PG_DB' a:" -ForegroundColor Yellow
  Write-Host "  $carpeta"
  $env:PGPASSWORD = $PG_PASS

  # --- 1) Respaldos completos ----------------------------------------------
  Write-Host "`n[1/3] Respaldo completo (.backup, para restaurar tal cual)..."
  & $PGDUMP -U $PG_USER -h $PG_HOST -p $PG_PORT -Fc -f (Join-Path $carpeta "respaldo-completo.backup") $PG_DB
  if ($LASTEXITCODE -ne 0) { throw "fallo pg_dump (.backup)" }

  Write-Host "[2/3] Respaldo en SQL (portable a cualquier PostgreSQL)..."
  & $PGDUMP -U $PG_USER -h $PG_HOST -p $PG_PORT -f (Join-Path $carpeta "respaldo-completo.sql") $PG_DB
  if ($LASTEXITCODE -ne 0) { throw "fallo pg_dump (.sql)" }

  # --- 2) CSV para Excel ----------------------------------------------------
  Write-Host "[3/3] Tablas en CSV (se abren con Excel)..."
  $tablas = [ordered]@{
    "productos"      = "SELECT id AS sku, name AS nombre, category AS categoria, price AS precio_venta, cost AS costo, stock, barcode AS codigo_barras, status AS estado FROM products ORDER BY name"
    "ventas"         = "SELECT code AS comprobante, kind AS tipo, created_at AS fecha, client_name AS cliente, subtotal, discount AS descuento, total, pay_method AS metodo_pago, voided AS anulada FROM sales ORDER BY created_at"
    "ventas-detalle" = "SELECT s.code AS comprobante, s.created_at AS fecha, i.product_id AS sku, i.name AS producto, i.qty AS cantidad, i.unit_price AS precio_unitario, i.discount_pct AS descuento_pct FROM sale_items i JOIN sales s ON s.id = i.sale_id ORDER BY s.created_at"
    "gastos"         = "SELECT category AS categoria, description AS descripcion, amount AS monto, spent_at AS fecha FROM expenses ORDER BY spent_at"
    "cortes-caja"    = "SELECT * FROM cash_closes ORDER BY 1"
    "clientes"       = "SELECT * FROM customers"
    "usuarios"       = "SELECT name AS nombre, email AS correo, phone AS telefono, role AS rol, active AS activo, created_at AS creado FROM employees ORDER BY name"
  }
  foreach ($n in $tablas.Keys) {
    $csv = (Join-Path $carpeta "$n.csv") -replace '\\', '/'
    & $PSQL -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DB -v ON_ERROR_STOP=1 `
      -c "\copy ($($tablas[$n])) TO '$csv' WITH (FORMAT csv, HEADER, DELIMITER ';')"
    if ($LASTEXITCODE -ne 0) { throw "fallo exportando $n.csv" }
    # BOM UTF-8: sin esto, Excel muestra mal los acentos.
    $texto = [IO.File]::ReadAllText($csv, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($csv, $texto, [Text.UTF8Encoding]::new($true))
  }
  $env:PGPASSWORD = $null

  Write-Host ""
  Write-Host "==================================================================" -ForegroundColor Green
  Write-Host " LISTO. Exportacion completa en:" -ForegroundColor Green
  Write-Host "   $carpeta"
  Get-ChildItem $carpeta | ForEach-Object { Write-Host ("   - {0}  ({1:N0} KB)" -f $_.Name, ($_.Length/1KB)) }
  Write-Host ""
  Write-Host " Los .csv se abren con Excel. Para restaurar el sistema entero:"
  Write-Host "   pg_restore -U easypos -d bo_epos_coquito --clean respaldo-completo.backup"
  Write-Host "==================================================================" -ForegroundColor Green
  Start-Process explorer.exe $carpeta
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
