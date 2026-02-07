# bun-ipfs Quick Command Reference

## Installation

```bash
# Build the binary
bun run build

# Install globally (recommended)
sudo cp bun-ipfs /usr/local/bin/
sudo chmod +x /usr/local/bin/bun-ipfs

# Verify
bun-ipfs --version
```

## Basic Usage

```bash
# Push a folder (QR codes shown by default, saves to current directory)
bun-ipfs ./my-folder

# Push without QR codes
bun-ipfs ./my-folder --no-qr

# Push with reports saved to global directory
bun-ipfs ./my-folder --use-global-dir

# Push from anywhere with absolute path
cd ~/Documents
bun-ipfs /path/to/any/folder

# Push a single file
bun-ipfs /path/to/file.pdf
```

## Testing Commands

```bash
# Test node connectivity
bun-ipfs ping

# View history
bun-ipfs history

# Search history
bun-ipfs find attention

# Show environment
bun-ipfs env

# Run full test suite
bash scripts/test-upload.sh
```

## Where Are Files Saved?

### State Directory (Always)
- Location: `~/.local/store/bun-ipfs/`
- Contains: database, config
- Shown after each operation

### Reports (Default)
- Location: **Current working directory**
- Files created:
  - `<name>-report.json`
  - `YYYYMMDD-ipfs-ipns-<name>.pinned.pdf`

### Reports (With --use-global-dir)
- macOS: `~/Documents/bun-ipfs/reports/`
- Linux: `~/.local/store/bun-ipfs/reports/`

## Key Changes

1. **QR codes shown by default** (use `--no-qr` to disable)
2. **Reports save to current directory** (use `--use-global-dir` for centralized storage)
3. **Works from any directory** with any path
4. **State directory location shown** after each operation

## Examples

```bash
# Example 1: Push project documentation
cd ~/Projects/my-app
bun-ipfs ./docs
# Reports saved to ~/Projects/my-app/

# Example 2: Push from anywhere
cd ~
bun-ipfs /var/www/html/website
# Reports saved to ~/

# Example 3: Centralized reports
cd /tmp
bun-ipfs ./data --use-global-dir
# Reports saved to ~/Documents/bun-ipfs/reports/

# Example 4: Quiet mode for scripts
bun-ipfs ./backup -q --no-qr
```

## GitHub

Repository is ready for GitHub with:
- Updated README.md
- Comprehensive USAGE.md
- .gitignore configured
- Test suite updated
- All documentation current
