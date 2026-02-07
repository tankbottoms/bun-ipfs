import { searchPins } from '../db';
import { formatBytes } from '../zip';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

export function runFindCommand(query: string): void {
  if (!query) {
    console.log(`${c.yellow}Usage: bun-ipfs find <query>${c.reset}`);
    console.log(`${c.dim}Search by folder name, CID, or IPNS name.${c.reset}`);
    return;
  }

  const results = searchPins(query);

  if (results.length === 0) {
    console.log(`${c.dim}No results for "${query}".${c.reset}`);
    return;
  }

  console.log(`${c.bold}bun-ipfs${c.reset} find "${query}"  ${c.dim}(${results.length} match${results.length > 1 ? 'es' : ''})${c.reset}\n`);

  for (const pin of results) {
    console.log(`  ${c.bold}${pin.folder_name}${c.reset}  ${c.dim}${pin.timestamp}${c.reset}`);
    console.log(`    ${c.dim}CID${c.reset}     ${c.cyan}${pin.folder_cid}${c.reset}`);
    if (pin.zip_cid) {
      console.log(`    ${c.dim}ZIP${c.reset}     ${pin.zip_cid}`);
    }
    if (pin.ipns_name) {
      console.log(`    ${c.dim}IPNS${c.reset}    ${pin.ipns_name}`);
    }
    console.log(`    ${c.dim}URL${c.reset}     ${pin.folder_url}`);
    console.log(`    ${c.dim}Stats${c.reset}   ${pin.file_count} files, ${formatBytes(pin.folder_size)}`);
    if (pin.report_path) {
      console.log(`    ${c.dim}Report${c.reset}  ${pin.report_path}`);
    }
    console.log();
  }
}
