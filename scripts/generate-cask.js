/**
 * Generate Homebrew Cask script
 * Calculates SHA256 of the built DMG and generates a klever-desktop.rb file
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const packageJson = require('../package.json');

const OUT_DIR = path.join(__dirname, '../out/make');

function findDmgFile() {
  if (!fs.existsSync(OUT_DIR)) return null;

  // Search recursively for .dmg file
  // out/make/<driver>/<platform>/<arch>/Klever Desktop-x.x.x.dmg
  const files = [];
  
  function scan(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (entry.endsWith('.dmg') && !entry.includes('blockmap')) {
        files.push(fullPath);
      }
    }
  }

  scan(OUT_DIR);
  return files.length > 0 ? files[0] : null;
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function generateCask(version, sha256, filename) {
  const caskContent = `cask "klever-desktop" do
  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/FigmaAI/KleverDesktop/releases/download/v#{version}/${filename}"
  name "Klever Desktop"
  desc "${packageJson.description}"
  homepage "https://github.com/FigmaAI/KleverDesktop"

  app "Klever Desktop.app"

  zap trash: [
    "~/Library/Application Support/klever-desktop",
    "~/Library/Preferences/com.klever.desktop.plist",
    "~/Library/Saved Application State/com.klever.desktop.savedState",
    "~/Documents/KleverWorkspace"
  ]
end
`;
  return caskContent;
}

function main() {
  console.log('🍺 Generating Homebrew Cask...');
  
  const dmgPath = findDmgFile();
  if (!dmgPath) {
    console.error('❌ DMG file not found. Please run "npm run make" first.');
    process.exit(1);
  }

  console.log(`✓ Found DMG: ${dmgPath}`);
  const sha256 = calculateSha256(dmgPath);
  console.log(`✓ SHA256: ${sha256}`);

  const version = packageJson.version;
  const filename = path.basename(dmgPath);
  
  const caskContent = generateCask(version, sha256, filename);
  const caskPath = path.join(__dirname, '../klever-desktop.rb');
  
  fs.writeFileSync(caskPath, caskContent);
  console.log(`✅ Cask file generated at: ${caskPath}`);
}

main();

