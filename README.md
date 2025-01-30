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
4. First launch: Right-click and select "Open" to bypass Gatekeeper
5. Grant necessary permissions when prompted

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
- **Browser**: Chrome (will be installed if not present)

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