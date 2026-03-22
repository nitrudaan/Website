#!/bin/bash

# UDAAN Registration Toggle Script
# Double-click this file to run in Terminal
# Compatible with macOS and Linux

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/public/config.json"

# Ensure public directory exists
mkdir -p "$PROJECT_DIR/public"

# Check if config file exists, create with defaults if not
if [ ! -f "$CONFIG_FILE" ]; then
    echo '{"induction1stYearOpen": false, "induction2ndYearOpen": false, "registrationOpen": false}' > "$CONFIG_FILE"
fi

# Read current statuses
FIRST_YEAR_STATUS=$(grep -o '"induction1stYearOpen": *[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o 'true\|false' || echo "false")
SECOND_YEAR_STATUS=$(grep -o '"induction2ndYearOpen": *[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o 'true\|false' || echo "false")
CURRENT_STATUS=$(grep -o '"registrationOpen": *[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o 'true\|false' || echo "false")

# Set defaults if empty
[ -z "$FIRST_YEAR_STATUS" ] && FIRST_YEAR_STATUS="false"
[ -z "$SECOND_YEAR_STATUS" ] && SECOND_YEAR_STATUS="false"
[ -z "$CURRENT_STATUS" ] && CURRENT_STATUS="false"

clear
echo ""
echo "╔══════════════════════════════════════╗"
echo "║   UDAAN REGISTRATION CONTROL         ║"
echo "╚══════════════════════════════════════╝"
echo ""

if [ "$CURRENT_STATUS" = "true" ]; then
    echo "Current Status: ✅ REGISTRATION IS OPEN"
else
    echo "Current Status: ❌ REGISTRATION IS CLOSED"
fi

echo ""
echo "What would you like to do?"
echo "1) Turn ON registration"
echo "2) Turn OFF registration"
echo "3) Exit"
echo ""
printf "Enter your choice (1/2/3): "
read choice

case $choice in
    1)
        echo "{\"induction1stYearOpen\": $FIRST_YEAR_STATUS, \"induction2ndYearOpen\": $SECOND_YEAR_STATUS, \"registrationOpen\": true}" > "$CONFIG_FILE"
        echo ""
        echo "✅ Registration is now OPEN!"
        ;;
    2)
        echo "{\"induction1stYearOpen\": $FIRST_YEAR_STATUS, \"induction2ndYearOpen\": $SECOND_YEAR_STATUS, \"registrationOpen\": false}" > "$CONFIG_FILE"
        echo ""
        echo "❌ Registration is now CLOSED!"
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "Changes saved to: $CONFIG_FILE"
echo "The website will reflect changes on next page load."
echo ""
printf "Press Enter to close..."
read
