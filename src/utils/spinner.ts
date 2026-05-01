import ora, { type Ora } from 'ora';

export function createSpinner(text: string): Ora {
  return ora({ text, spinner: 'dots' });
}
