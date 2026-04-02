import chalk from 'chalk';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import inquirer from 'inquirer';

// Initialize marked with terminal renderer for premium markdown output
marked.setOptions({
  renderer: new (TerminalRenderer as any)({
    code: chalk.yellow,
    blockquote: chalk.italic.dim,
    html: chalk.gray,
    heading: chalk.bold.cyan,
    firstHeading: chalk.bold.cyan.underline,
    hr: chalk.dim('─'.repeat(40)),
    listitem: chalk.white,
    table: chalk.reset,
    paragraph: chalk.white,
    strong: chalk.bold.magenta,
    em: chalk.italic,
    codespan: chalk.bgGray.white.bold,
    del: chalk.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  }),
});

export class UIManager {
  private progressBar: cliProgress.SingleBar | null = null;

  startSpinner(text: string): void {
    console.log(chalk.blue(`◈ [STATUS] ${text}`));
  }

  updateSpinner(text: string): void {
    console.log(chalk.blue(`◈ [UPDATE] ${text}`));
  }

  stopSpinner(success: boolean, text?: string): void {
    if (success) {
      console.log(chalk.green(`◈ [DONE] ${text || "Process completed."}`));
    } else {
      console.log(chalk.red(`◈ [FAIL] ${text || "Process failed."}`));
    }
  }

  clearSpinner(): void {
    // No-op for console logging
  }

  createProgressBar(total: number, label: string = 'Progress'): void {
    this.progressBar = new cliProgress.SingleBar({
      format: `${chalk.blue(label)} | ${chalk.blue('{bar}')} | {percentage}% | {value}/{total}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });
    this.progressBar.start(total, 0);
  }

  updateProgress(value: number): void {
    if (this.progressBar) {
      this.progressBar.update(value);
    }
  }

  stopProgress(): void {
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }
  }

  printHeader(text: string): void {
    console.log('\n' + chalk.bold.blue('╭' + '─'.repeat(58) + '╮'));
    const padding = Math.max(0, Math.floor((58 - text.length) / 2));
    const leftPad = ' '.repeat(padding);
    const rightPad = ' '.repeat(58 - text.length - padding);
    console.log(chalk.bold.blue('│' + leftPad + chalk.white(text) + rightPad + '│'));
    console.log(chalk.bold.blue('╰' + '─'.repeat(58) + '╯') + '\n');
  }

  printSection(title: string): void {
    console.log('\n' + chalk.bold.cyan(`◈ ${title}`));
    console.log(chalk.dim('─'.repeat(title.length + 2)));
  }

  printSuccess(message: string): void {
    console.log(chalk.green('✔ ') + message);
  }

  printError(message: string): void {
    console.log(chalk.red('✘ ') + message);
  }

  printWarning(message: string): void {
    console.log(chalk.yellow('⚠ ') + message);
  }

  printInfo(message: string): void {
    console.log(chalk.blue('ℹ ') + message);
  }

  /**
   * Renders a markdown block to the terminal.
   */
  printMarkdown(md: string): void {
    console.log((marked.parse(md) as string).trim());
  }

  /**
   * Handles streaming text from the AI.
   * Prints chunks immediately, and handles line breaks.
   */
  printStreamChunk(chunk: string): void {
    process.stdout.write(chunk);
  }

  /**
   * Finalizes a stream by adding a newline.
   */
  endStream(): void {
    process.stdout.write('\n');
  }

  /**
   * Clears the last N lines in the terminal.
   */
  clearLastLines(count: number): void {
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
       // Move cursor up and clear line
      process.stdout.write('\u001b[1A\u001b[2K');
    }
  }

  /**
   * Calculates the number of terminal lines occupied by a given text.
   */
  calculateLineCount(text: string): number {
    const columns = process.stdout.columns || 80;
    const lines = text.split('\n');
    let count = 0;
    for (const line of lines) {
      count += Math.max(1, Math.ceil(line.length / columns));
    }
    return count;
  }

  /**
   * Finalizes a block of streamed text by re-rendering it as markdown.
   */
  finalizeMarkdown(text: string): void {
    if (!text.trim()) return;
    const linesToClear = this.calculateLineCount(text);
    this.clearLastLines(linesToClear);
    this.printMarkdown(text);
    console.log('');
  }

  /**
   * Prints only the agent's header, useful before starting a stream.
   */
  printAgentHeader(agent: string): void {
    const agentColors: Record<string, typeof chalk> = {
      orchestrator: chalk.blue,
      scout: chalk.cyan,
      fixer: chalk.magenta,
      system: chalk.gray,
    };
    const color = agentColors[agent.toLowerCase()] || chalk.white;
    console.log(`\n${color.bold(`[${agent.toUpperCase()}]`)}`);
  }

  printAgent(agent: string, message: string): void {
    if (!message) return; // Use printAgentHeader for empty start
    
    this.printAgentHeader(agent);
    this.printMarkdown(message);
    console.log('');
  }

  async askConfirmation(prompt: string): Promise<boolean> {
    if (process.env.HEADLESS === "true") {
      console.log(`${chalk.yellow("◈ [HEADLESS]")} ${prompt} (Auto-Approved)`);
      return true;
    }
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: prompt,
        default: true,
      },
    ]);
    return confirmed;
  }

  createTable(headers: string[]): Table.Table {
    return new Table({
      head: headers.map(h => chalk.blue.bold(h)),
      style: {
        head: [],
        border: ['blue'],
      },
      wordWrap: true,
    });
  }

  printTable(table: Table.Table): void {
    console.log(table.toString());
  }

  printUsageStats(stats: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    const table = this.createTable(['Metric', 'Value']);
    table.push(
      ['Prompt Tokens', chalk.yellow(stats.promptTokens.toLocaleString())],
      ['Completion Tokens', chalk.yellow(stats.completionTokens.toLocaleString())],
      ['Total Tokens', chalk.bold.green(stats.totalTokens.toLocaleString())]
    );
    
    console.log('\n' + chalk.bold('Session Token Usage:'));
    this.printTable(table);
  }

  printCostEstimate(totalTokens: number, estimatedCost: number): void {
    console.log(chalk.dim(`Estimated cost: ${chalk.green('$' + estimatedCost.toFixed(6))} (${totalTokens.toLocaleString()} tokens)`));
  }
}

export const ui = new UIManager();
