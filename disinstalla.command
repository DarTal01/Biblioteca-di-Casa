#!/bin/bash
# ── Rimuove il servizio automatico ────────────────────────────────────────────
echo ""
echo "  📚  Rimozione servizio Biblioteca di Casa"
echo "  ══════════════════════════════════════════"
echo ""

PLIST="$HOME/Library/LaunchAgents/com.biblioteca.server.plist"

if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null
  rm "$PLIST"
  echo "  ✓  Servizio rimosso."
  echo "  Il server non si avvierà più automaticamente."
  echo "  I dati in data.json rimangono intatti."
else
  echo "  Il servizio non era installato."
fi

echo ""
read -p "  Premi Invio per chiudere..."
