import * as readline from 'node:readline';
import { Command } from 'commander';
import { listSites } from '../../services/searchconsole.service.js';
import { resolveGlobalOptions } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { createSpinner } from '../../utils/spinner.js';

// The REPL is a reference card + lightweight navigator. Search Console's surface is small
// (six dimensions, six search types, six filter operators, no custom fields), so the bulk
// of value is making those discoverable without leaving the terminal.

const DIMENSIONS = [
  { name: 'query', desc: 'The search query string the user typed' },
  { name: 'page', desc: 'The landing page URL the user clicked' },
  { name: 'country', desc: 'ISO-3166-1 alpha-3 country code (USA, GBR, FRA, ...)' },
  { name: 'device', desc: 'Device type: DESKTOP, MOBILE, TABLET' },
  { name: 'date', desc: 'Date the impression/click occurred (YYYY-MM-DD)' },
  { name: 'searchAppearance', desc: 'Special features: AMP, web-light, rich-result types, etc.' },
];

const SEARCH_TYPES = [
  { name: 'web', desc: 'Standard Google web search (default)' },
  { name: 'image', desc: 'Google Images' },
  { name: 'video', desc: 'Video search' },
  { name: 'news', desc: 'News tab' },
  { name: 'discover', desc: 'Discover feed' },
  { name: 'googleNews', desc: 'Google News (news.google.com)' },
];

const OPERATORS = [
  { shorthand: '==', gsc: 'equals', desc: 'Exact match' },
  { shorthand: '!=', gsc: 'notEquals', desc: 'Not equal' },
  { shorthand: '~=', gsc: 'contains', desc: 'Substring match' },
  { shorthand: '!~=', gsc: 'notContains', desc: 'Substring not present' },
  { shorthand: '=~', gsc: 'includingRegex', desc: 'Regex match (Google RE2 syntax)' },
  { shorthand: '!~', gsc: 'excludingRegex', desc: 'Regex not match' },
];

const HELP = [
  'Commands:',
  '  dimensions                 List available dimensions',
  '  types                      List available search types',
  '  operators                  List filter operators (shorthand → GSC operator)',
  '  sites                      List sites you have access to (live API call)',
  '  show <dimension>           Show description of a single dimension',
  '  help                       Show this help',
  '  exit | quit | .exit        Leave the REPL',
  '',
  'Tab-completion is available for `show <dimension>`.',
].join('\n');

function printDimensions(): void {
  for (const d of DIMENSIONS) {
    console.log(`${d.name.padEnd(20)} ${d.desc}`);
  }
  console.log(`\n${DIMENSIONS.length} dimension(s)`);
}

function printSearchTypes(): void {
  for (const t of SEARCH_TYPES) {
    console.log(`${t.name.padEnd(15)} ${t.desc}`);
  }
}

function printOperators(): void {
  for (const o of OPERATORS) {
    console.log(`${o.shorthand.padEnd(5)}  →  ${o.gsc.padEnd(15)}  ${o.desc}`);
  }
}

export function createExploreCommand(): Command {
  return new Command('explore')
    .description('Interactive REPL to browse Search Console dimensions, search types, and operators')
    .action(async (_opts, command) => {
      try {
        resolveGlobalOptions(command);

        logger.success(
          `Loaded ${DIMENSIONS.length} dimensions, ${SEARCH_TYPES.length} search types, ` +
            `${OPERATORS.length} operators. Type \`help\` for commands, \`exit\` to quit.`,
        );

        const dimensionNames = DIMENSIONS.map((d) => d.name);

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: process.stdout.isTTY,
          completer: (line: string) => {
            const m = line.match(/^show\s+(\S*)$/);
            if (!m) return [[], line];
            const prefix = m[1];
            const hits = dimensionNames.filter((n) => n.startsWith(prefix));
            return [hits, prefix];
          },
        });
        rl.setPrompt('gsccli> ');
        rl.prompt();

        rl.on('line', async (raw) => {
          const line = raw.trim();
          if (!line) {
            rl.prompt();
            return;
          }
          const [cmd, ...rest] = line.split(/\s+/);

          if (cmd === 'exit' || cmd === 'quit' || cmd === '.exit') {
            rl.close();
            return;
          }

          if (cmd === 'help') {
            console.log(HELP);
          } else if (cmd === 'dimensions') {
            printDimensions();
          } else if (cmd === 'types') {
            printSearchTypes();
          } else if (cmd === 'operators') {
            printOperators();
          } else if (cmd === 'sites') {
            const spinner = createSpinner('Loading sites...');
            spinner.start();
            try {
              const sites = await listSites();
              spinner.stop();
              for (const s of sites) {
                console.log(`${s.permissionLevel.padEnd(20)} ${s.siteUrl}`);
              }
              console.log(`\n${sites.length} site(s)`);
            } catch (err) {
              spinner.stop();
              console.log(`Failed: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else if (cmd === 'show') {
            const name = rest[0];
            if (!name) {
              console.log('Usage: show <dimension>');
            } else {
              const found = DIMENSIONS.find((d) => d.name === name);
              if (!found) console.log(`No dimension named "${name}". Try \`dimensions\`.`);
              else console.log(`${found.name}\n  ${found.desc}`);
            }
          } else {
            console.log(`Unknown command: ${cmd}. Type \`help\`.`);
          }

          rl.prompt();
        });

        await new Promise<void>((resolve) => {
          rl.on('close', () => resolve());
        });
      } catch (error) {
        handleError(error);
      }
    });
}
