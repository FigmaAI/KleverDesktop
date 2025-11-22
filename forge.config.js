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
    name: 'Klever Desktop',
    executableName: 'klever-desktop',
    appBundleId: 'com.klever.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    icon: './build/icon', // Will use .icns for macOS, .ico for Windows
    asar: true, // Enable asar for performance and security
    extraResource: [
      'appagent', // Python scripts only, not Python runtime
      'dist' // Renderer build output (Vite builds to dist/)
    ],
    extendInfo: {
      ITSAppUsesNonExemptEncryption: false
    },

    // macOS Signing & Notarization (Developer ID)
    osxSign: {
      identity: 'Developer ID Application', // Will pick up certificate from Keychain
      'hardened-runtime': true,
      'gatekeeper-assess': false,
      entitlements: path.join(__dirname, 'build/entitlements.mac.plist'),
      'entitlements-inherit': path.join(__dirname, 'build/entitlements.mac.plist'),
    },
    osxNotarize: process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    } : undefined,
  },

  rebuildConfig: {},

  makers: [
    // Windows Setup (Squirrel.Windows)
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'klever-desktop',
        authors: 'Klever Team',
        exe: 'klever-desktop.exe',
        iconUrl: 'https://raw.githubusercontent.com/Klever/KleverDesktop/main/build/icon.ico', // URL required for Squirrel
        setupIcon: path.join(__dirname, 'build/icon.ico'),
        loadingGif: path.join(__dirname, 'build/install-spinner.gif'), // Optional
        // Certificate configuration (Certum Open Source / Azure Trusted Signing later)
        // certificateFile: process.env.WINDOWS_CERT_FILE,
        // certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
      },
      platforms: ['win32'],
    },

    // macOS DMG
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: path.join(__dirname, 'build/icon.icns'),
        format: 'ULFO',
        name: 'Klever Desktop',
      },
      platforms: ['darwin'],
    },

    // ZIP (Portable)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
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

  // GitHub Releases Publisher
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'FigmaAI', // Update with actual owner
          name: 'KleverDesktop'
        },
        prerelease: true, // Default to prerelease
        draft: true // Default to draft to review before publishing
      }
    }
  ],

  hooks: {
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
