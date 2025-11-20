// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('./package.json');

// Convert package.json version (x.x.x) to Windows Store format (x.x.x.x)
const convertToWinStoreVersion = (version) => {
  const parts = version.split('.');
  // Ensure we have exactly 4 parts, padding with 0 if needed
  while (parts.length < 4) {
    parts.push('0');
  }
  return parts.slice(0, 4).join('.');
};

const appVersion = convertToWinStoreVersion(packageJson.version);

module.exports = {
  packagerConfig: {
    appBundleId: 'com.klever.desktop', // Force Bundle ID for macOS
    appId: 'com.klever.desktop',
    productName: 'Klever Desktop',
    buildVersion: '11', // Build number for App Store (increment for each submission)
    asar: false, // Disable asar temporarily to debug renderer packaging
    icon: './build/icon', // Will use .icns for macOS, .ico for Windows
    extraResource: [
      'appagent', // Python scripts only, not Python runtime
      'dist' // Renderer build output (Vite builds to dist/)
    ],

    // Mac App Store signing configuration
    osxSign: {
      identity: process.env.CSC_NAME, // Apple Distribution
      platform: 'mas',
      type: 'distribution',
      appBundleId: 'com.klever.desktop', // MUST match App Store Connect
      entitlements: 'build/entitlements.mas.plist',
      'entitlements-inherit': 'build/entitlements.mas.inherit.plist',
      // Optional: Add provisioning profile if you have one
      provisioningProfile: process.env.MAS_PROVISIONING_PROFILE || undefined,
      // CRITICAL: Sign all Electron helper processes with inherit entitlements
      optionsForFile: (filePath) => {
        // Check if this is a helper process
        if (filePath.includes('Helper')) {
          return {
            entitlements: 'build/entitlements.mas.inherit.plist',
          };
        }
        // Main app uses main entitlements
        return {
          entitlements: 'build/entitlements.mas.plist',
        };
      },
      hardenedRuntime: true, // Enable Hardened Runtime for MAS
      gatekeeperAssess: false, // Disable Gatekeeper assessment for MAS
      signatureFlags: ['runtime'], // Add runtime signature flag
    }
  },

  rebuildConfig: {},

  makers: [
    // Windows Store (MSIX) - Unsigned for Partner Center signing
    {
      name: '@electron-forge/maker-appx',
      config: {
        // Do NOT include devCert or certPass - this creates unsigned package
        // Microsoft Partner Center will sign the package after upload
        assets: path.join(__dirname, 'build'),
        // Let Forge auto-generate manifest with proper version substitution
        makeVersionWinStoreCompatible: true,

        // Package identity (must match Partner Center reservation)
        // Use environment variables for security and flexibility
        publisher: process.env.WIN_PUBLISHER_ID || 'CN=151CE182-E4E4-44BC-B167-68C3C482DE94',
        publisherDisplayName: process.env.WIN_PUBLISHER_NAME || 'JooHyung Park',
        packageName: process.env.WIN_PACKAGE_NAME || 'JooHyungPark.KleverDesktop',
        packageDisplayName: process.env.WIN_PACKAGE_DISPLAY_NAME || 'Klever Desktop',
        packageDescription: 'AI-powered UI automation and testing tool',
        packageVersion: appVersion, // Auto-synced from package.json (converted to x.x.x.x format)

        // Store listing details
        identityName: process.env.WIN_IDENTITY_NAME || 'JooHyungPark.KleverDesktop', // Reserved in Partner Center
        backgroundColor: '#FFFFFF',

        // Architecture support
        arch: 'x64', // or 'arm64', 'neutral'

        // Windows SDK requirements (makeappx.exe creates MSIX format by default in SDK 10.0.19041+)
        windowsKit: process.env.WINDOWS_KIT_PATH || 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64',
      },
      platforms: ['win32'],
    },

    // Mac App Store (PKG) - Universal binary
    {
      name: '@electron-forge/maker-pkg',
      config: {
        identity: process.env.CSC_INSTALLER_NAME, // 3rd Party Mac Developer Installer
        install: '/Applications',
      },
      platforms: ['mas'],
      // Universal binary includes both x64 and arm64
      arch: ['universal'],
    },

    // ZIP maker for development and testing
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
    },
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // Vite configuration for main process
        build: [
          {
            entry: 'main/index.ts',
            config: 'vite.main.config.js',
            target: 'main',
          },
          {
            entry: 'main/preload.ts',
            config: 'vite.preload.config.js',
            target: 'preload',
          },
        ],
        // Vite configuration for renderer process
        renderer: [
          {
            name: 'main_window',
            config: 'vite.config.ts',
          },
        ],
      },
    },
  ],

  // Publishers (optional - for automated publishing)
  publishers: [
    // {
    //   name: '@electron-forge/publisher-github',
    //   config: {
    //     repository: {
    //       owner: 'FigmaAI',
    //       name: 'KleverDesktop'
    //     },
    //     prerelease: false,
    //     draft: true
    //   }
    // }
  ],

  // Build hooks
  hooks: {
    // Pre-package hook - verify bundle before packaging
    prePackage: async (_config, platform, arch) => {
      console.log(`Pre-package hook: ${platform}-${arch}`);
      // Optional: Run scripts/verify-bundle.js here
    },

    // Post-make hook - display build artifacts
    postMake: async (_config, makeResults) => {
      console.log('Build artifacts created:');
      makeResults.forEach((result) => {
        console.log(`Platform: ${result.platform}/${result.arch}`);
        result.artifacts.forEach((artifact) => {
          console.log(`  - ${artifact}`);
        });
      });
      return makeResults;
    },
  },
};
