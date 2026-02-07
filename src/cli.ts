import { VERSION, TOOL_NAME } from './config';
import type { CliCommand } from './types';

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  underline: '\x1b[4m',
};

export interface CliArgs {
  command: CliCommand;
  paths: string[];
  gateway: string;
  output: string;
  quiet: boolean;
  qr: boolean;
  useGlobalDir: boolean;
  findQuery: string;
  gatewayArgs: string[];
}

const SUBCOMMANDS = new Set(['push', 'env', 'ping', 'history', 'find', 'gateway', 'config']);

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    command: 'help',
    paths: [],
    gateway: '',
    output: '',
    quiet: false,
    qr: true, // QR codes now shown by default
    useGlobalDir: false,
    findQuery: '',
    gatewayArgs: [],
  };

  if (args.length === 0) {
    result.command = 'help';
    return result;
  }

  // Check if first arg is a subcommand
  const first = args[0];

  if (SUBCOMMANDS.has(first)) {
    result.command = first as CliCommand;

    if (first === 'push') {
      // Remaining args are paths + flags
      return parseFlags(args.slice(1), result);
    }

    if (first === 'find') {
      result.findQuery = args.slice(1).join(' ');
      return result;
    }

    if (first === 'gateway') {
      result.gatewayArgs = args.slice(1);
      return result;
    }

    // env, ping, history, config take no further args
    return result;
  }

  // Check flags first, then implicit push
  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        result.command = 'help';
        return result;

      case '-v':
      case '--version':
        result.command = 'version';
        return result;

      case '-i':
      case '--interactive':
        result.command = 'interactive';
        break;

      case '-g':
      case '--gateway':
        i++;
        result.gateway = args[i] || '';
        break;

      case '-o':
      case '--output':
        i++;
        result.output = args[i] || '';
        break;

      case '-q':
      case '--quiet':
        result.quiet = true;
        break;

      case '--qr':
        result.qr = true;
        break;

      case '--no-qr':
        result.qr = false;
        break;

      case '--use-global-dir':
        result.useGlobalDir = true;
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`${c.red}Unknown option: ${arg}${c.reset}`);
          console.error(`Run ${c.cyan}${TOOL_NAME} --help${c.reset} for usage.`);
          process.exit(1);
        }
        // Path argument — implicit push if path exists on disk
        result.paths.push(arg);
        result.command = 'push';
        break;
    }
    i++;
  }

  return result;
}

function parseFlags(args: string[], result: CliArgs): CliArgs {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '-g':
      case '--gateway':
        i++;
        result.gateway = args[i] || '';
        break;
      case '-o':
      case '--output':
        i++;
        result.output = args[i] || '';
        break;
      case '-q':
      case '--quiet':
        result.quiet = true;
        break;
      case '--qr':
        result.qr = true;
        break;
      case '--no-qr':
        result.qr = false;
        break;
      case '--use-global-dir':
        result.useGlobalDir = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          result.paths.push(arg);
        }
        break;
    }
    i++;
  }
  return result;
}

export function printVersion(): void {
  console.log(`${TOOL_NAME} ${VERSION}`);
}

