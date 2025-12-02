-- Tracy Alfred Workflow Script
-- Trigger with: tracy -30 gas
-- This sends the transaction to Tracy backend

on run argv
    set queryText to item 1 of argv
    
    -- Get device ID
    set deviceIdFile to (POSIX path of (path to home folder)) & ".tracy_device_id"
    try
        set deviceId to do shell script "cat " & quoted form of deviceIdFile
    on error
        set deviceId to do shell script "uuidgen | tr '[:upper:]' '[:lower:]'"
        do shell script "echo " & quoted form of deviceId & " > " & quoted form of deviceIdFile
    end try
    
    -- Build JSON payload
    set jsonPayload to "{\"text\": \"" & queryText & "\", \"device_id\": \"" & deviceId & "\", \"source\": \"spotlight\"}"
    
    -- Send to API
    try
        set response to do shell script "curl -s -X POST 'http://localhost:3847/api/transactions' -H 'Content-Type: application/json' -d " & quoted form of jsonPayload
        
        if response contains "\"success\":true" then
            display notification queryText with title "Tracy" subtitle "Transaction added!"
            return "✅ Added: " & queryText
        else
            display notification "Could not add transaction" with title "Tracy" subtitle "Error"
            return "❌ Error adding transaction"
        end if
    on error errMsg
        display notification "Backend not running" with title "Tracy" subtitle "Error"
        return "❌ Tracy backend not running. Start it with: cd backend && npm run dev"
    end try
end run
