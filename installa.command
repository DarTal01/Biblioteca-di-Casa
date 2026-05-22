#!/bin/bash
# ── Installa Biblioteca come servizio automatico (launchd) ────────────────────
cd "$(dirname "$0")"
DIR="$(pwd)"

echo ""
echo "  📚  Installazione Biblioteca di Casa"
echo "  ══════════════════════════════════════"
echo ""

# ── Trova Node.js ──────────────────────────────────────────────────────────────
NODE_PATH=""
for candidate in \
  "$(which node 2>/dev/null)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | sort -V | tail -1)/bin/node" \
  "/usr/bin/node"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    NODE_PATH="$candidate"
    break
  fi
done

if [ -z "$NODE_PATH" ]; then
  echo "  ❌  Node.js non trovato."
  echo "  Installalo da https://nodejs.org (versione LTS) e riprova."
  echo ""
  open "https://nodejs.org"
  read -p "  Premi Invio per chiudere..."
  exit 1
fi
echo "  ✓  Node.js trovato: $NODE_PATH"

# ── Prepara LaunchAgents ──────────────────────────────────────────────────────
LAUNCHAGENTS="$HOME/Library/LaunchAgents"
PLIST="$LAUNCHAGENTS/com.biblioteca.server.plist"
LABEL="com.biblioteca.server"

mkdir -p "$LAUNCHAGENTS"

# Ferma versione precedente se esiste
launchctl unload "$PLIST" 2>/dev/null
sleep 0.5

# ── Crea file plist ───────────────────────────────────────────────────────────
cat > "$PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${DIR}/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${DIR}</string>

  <!-- Avvia subito e ad ogni login -->
  <key>RunAtLoad</key>
  <true/>

  <!-- Riavvia automaticamente in caso di crash -->
  <key>KeepAlive</key>
  <true/>

  <!-- Log -->
  <key>StandardOutPath</key>
  <string>${DIR}/server.log</string>
  <key>StandardErrorPath</key>
  <string>${DIR}/server.log</string>
</dict>
</plist>
PLISTEOF

echo "  ✓  Servizio configurato"

# ── Avvia il servizio ─────────────────────────────────────────────────────────
launchctl load "$PLIST"
echo "  ✓  Servizio avviato"
sleep 2

# ── Mostra risultato ──────────────────────────────────────────────────────────
HOSTNAME=$(hostname -s)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "—")

echo ""
if curl -s --max-time 4 http://localhost:3000 > /dev/null 2>&1; then
  echo "  ✅  Server attivo e funzionante!"
  echo ""
  echo "  ══════════════════════════════════════════════"
  echo "  🖥   Questo Mac      →  http://localhost:3000"
  echo "  📱   Rete di casa    →  http://${HOSTNAME}.local:3000"
  echo "  🌐   (oppure IP)     →  http://${IP}:3000"
  echo "  ══════════════════════════════════════════════"
  echo ""
  echo "  💡  Salva http://${HOSTNAME}.local:3000 nei preferiti"
  echo "      del browser su ogni dispositivo."
  echo ""
  echo "  Il server si avvierà automaticamente"
  echo "  ad ogni accensione del Mac. ✨"
  echo ""
  open "http://localhost:3000"
else
  echo "  ⚠️  Il server impiega qualche secondo ad avviarsi."
  echo "  Apri http://localhost:3000 tra un momento."
fi

echo ""
read -p "  Premi Invio per chiudere..."