export function printHelp(): void {
  const ipfsLogo = `
${c.cyan}  _____ _____  ______ _____
${c.cyan} |_   _|  __ \\|  ____/ ____|
${c.cyan}   | | | |__) | |__ | (___
${c.cyan}   | | |  ___/|  __| \\___ \\
${c.cyan}  _| |_| |    | |    ____) |
${c.cyan} |_____|_|    |_|   |_____/${c.reset}`;

  console.log(ipfsLogo);
  console.log();
  console.log(`  ${c.bold}${c.white}${TOOL_NAME}${c.reset} ${c.dim}v${VERSION}${c.reset}`);
  console.log(`  ${c.dim}Upload files and folders to IPFS with QR codes, PDF reports, and IPNS publishing${c.reset}`);
  console.log();
  console.log(`  ${c.bold}${c.yellow}USAGE${c.reset}`);
  console.log();
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}<path>${c.reset} ${c.dim}[options]${c.reset}          Push a file, folder, or zip to IPFS`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}push <path>${c.reset} ${c.dim}[options]${c.reset}     Push (explicit subcommand)`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}-i${c.reset}                        Interactive mode (TUI)`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}env${c.reset}                       Print env vars and resolved config`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}ping${c.reset}                      Test IPFS node connections`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}history${c.reset}                   List previous pushes`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}find <query>${c.reset}              Search previous pushes`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}gateway${c.reset}                   Show current gateway`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}gateway set <url>${c.reset}         Set default gateway`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ${c.cyan}config${c.reset}                    Run setup wizard`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset}                              Show this help`);
  console.log();
  console.log(`  ${c.bold}${c.yellow}OPTIONS${c.reset}`);
  console.log();
  console.log(`    ${c.green}-i, --interactive${c.reset}                 Launch interactive TUI mode`);
  console.log(`    ${c.green}-g, --gateway${c.reset} ${c.cyan}<url>${c.reset}              Public gateway ${c.dim}(default: https://ipfs.io)${c.reset}`);
  console.log(`    ${c.green}-o, --output${c.reset} ${c.cyan}<dir>${c.reset}               Output directory for logs ${c.dim}(deprecated)${c.reset}`);
  console.log(`    ${c.green}-q, --quiet${c.reset}                       Minimal output`);
  console.log(`    ${c.green}--no-qr${c.reset}                           Don't print QR codes ${c.dim}(QR codes shown by default)${c.reset}`);
  console.log(`    ${c.green}--use-global-dir${c.reset}                  Save reports to global directory instead of CWD`);
  console.log(`    ${c.green}-v, --version${c.reset}                     Show version`);
  console.log(`    ${c.green}-h, --help${c.reset}                        Show this help`);
  console.log();
  console.log(`  ${c.bold}${c.yellow}EXAMPLES${c.reset}`);
  console.log();
  console.log(`    ${c.dim}# Push a folder (QR codes shown by default, saved to current directory)${c.reset}`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ./my-project`);
  console.log();
  console.log(`    ${c.dim}# Push without QR code display${c.reset}`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ./my-project --no-qr`);
  console.log();
  console.log(`    ${c.dim}# Push a single file from any directory${c.reset}`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} /path/to/paper.pdf`);
  console.log();
  console.log(`    ${c.dim}# Push with global reports directory${c.reset}`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ./docs --use-global-dir`);
  console.log();
  console.log(`    ${c.dim}# Check node connectivity${c.reset}`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} ping`);
  console.log();
  console.log(`    ${c.dim}# Search previous pushes${c.reset}`);
  console.log(`    ${c.green}${TOOL_NAME}${c.reset} find attention`);
  console.log();
  console.log(`  ${c.bold}${c.yellow}ENVIRONMENT${c.reset}`);
  console.log();
  console.log(`    ${c.green}IPFS_NODES${c.reset}              IPFS node list ${c.dim}(name:host:ip:api:gw:ipns,...)${c.reset}`);
  console.log(`    ${c.green}IPFS_PUBLIC_GATEWAYS${c.reset}    Public gateways ${c.dim}(comma-separated URLs)${c.reset}`);
  console.log(`    ${c.green}IPFS_DEFAULT_GATEWAY${c.reset}    Default gateway URL`);
  console.log();
  console.log(`  ${c.bold}${c.yellow}DATA${c.reset}`);
  console.log();
  const stateDir = '~/.local/store/bun-ipfs/';
  const globalReportsDir = process.platform === 'darwin' ? '~/Documents/bun-ipfs/reports/' : '~/.local/store/bun-ipfs/reports/';
  console.log(`    ${c.dim}State:${c.reset}           ${stateDir}`);
  console.log(`    ${c.dim}Database:${c.reset}        ${stateDir}bun-ipfs.sqlite`);
  console.log(`    ${c.dim}Config:${c.reset}          ${stateDir}bun-ipfs.json`);
  console.log(`    ${c.dim}Reports:${c.reset}         ${c.bold}current directory${c.reset} (or ${globalReportsDir} with --use-global-dir)`);
  console.log();
}
