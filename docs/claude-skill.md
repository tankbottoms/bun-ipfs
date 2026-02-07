# Claude Code Skill: IPFS Push

Use this skill to push files or folders to IPFS directly from Claude Code.

## Skill Definition

Add this to your Claude Code plugin or `.claude/skills/` directory:

```yaml
name: ipfs-push
description: Push files or folders to IPFS with QR codes, PDF reports, and IPNS publishing. Use when the user says "push to ipfs", "upload to ipfs", "use the ipfs push skill", or wants to publish content to the distributed web.
```

## Usage

Say any of these to invoke the skill:

- "use the ipfs push skill"
- "push this folder to ipfs"
- "upload to ipfs"
- "publish to ipfs"

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `path` | Yes | File or folder to upload. Must contain a README.md for folder uploads. |
| `gateway` | No | Public gateway URL. Default: `https://ipfs.io` |
| `ipns` | No | IPNS key name or reference. Default: auto-generated from folder name (`push-<name>`) |

## Skill Prompt

```
You are the IPFS Push skill. When invoked, execute the bun-ipfs CLI tool to upload content to IPFS.

## Steps

1. Verify the target path exists and contains files
2. If the path is a folder, verify it contains a README.md (warn if missing)
3. Run the bun-ipfs tool:
   ```bash
   bun run /path/to/bun-ipfs/src/index.ts <path> -g <gateway> --qr
   ```
4. Parse the output and report:
   - Content CID (the immutable hash)
   - IPNS name (if published)
   - Gateway URLs for access
   - Location of generated PDF report and QR codes

## Default Behavior

- Gateway: https://ipfs.io (or IPFS_DEFAULT_GATEWAY from env)
- IPNS key: auto-generated as `push-<folder-name>`
- PDF report: ~/.local/state/bun-ipfs/reports/
- Push history: stored in SQLite database
- The folder's content hash (CID) serves as the unique identifier

## Environment Requirements

- IPFS_NODES must be configured (in .env, bun-ipfs.json, or run `bun-ipfs config`)
- At least one IPFS node must be reachable
- Bun runtime must be installed

## Example Invocations

User: "push the docs folder to ipfs"
Action: bun run src/index.ts ./docs --qr

User: "upload paper.pdf to ipfs using dweb.link"
Action: bun run src/index.ts paper.pdf -g https://dweb.link --qr

User: "push ./research to ipfs"
Action: bun run src/index.ts ./research --qr
```

## Installation

1. Clone the bun-ipfs repository
2. Run `bun install`
3. Configure: `bun run dev config` or copy `.env.sample` to `.env`
4. Add the skill definition to your Claude Code configuration

## Integration

The skill outputs a JSON report to `~/.local/state/bun-ipfs/reports/` and records all pushes in a SQLite database. Use `bun-ipfs history` or `bun-ipfs find <query>` to retrieve previous pushes.

```json
{
  "timestamp": "2026-02-04T18:30:45.000Z",
  "folderName": "my-project",
  "cids": {
    "folder": "bafybeig...",
    "zip": "bafybeih..."
  },
  "urls": {
    "ipfs": "https://ipfs.io/ipfs/bafybeig.../",
    "ipns": "https://ipfs.io/ipns/k51qzi5..."
  }
}
```
