// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

module.exports = {
  packagerConfig: {
    appId: 'com.klever.desktop',
    productName: 'Klever Desktop',
    asar: true,
    icon: './build/icon', // Will use .icns for macOS, .ico for Windows
    extraResource: [
      'appagent' // Python scripts only, not Python runtime
    ],

    // Mac App Store signing configuration
    osxSign: {
      identity: process.env.CSC_NAME, // Apple Distribution
      platform: 'mas',
      type: 'distribution',
      appBundleId: 'com.klever.desktop', // MUST match App Store Connect
      entitlements: 'build/entitlements.mas.plist',
      'entitlements-inherit': 'build/entitlements.mas.inherit.plist',
    }
  },

  rebuildConfig: {},

  makers: [
    // Windows Store (AppX) - Unsigned for Partner Center signing
    {
      name: '@electron-forge/maker-appx',
      config: {
        // Do NOT include devCert or certPass - this creates unsigned package
        // Microsoft Partner Center will sign the package after upload
        assets: path.join(__dirname, 'build'),
        manifest: path.join(__dirname, 'build/appxmanifest.xml'), // Optional: custom manifest
        makeVersionWinStoreCompatible: true,

        // Package identity (update these with your actual values)
        publisher: 'CN=YourPublisherName', // TODO: Replace with Partner Center publisher
        publisherDisplayName: 'Your Company Name', // TODO: Replace
        packageName: 'KleverDesktop', // Package name in Partner Center
        packageDisplayName: 'Klever Desktop',
        packageDescription: 'AI-powered UI automation and testing tool',
        packageVersion: '2.0.0.0', // Must be x.x.x.x format for AppX

        // Store listing details
        identityName: 'YourCompany.KleverDesktop', // TODO: Reserved in Partner Center
        backgroundColor: '#FFFFFF',

        // Architecture support
        arch: 'x64', // or 'arm64', 'neutral'

        // Windows SDK requirements
        windowsKit: process.env.WINDOWS_KIT_PATH || 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64',
      },
      platforms: ['win32'],
    },

    // Mac App Store (PKG)
    {
      name: '@electron-forge/maker-pkg',
      config: {
        identity: process.env.CSC_INSTALLER_NAME, // 3rd Party Mac Developer Installer
        install: '/Applications',
      },
      platforms: ['mas'],
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
    prePackage: async (config, platform, arch) => {
      console.log(`Pre-package hook: ${platform}-${arch}`);
      // Optional: Run scripts/verify-bundle.js here
    },

    // Post-make hook - display build artifacts
    postMake: async (config, makeResults) => {
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
