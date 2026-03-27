import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';

export class UIManager {
  private spinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;

  startSpinner(text: string): void {
    this.spinner = ora({
      text,
      color: 'cyan',
      spinner: 'dots',
    }).start();
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  stopSpinner(success: boolean, text?: string): void {
    if (!this.spinner) return;
    
    if (success) {
      this.spinner.succeed(text || this.spinner.text);
    } else {
      this.spinner.fail(text || this.spinner.text);
    }
    this.spinner = null;
  }

  clearSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  createProgressBar(total: number, label: string = 'Progress'): void {
    this.progressBar = new cliProgress.SingleBar({
      format: `${chalk.cyan(label)} | ${chalk.cyan('{bar}')} | {percentage}% | {value}/{total}`,
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
    console.log('\n' + chalk.bold.cyan('='.repeat(60)));
    console.log(chalk.bold.cyan(text));
    console.log(chalk.bold.cyan('='.repeat(60)) + '\n');
  }

  printSection(title: string): void {
    console.log('\n' + chalk.bold.yellow(`▶ ${title}`));
  }

  printSuccess(message: string): void {
    console.log(chalk.green('✓ ') + message);
  }

  printError(message: string): void {
    console.log(chalk.red('✗ ') + message);
  }

  printWarning(message: string): void {
    console.log(chalk.yellow('⚠ ') + message);
  }

  printInfo(message: string): void {
    console.log(chalk.blue('ℹ ') + message);
  }

  printAgent(agent: string, message: string): void {
    const agentColors: Record<string, typeof chalk> = {
      orchestrator: chalk.magenta,
      scout: chalk.cyan,
      fixer: chalk.green,
    };
    const color = agentColors[agent.toLowerCase()] || chalk.white;
    console.log(`\n${color.bold(`[${agent}]`)}\n${message}\n`);
  }

  createTable(headers: string[]): Table.Table {
    return new Table({
      head: headers.map(h => chalk.cyan.bold(h)),
      style: {
        head: [],
        border: ['grey'],
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
    console.log(chalk.dim(`Estimated cost: ${chalk.green('$' + estimatedCost.toFixed(4))} (${totalTokens.toLocaleString()} tokens)`));
  }
}

export const ui = new UIManager();
