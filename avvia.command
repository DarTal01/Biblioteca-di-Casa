#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "  📚  Biblioteca di Casa"
echo "  ══════════════════════════════════"
echo ""

# Se il server è già attivo (servizio launchd), apri solo il browser
if curl -s --max-time 2 http://localhost:3000 > /dev/null 2>&1; then
  HOSTNAME=$(hostname -s)
  echo "  ✅  Il server è già in esecuzione."
  echo ""
  echo "  http://localhost:3000"
  echo "  http://${HOSTNAME}.local:3000"
  echo ""
  open "http://localhost:3000"
  read -p "  Premi Invio per chiudere..."
  exit 0
fi

# Altrimenti avvia manualmente
if ! command -v node &> /dev/null; then
  echo "  ❌  Node.js non trovato."
  echo "  Scaricalo da: https://nodejs.org (versione LTS)"
  open "https://nodejs.org"
  read -p "  Premi Invio per chiudere..."
  exit 1
fi

echo "  Avvio manuale del server..."
echo ""
node server.js

echo ""
read -p "  Server spento. Premi Invio per chiudere."
