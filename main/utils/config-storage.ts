/** Settings storage with explicit migration to the native testing schema. */
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, normalizeAppConfig } from '../types/config';
import { getKleverDir } from './app-paths';

export function getConfigJsonPath(): string {
  return path.join(getKleverDir(), 'config.json');
}

export function loadAppConfig(): AppConfig {
  const configPath = getConfigJsonPath();
  if (!fs.existsSync(configPath)) return normalizeAppConfig(undefined);
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = normalizeAppConfig(raw);
  if (JSON.stringify(raw) !== JSON.stringify(config)) saveAppConfig(config);
  return config;
}

export function saveAppConfig(config: AppConfig): void {
  const configPath = getConfigJsonPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temporaryPath = `${configPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(normalizeAppConfig(config), null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, configPath);
}
