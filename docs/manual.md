# bun-ipfs Manual

## Overview

`bun-ipfs` is a command-line tool for uploading files and folders to IPFS (InterPlanetary File System). It handles the complete workflow: uploading content, creating zip archives, pinning across multiple nodes, publishing to IPNS for persistent naming, generating QR codes, producing PDF reports, and logging all pushes to a SQLite database.

## Modes of Operation

### CLI Mode (Direct Push)

Pass a file, folder, or zip archive directly:

```bash
bun-ipfs ./my-folder
bun-ipfs document.pdf
bun-ipfs archive.zip
bun-ipfs ./folder1 ./folder2 file.pdf
```

### Interactive TUI Mode

Launch the interactive terminal interface with folder selection, gateway picker, and confirmation prompts:

```bash
bun-ipfs -i
```

In interactive mode, the tool scans the `upload/` directory for subfolders and presents a multi-select interface.

### Subcommands

```bash
bun-ipfs env                    Print environment and config values
bun-ipfs ping                   Test IPFS node connectivity
bun-ipfs history                List previous pushes from database
bun-ipfs find <query>           Search pushes by name, CID, or IPNS name
bun-ipfs gateway                Show current default gateway
bun-ipfs gateway set <url>      Set default gateway
bun-ipfs config                 Run interactive setup wizard
```

## What Happens During an Upload

1. **Connection** - The tool tries each configured IPFS node (hostname first, then IP fallback) until one responds
2. **Zip Creation** - A zip archive of the folder is created
3. **Folder Upload** - All files are uploaded preserving directory structure, returning a root CID
4. **Zip Upload** - The zip archive is uploaded as a single file with its own CID
5. **Multi-Node Pinning** - Content is pinned on the primary node, then best-effort pinned on all other reachable nodes
6. **IPNS Publishing** - An IPNS key is created (if needed) and the CID is published for persistent naming
7. **QR Code Generation** - QR codes are generated as in-memory buffers
8. **PDF Report** - A PDF report with embedded QR codes is written to the reports directory
9. **Database Insert** - Push metadata is recorded in the SQLite database
10. **Terminal QR** - If `--qr` flag is set, QR codes are displayed in the terminal

## Data Storage

State and reports are stored separately:

```
~/.local/store/bun-ipfs/                  State directory (all platforms)
  bun-ipfs.sqlite                         SQLite database
  bun-ipfs.json                           Config from setup wizard
  .env                                    Optional env overrides
  imgcat                                  iTerm2 imgcat (if available)

~/Documents/bun-ipfs/reports/             Reports directory (macOS default)
  YYYYMMDD-ipfs-ipns-<name>.pinned.pdf    PDF reports
  <name>-report.json                      JSON reports
```

On first run, the tool prompts for a reports directory.

## Configuration

### Setup Wizard

Run `bun-ipfs config` to interactively configure IPFS nodes and gateways. The wizard writes to `bun-ipfs.json` and the SQLite config table.

### Config Resolution Order

1. CLI flags (`--gateway`, etc.)
2. Environment variables
3. `.env` in CWD (repo-mode, loaded by Bun runtime)
4. `~/.local/store/bun-ipfs/.env`
5. `~/.local/store/bun-ipfs/bun-ipfs.json`
6. SQLite `config` table
7. Built-in defaults

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IPFS_NODES` | Node list (see format below) | `local:localhost:127.0.0.1:5001:8080:false` |
| `IPFS_PUBLIC_GATEWAYS` | Comma-separated gateway URLs | `https://ipfs.io,https://dweb.link` |
| `IPFS_DEFAULT_GATEWAY` | Default gateway for CLI mode | `https://ipfs.io` |

### IPFS_NODES Format

Comma-separated entries, each with colon-separated fields:

```
name:hostname:ip:apiPort:gatewayPort:hasIpnsKeys
```

Example:

```
node1:node1.local:10.0.1.10:5001:8080:true,local:localhost:127.0.0.1:5001:8080:false
```

## IPFS Node Requirements

The tool connects to IPFS nodes via the HTTP API (default port 5001). The node must support:

- `/api/v0/id` - Node identification
- `/api/v0/add` - File upload
- `/api/v0/pin/add` - Content pinning
- `/api/v0/key/list` and `/api/v0/key/gen` - IPNS key management
- `/api/v0/name/publish` - IPNS publishing

This is the standard Kubo (go-ipfs) API.

## Building a Single Executable

```bash
# For the current platform
bun run build

# macOS ARM64 (build + install + alias)
bun run build:macos

# For Linux x64
bun run build:linux
```

The resulting binary is a standalone executable with the Bun runtime embedded. No installation required on the target machine.

## PDF Reports

PDF reports are generated automatically using `pdf-lib` (pure JavaScript, no native dependencies). Each push creates a PDF in the `reports/` subdirectory of the data directory containing:

- Summary table (files, sizes, server, gateway)
- Content identifiers (folder CID, zip CID)
- IPNS details (key name, IPNS name)
- All URLs (IPFS, IPNS, gateway links)
- Embedded QR code PNGs
