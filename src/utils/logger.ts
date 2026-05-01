import chalk from 'chalk';

class Logger {
  private verbose = false;
  private colorEnabled = true;

  setVerbose(v: boolean): void {
    this.verbose = v;
  }

  setNoColor(noColor: boolean): void {
    this.colorEnabled = !noColor;
  }

  private c(fn: (s: string) => string, text: string): string {
    return this.colorEnabled ? fn(text) : text;
  }

  info(msg: string): void {
    console.error(`${this.c(chalk.blue, 'ℹ')} ${msg}`);
  }

  success(msg: string): void {
    console.error(`${this.c(chalk.green, '✔')} ${msg}`);
  }

  warn(msg: string): void {
    console.error(`${this.c(chalk.yellow, '⚠')} ${msg}`);
  }

  error(msg: string): void {
    console.error(`${this.c(chalk.red, '✖')} ${msg}`);
  }

  debug(msg: string): void {
    if (this.verbose) {
      console.error(`${this.c(chalk.gray, '⬡')} ${msg}`);
    }
  }
}

export const logger = new Logger();
