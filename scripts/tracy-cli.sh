#!/bin/bash
# Tracy Quick Add - macOS CLI for adding transactions
# Usage: tracy -30 gas at Shell
# Usage: tracy +500 freelance project

TRACY_API="http://localhost:3847"
DEVICE_ID_FILE="$HOME/.tracy_device_id"

# Get or create device ID
if [ -f "$DEVICE_ID_FILE" ]; then
    DEVICE_ID=$(cat "$DEVICE_ID_FILE")
else
    DEVICE_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    echo "$DEVICE_ID" > "$DEVICE_ID_FILE"
fi

# Combine all arguments into one string
TEXT="$*"

if [ -z "$TEXT" ]; then
    echo "Usage: tracy <amount> <description> [at location]"
    echo "Examples:"
    echo "  tracy -30 gas"
    echo "  tracy +500 freelance"
    echo "  tracy -15 lunch at cafe"
    exit 1
fi

# Send to Tracy API
RESPONSE=$(curl -s -X POST "$TRACY_API/api/transactions" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$TEXT\", \"device_id\": \"$DEVICE_ID\", \"source\": \"spotlight\"}")

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    # Show notification
    FORMATTED=$(echo "$RESPONSE" | grep -o '"formatted":"[^"]*"' | cut -d'"' -f4)
    osascript -e "display notification \"$TEXT\" with title \"Tracy\" subtitle \"Transaction added!\""
    echo "✅ Added: $TEXT"
else
    ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    osascript -e "display notification \"$ERROR\" with title \"Tracy\" subtitle \"Error\""
    echo "❌ Error: $ERROR"
    exit 1
fi
