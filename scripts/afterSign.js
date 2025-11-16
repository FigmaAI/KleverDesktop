const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * After-sign hook for electron-builder
 * Re-signs bundled Python runtime and all native libraries
 *
 * This is critical for Mac App Store distribution because:
 * 1. All executables must be signed with the same certificate
 * 2. Python .so/.dylib files need proper code signatures
 * 3. App Store validation will reject unsigned binaries
 */
exports.default = async function(context) {
  console.log('\n🔐 Starting post-build code signing...\n');

  const appPath = context.appOutDir + '/' + context.packager.appInfo.productFilename + '.app';
  console.log(`App path: ${appPath}`);

  // Check for bundled Python runtime
  const resourcesPath = path.join(appPath, 'Contents/Resources');
  const extraResourcesPath = path.join(appPath, 'Contents/Resources/extraResources');

  // Try both possible locations
  let pythonPath = path.join(resourcesPath, 'python');
  if (!fs.existsSync(pythonPath)) {
    pythonPath = path.join(extraResourcesPath, 'python');
  }

  if (!fs.existsSync(pythonPath)) {
    console.log('⚠️  No bundled Python found, skipping Python re-signing');
    console.log(`   Checked: ${resourcesPath}/python`);
    console.log(`   Checked: ${extraResourcesPath}/python`);
  } else {
    console.log(`✓ Found Python runtime at: ${pythonPath}`);
    await resignPythonRuntime(pythonPath);
  }

  console.log('\n✅ Post-build code signing complete!\n');
};

async function resignPythonRuntime(pythonPath) {
  console.log('\n📦 Re-signing bundled Python runtime...\n');

  // Get signing identity from environment
  const identity = process.env.CSC_NAME;
  if (!identity) {
    console.error('❌ CSC_NAME environment variable not set!');
    throw new Error('CSC_NAME environment variable is required for code signing');
  }

  console.log(`Using identity: ${identity}`);

  try {
    // Find all executables and libraries
    console.log('🔍 Finding binaries to sign...');
    const findCommand = `find "${pythonPath}" -type f \\( -name "*.so" -o -name "*.dylib" -o -perm +111 \\)`;
    const filesOutput = execSync(findCommand, { encoding: 'utf-8' });
    const files = filesOutput.trim().split('\n').filter(f => f);

    console.log(`Found ${files.length} files to sign\n`);

    let signedCount = 0;
    let failedCount = 0;
    const failedFiles = [];

    // Re-sign each file
    for (const file of files) {
      if (!file) continue;

      try {
        // Remove extended attributes that might cause issues
        try {
          execSync(`xattr -cr "${file}"`, { stdio: 'pipe' });
        } catch (e) {
          // xattr might fail if no attributes exist, that's ok
        }

        // Sign the file
        execSync(
          `codesign --force --sign "${identity}" --timestamp --options runtime "${file}"`,
          { stdio: 'pipe' }
        );

        signedCount++;
        const fileName = path.basename(file);
        process.stdout.write(`  ✓ ${fileName}\n`);
      } catch (error) {
        failedCount++;
        failedFiles.push(file);
        const fileName = path.basename(file);
        console.error(`  ✗ ${fileName}: ${error.message}`);
      }
    }

    console.log(`\n📊 Signing Summary:`);
    console.log(`   ✓ Signed: ${signedCount}`);
    console.log(`   ✗ Failed: ${failedCount}`);

    if (failedFiles.length > 0) {
      console.log('\n⚠️  Failed files:');
      failedFiles.forEach(f => console.log(`   - ${f}`));
      throw new Error(`Failed to sign ${failedCount} files`);
    }

    console.log('\n✅ Python runtime re-signing complete!');
  } catch (error) {
    console.error('\n❌ Python runtime re-signing failed!');
    throw error;
  }
}