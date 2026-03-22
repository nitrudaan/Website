#!/bin/bash

# UDAAN 2nd Year Induction Toggle Script
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
REGISTRATION_STATUS=$(grep -o '"registrationOpen": *[^,}]*' "$CONFIG_FILE" 2>/dev/null | grep -o 'true\|false' || echo "false")

# Set defaults if empty
[ -z "$FIRST_YEAR_STATUS" ] && FIRST_YEAR_STATUS="false"
[ -z "$SECOND_YEAR_STATUS" ] && SECOND_YEAR_STATUS="false"
[ -z "$REGISTRATION_STATUS" ] && REGISTRATION_STATUS="false"

clear
echo ""
echo "╔══════════════════════════════════════╗"
echo "║   UDAAN 2ND YEAR INDUCTION CONTROL   ║"
echo "╚══════════════════════════════════════╝"
echo ""

if [ "$SECOND_YEAR_STATUS" = "true" ]; then
    echo "Current Status: ✅ 2ND YEAR INDUCTIONS ARE OPEN"
else
    echo "Current Status: ❌ 2ND YEAR INDUCTIONS ARE CLOSED"
fi

echo ""
echo "What would you like to do?"
echo "1) Turn ON 2nd year inductions"
echo "2) Turn OFF 2nd year inductions"
echo "3) Exit"
echo ""
printf "Enter your choice (1/2/3): "
read choice

case $choice in
    1)
        echo "{\"induction1stYearOpen\": $FIRST_YEAR_STATUS, \"induction2ndYearOpen\": true, \"registrationOpen\": $REGISTRATION_STATUS}" > "$CONFIG_FILE"
        echo ""
        echo "✅ 2nd Year Inductions are now OPEN!"
        ;;
    2)
        echo "{\"induction1stYearOpen\": $FIRST_YEAR_STATUS, \"induction2ndYearOpen\": false, \"registrationOpen\": $REGISTRATION_STATUS}" > "$CONFIG_FILE"
        echo ""
        echo "❌ 2nd Year Inductions are now CLOSED!"
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
