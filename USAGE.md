# bun-ipfs Usage Guide

## Quick Reference

The program now works from any directory and saves reports to the current working directory by default.

### State Storage

- **State directory**: `~/.local/store/bun-ipfs/`
  - Database: `bun-ipfs.sqlite`
  - Config: `bun-ipfs.json`
  - Displayed after each operation

### Report Storage

- **Default**: Current working directory (where you run the command)
- **With `--use-global-dir`**:
  - macOS: `~/Documents/bun-ipfs/reports/`
  - Linux: `~/.local/store/bun-ipfs/reports/`

### QR Codes

- **Default**: Shown in terminal automatically
- **Disable**: Use `--no-qr` flag

---

## Installation Commands

### Development Mode (No Installation)

```bash
cd /Users/mark.phillips/Developer/bun-ipfs

# Use directly from project
bun run dev <path>
```

### Local Installation (Current User)

```bash
cd /Users/mark.phillips/Developer/bun-ipfs

# Build the binary
bun run build

# Install to user bin directory
mkdir -p ~/bin
cp bun-ipfs ~/bin/
chmod +x ~/bin/bun-ipfs

# Add to PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$HOME/bin:$PATH"

# Reload shell
source ~/.zshrc  # or source ~/.bashrc
```

### Global Installation (All Users)

```bash
cd /Users/mark.phillips/Developer/bun-ipfs

# Build the binary
bun run build

# Install globally (requires sudo)
sudo cp bun-ipfs /usr/local/bin/
sudo chmod +x /usr/local/bin/bun-ipfs

# Verify installation
bun-ipfs --version
```

### macOS Automated Installation

```bash
cd /Users/mark.phillips/Developer/bun-ipfs

# Build and install in one command
bun run build:macos
```

---

## Testing Commands

### Basic Tests

```bash
# Test help output
bun-ipfs --help

# Test node connectivity
bun-ipfs ping

# Test version
bun-ipfs --version

# Test environment
bun-ipfs env
```

### Upload Tests

```bash
# Test from project directory
cd /Users/mark.phillips/Developer/bun-ipfs
bun-ipfs ./upload/attention
# Reports saved to: /Users/mark.phillips/Developer/bun-ipfs/

# Test from different directory with absolute path
cd ~/Documents
bun-ipfs /Users/mark.phillips/Developer/bun-ipfs/upload/attention
# Reports saved to: ~/Documents/

# Test with relative path
cd ~/Desktop
bun-ipfs ../Documents/some-folder
# Reports saved to: ~/Desktop/

# Test without QR codes
bun-ipfs ./my-folder --no-qr

# Test with global directory
bun-ipfs ./my-folder --use-global-dir
# Reports saved to: ~/Documents/bun-ipfs/reports/

# Test quiet mode
bun-ipfs ./my-folder -q

# Test quiet without QR
bun-ipfs ./my-folder -q --no-qr
```

### History Tests

```bash
# View all previous pushes
bun-ipfs history

# Search for specific push
bun-ipfs find attention

# Show current gateway
bun-ipfs gateway

# Set gateway
bun-ipfs gateway set https://dweb.link
```

### Integration Test Suite

```bash
cd /Users/mark.phillips/Developer/bun-ipfs

# Run the full test suite
bash scripts/test-upload.sh
```

---

## Real-World Usage Examples

### Example 1: Push Project Documentation

```bash
cd ~/Projects/my-app
bun-ipfs ./docs

# Results:
# - Creates: docs-report.json (in ~/Projects/my-app/)
# - Creates: 20260207-ipfs-ipns-docs.pinned.pdf (in ~/Projects/my-app/)
# - Shows: QR codes in terminal
# - Shows: State directory message
```

### Example 2: Push From Anywhere

```bash
cd ~
bun-ipfs /var/www/html/website

# Results:
# - Creates: website-report.json (in ~/)
# - Creates: 20260207-ipfs-ipns-website.pinned.pdf (in ~/)
# - Zips and uploads: /var/www/html/website/
```

### Example 3: Centralized Reports

```bash
cd /tmp
bun-ipfs ./temp-data --use-global-dir

# Results:
# - Creates: temp-data-report.json (in ~/Documents/bun-ipfs/reports/)
# - Creates: 20260207-ipfs-ipns-temp-data.pinned.pdf (in ~/Documents/bun-ipfs/reports/)
# - Original data: stays in /tmp/temp-data/
```

### Example 4: Scripting (Quiet Mode)

```bash
#!/usr/bin/env bash

# Upload and capture CID
cd /data/backups
bun-ipfs ./backup-2026-02-07 -q --no-qr > upload.log

# Parse the JSON report
CID=$(jq -r '.cids.folder' backup-2026-02-07-report.json)
echo "Backup CID: $CID"

# Store CID for later
echo "$CID" > latest-backup-cid.txt
```

