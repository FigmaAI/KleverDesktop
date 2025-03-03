<p align="center">
  <img src="app/src/main/resources/icon.png" width="128" height="128" alt="KleverDesktop Logo">
</p>

<h1 align="center">KleverDesktop</h1>

<p align="center">
  <b>A desktop companion for Figma plugins with browser automation capabilities</b>
  <br>
  <i>Currently in Beta</i>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#features">Features</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

## Installation

### macOS (Recommended)
1. Download the latest `KleverDesktop-Beta-macOS.dmg` from [Releases](../../releases)
2. Open the DMG file
3. Drag KleverDesktop to your Applications folder

4. **Important**: First Launch Security Guide
   
   When you first try to open KleverDesktop, you'll see these security messages. This is normal for beta software! Here's how to proceed:

   <details>
   <summary>Step-by-step security bypass guide (with screenshots)</summary>

      If you see this message:
      <img width="306" alt="First security warning" src="https://github.com/user-attachments/assets/9e170e58-0c8c-4e4c-90d3-fe752bc20143" />
      
      **Don't click "Move to Trash"!** Instead:
      - Select "Open" from the context menu
      - Or go to system permissions & Grant the requested permissions
      <img width="740" alt="System permissions" src="https://github.com/user-attachments/assets/73cc3bfd-4851-40d5-86b7-1966a742c92a" />
   </details>

   > **Why these warnings?** These security messages appear because KleverDesktop is currently in beta and not yet registered with Apple's notarization service. The app is safe to use, and following the steps above will create a permanent security exception.

   After completing these steps, KleverDesktop will launch normally

### Windows (Beta)
1. Download `KleverDesktop-Beta-Windows.msi` from [Releases](../../releases)
2. Run the installer
3. Follow the installation wizard
4. Launch KleverDesktop from the Start menu

## Getting Started

1. **Launch KleverDesktop**
   - The application will start and initialize the browser

2. **Install Figma Plugin**
   - Install [Klever Desktop Beta](https://www.figma.com/community/plugin/1466767342108031572/klever-desktop-beta-next-gen-ai-usability-testing)
   - Plugin will automatically connect to KleverDesktop

3. **Verify Connection**
   - Check the connection status in both KleverDesktop and Figma plugin
   - Green indicator shows successful connection

## Features

- 🔄 Real-time sync with Figma plugins
- 🌐 Automated browser control
- 📸 Screenshot capabilities
- 🖱️ Mouse and keyboard simulation
- 🎨 Canvas interaction

## System Requirements

- **macOS**: 10.13 or later (Primary platform)
- **Windows**: Windows 10 or later (Beta support)
- **Memory**: 8GB RAM recommended
- **Storage**: 500MB free space
- **Browser**: Google Chrome (required)
- **Java**: Java 17 or later required (JDK or JRE)

### Java Environment Setup

KleverDesktop requires Java 17 or later to run. If you don't have Java installed, you can download it from:

- [Eclipse Temurin (Recommended)](https://adoptium.net/temurin/releases/?version=17)
- [Oracle Java](https://www.oracle.com/java/technologies/downloads/#java17)

#### Verifying Java Installation

To verify your Java installation, open a terminal or command prompt and run:

```bash
java -version
```

You should see output indicating Java 17 or later, for example:
```
openjdk version "17.0.7" 2023-04-18
OpenJDK Runtime Environment Temurin-17.0.7+7 (build 17.0.7+7)
OpenJDK 64-Bit Server VM Temurin-17.0.7+7 (build 17.0.7+7, mixed mode)
```

### Chrome Browser Setup

KleverDesktop requires Google Chrome to be installed. If you don't have Chrome installed, you can download it from:

- [Google Chrome Download Page](https://www.google.com/chrome/)

After installation, make sure Chrome is set as your default browser or at least accessible from your system PATH.

## Troubleshooting

### Common Issues

1. **Browser Launch Failed**
   - Ensure Chrome is installed
   - Check permissions in System Preferences/Settings
   - Restart KleverDesktop

2. **Connection Issues**
   - Verify KleverDesktop is running
   - Check firewall settings
   - Restart both Figma and KleverDesktop

3. **Permission Errors**
   - macOS: Grant permissions in System Preferences > Security & Privacy
   - Windows: Run as administrator if needed

4. **Chrome Browser Issues**
   - Error message: "Chrome browser check failed. Google Chrome is required."
   - Solution: Install Google Chrome (see Chrome Browser Setup section)
   - Make sure Chrome is not running in the background when starting KleverDesktop
   - If Chrome is installed but not detected, try reinstalling Chrome
   - On Windows, ensure Chrome is installed for all users or the current user

5. **Java Environment Issues**
   - Error message: "Java environment check failed. Minimum Java 17 required."
   - Solution: Install Java 17 or later (see Java Environment Setup section)
   - Windows: After installing Java, you may need to restart your computer
   - macOS: Ensure Java is properly installed with `java -version` command
   - If you have multiple Java versions installed, ensure Java 17+ is the default

6. **ChromeDriver Issues**
   - If you see errors related to ChromeDriver, try:
     - Updating Chrome to the latest version
     - Clearing the KleverDesktop cache folder (located at `~/.kleverdesktop/webdriver`)
     - Reinstalling KleverDesktop

## Help Us Improve
We value your feedback! Please share your experience and report any issues:
- 🐛 [Report a bug](https://github.com/FigmaAI/KleverDesktop/issues/new?labels=bug&template=bug_report.md)
- 💡 [Suggest a feature](https://github.com/FigmaAI/KleverDesktop/issues/new?labels=enhancement&template=feature_request.md)
- 📝 [View existing issues](https://github.com/FigmaAI/KleverDesktop/issues)


## For Developers

<details>
<summary>Click to expand development details</summary>

### Project Structure
```
KleverDesktop/
├── app/                    # Main application
│   ├── src/               # Source files
│   │   └── main/kotlin/   # Kotlin source code
│   └── User_Data/         # Chrome user data
├── figma-client/          # Figma plugin (submodule)
└── config/                # Configuration files
```

### Building from Source
```bash
# Clone repository with submodules
git clone --recursive [repository-url]

# Build project
./gradlew build
```

### Architecture
- WebSocket Server for plugin communication
- Selenium WebDriver for browser control
- Kotlin/JVM backend
</details>

## License

MIT License - see [LICENSE](LICENSE) for details

---

<p align="center">
  <sub>Beta Version - Primarily tested on macOS</sub>
</p>