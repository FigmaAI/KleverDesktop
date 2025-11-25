
import { isPythonInstalled, checkVenvStatus, getPythonPath, getVenvPath } from '../main/utils/python-runtime';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

console.log('--- Python Environment Verification ---');

const kleverDir = path.join(os.homedir(), '.klever-desktop');
console.log(`Klever Dir: ${kleverDir}`);
console.log(`Exists? ${fs.existsSync(kleverDir)}`);

console.log('\n[Detection Logic]');
try {
  const pythonInstalled = isPythonInstalled();
  console.log(`isPythonInstalled(): ${pythonInstalled}`);
  
  if (pythonInstalled) {
    console.log(`Python Path: ${getPythonPath()}`);
  }
} catch (e) {
  console.log(`isPythonInstalled() threw error: ${e.message}`);
}

try {
  const venvStatus = checkVenvStatus();
  console.log(`checkVenvStatus(): valid=${venvStatus.valid}, exists=${venvStatus.exists}`);
  console.log(`Venv Path: ${getVenvPath()}`);
} catch (e) {
  console.log(`checkVenvStatus() threw error: ${e.message}`);
}

console.log('\n---------------------------------------');
console.log('If the folder ~/.klever-desktop does not exist, isPythonInstalled() MUST return false.');
console.log('If it returns false, the app will now trigger auto-download (my fix).');
