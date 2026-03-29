@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo [1/5] Limpiando residuos locales...
if exist ".next" rd /s /q ".next"
del /q /f ".accesslog" ".stats" "dev.log" "server.log" 2>nul
if exist "scripts" (
  del /q /f "scripts\*.log" 2>nul
  del /q /f "scripts\*.pid" 2>nul
)

echo [2/5] Cerrando puertos usados por la app...
call :kill_port 3000
call :kill_port 3001
call :kill_port 3002
call :kill_port 5555

echo [3/5] Verificando Bun...
where bun >nul 2>nul
if errorlevel 1 (
  echo Bun no esta instalado o no esta en PATH.
  exit /b 1
)

echo [4/5] Preparando dependencias y base de datos...
set "DATABASE_URL=file:../db/custom.db"
if not exist "node_modules" (
  call bun install
  if errorlevel 1 exit /b 1
)
call bun run db:generate
if errorlevel 1 exit /b 1
call bun run db:push
if errorlevel 1 exit /b 1

echo [5/5] Iniciando la app...
set "PORT=3000"
call bun run dev
exit /b %errorlevel%

:kill_port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%1 .*LISTENING"') do (
  echo Cerrando PID %%P en puerto %1...
  taskkill /F /PID %%P >nul 2>nul
)
exit /b 0
