# Tracy Scripts & Integrations

## Quick CLI Access

### Installation

```bash
# Install the tracy command
./install-cli.sh

# Or manually:
chmod +x tracy-cli.sh
sudo ln -s $(pwd)/tracy-cli.sh /usr/local/bin/tracy
```

### Usage

```bash
tracy -30 gas
tracy +500 salary
tracy -15 lunch at cafe
tracy -25, groceries, Lidl
```

## Alfred Workflow

1. Open Alfred Preferences → Workflows
2. Create new workflow
3. Add "Keyword" trigger: `tracy`
4. Add "Run Script" action with the content from `alfred-tracy.applescript`
5. Type `tracy -30 gas` in Alfred

## Raycast Extension

Coming soon! For now, use the CLI with a Raycast script command.

## Requirements

- Tracy backend must be running: `cd backend && npm run dev`
- First transaction will create your device ID in `~/.tracy_device_id`