### Example 5: Multiple Uploads

```bash
cd ~/Documents

# Upload multiple folders
for dir in project1 project2 project3; do
  bun-ipfs "./$dir" --no-qr
done

# All reports saved to ~/Documents/
ls -lh *-report.json
ls -lh 2026*-ipfs-ipns-*.pinned.pdf
```

---

## Cleanup Commands

### Remove Test Files

```bash
# Remove reports from current directory
rm -f *-report.json
rm -f 2026*-ipfs-ipns-*.pinned.pdf

# Remove generated zips
rm -f *.zip
```

### Reset State (Nuclear Option)

```bash
# Remove all state and history
rm -rf ~/.local/store/bun-ipfs/

# Remove global reports directory
rm -rf ~/Documents/bun-ipfs/
```

---

## Configuration

### First Run

On first run, the tool creates the state directory and displays:

```
State directory: /Users/mark.phillips/.local/store/bun-ipfs
Reports will be saved to current directory by default
Use --use-global-dir to save to: ~/Documents/bun-ipfs/reports/
```

### Manual Configuration

```bash
# Run the interactive setup wizard
bun-ipfs config
```

### Environment Variables

Create a `.env` file or export:

```bash
export IPFS_NODES="local:localhost:127.0.0.1:5001:8080:false"
export IPFS_DEFAULT_GATEWAY="https://ipfs.io"
export IPFS_PUBLIC_GATEWAYS="https://ipfs.io,https://dweb.link"
```

---

## Troubleshooting

### Binary Won't Execute

```bash
# Ensure it has execute permissions
chmod +x /usr/local/bin/bun-ipfs

# Verify it's in PATH
which bun-ipfs

# Test directly
/usr/local/bin/bun-ipfs --version
```

### No IPFS Nodes Available

```bash
# Check node connectivity
bun-ipfs ping

# Start local IPFS daemon
ipfs daemon

# Or start Docker container
docker start ipfs
```

### Reports Not Created

```bash
# Check current directory is writable
pwd
touch test.txt
rm test.txt

# Check disk space
df -h .

# Try with --use-global-dir
bun-ipfs ./my-folder --use-global-dir
```

### Permission Denied

```bash
# If you get permission errors, ensure the binary is executable
ls -la $(which bun-ipfs)

# Re-install if needed
cd /Users/mark.phillips/Developer/bun-ipfs
bun run build
sudo cp bun-ipfs /usr/local/bin/
sudo chmod +x /usr/local/bin/bun-ipfs
```

---

## SSH/Remote Usage

### Upload from Remote Host

```bash
# SSH to remote machine
ssh user@remote-host

# Upload directly on remote
bun-ipfs /var/data/important-files --no-qr -q

# Download the report
exit
scp user@remote-host:/var/data/important-files-report.json ./
```

### Install on Remote Host

```bash
# Build Linux binary locally
cd /Users/mark.phillips/Developer/bun-ipfs
bun run build:linux

# Copy to remote host
scp bun-ipfs-linux user@remote-host:~/bun-ipfs
ssh user@remote-host "chmod +x ~/bun-ipfs && sudo mv ~/bun-ipfs /usr/local/bin/"

# Use on remote
ssh user@remote-host "bun-ipfs --version"
```

---

## Advanced Usage

### Custom Gateway

```bash
bun-ipfs ./docs -g https://gateway.pinata.cloud
```

### Batch Processing

```bash
#!/usr/bin/env bash
find ~/Documents -maxdepth 1 -type d | while read dir; do
  [ -d "$dir" ] && bun-ipfs "$dir" --no-qr -q
done
```

### Automated Backups

```bash
#!/usr/bin/env bash
# Add to cron: 0 2 * * * /path/to/backup-to-ipfs.sh

BACKUP_DIR="/data/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Create backup
tar czf "$BACKUP_DIR/backup.tar.gz" /important/data

# Upload to IPFS
cd "$BACKUP_DIR"
bun-ipfs . --use-global-dir -q --no-qr

# Email the report
mail -s "Backup Report $(date +%Y-%m-%d)" admin@example.com < backup-report.json
```

---

## Summary of Changes

### What Changed

1. **Default Behavior**: Reports now save to current working directory (not global directory)
2. **QR Codes**: Shown by default (use `--no-qr` to disable)
3. **State Directory**: Always displayed after operations
4. **Works Anywhere**: Can be run from any directory with any path

### Migration Guide

If you were using the old version:

```bash
# Old way (still works)
bun-ipfs ./folder --qr

# New way (QR codes automatic)
bun-ipfs ./folder

# To get old behavior (centralized reports)
bun-ipfs ./folder --use-global-dir
```

### Backward Compatibility

- All old flags still work
- `--qr` flag is now redundant (but won't break anything)
- `-o` flag is deprecated but won't error
- Global directory still accessible with `--use-global-dir`
