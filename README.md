# KleverDesktop

A WebSocket server application that integrates with Figma plugins, providing browser automation capabilities through Selenium WebDriver.

## Key Features

- **Real-time WebSocket Server**: Bidirectional communication with Figma plugin
- **Browser Automation**: Chrome browser control via Selenium WebDriver
- **Screenshot Management**: Capture and process browser screenshots
- **Action Simulation**: Mouse and keyboard event simulation

## Project Structure
```
KleverDesktop/
├── app/                    # Main application
│   ├── src/               # Source files
│   │   └── main/kotlin/   # Kotlin source code
│   └── User_Data/         # Chrome user data
├── figma-client/          # Figma plugin (submodule)
│   └── ...
└── config/               # Configuration files
```

## Getting Started

1. **Prerequisites**
   - JDK 17 or higher
   - Chrome browser and ChromeDriver
   - Gradle 8.x

2. **Installation**
   ```bash
   # Clone repository with submodules
   git clone --recursive [repository-url]
   
   # Build project
   ./gradlew build
   ```

3. **Running the Server**
   ```bash
   ./gradlew run
   ```

## System Architecture

### Core Components
1. **WebSocket Server**
   - Handles plugin communication
   - Manages browser control requests
   - Default port: 8080

2. **Browser Controller**
   - Selenium WebDriver integration
   - Screenshot capture
   - Action execution

3. **Configuration Management**
   - Server settings
   - Browser options
   - Screenshot handling

### Communication Flow

```mermaid
sequenceDiagram
    participant Figma Plugin
    participant WebSocket Server
    participant Browser Controller
    participant Chrome Browser

    Figma Plugin->>WebSocket Server: Connect WebSocket
    WebSocket Server-->>Figma Plugin: Connection Established

    rect rgb(200, 220, 250)
        Note over Figma Plugin,Chrome Browser: Initialization
        Figma Plugin->>WebSocket Server: Init Request
        WebSocket Server->>Browser Controller: Launch Browser
        Browser Controller->>Chrome Browser: Start Session
        Chrome Browser-->>Browser Controller: Session Ready
        Browser Controller-->>WebSocket Server: Browser Ready
        WebSocket Server-->>Figma Plugin: Init Success
    end

    rect rgb(220, 250, 220)
        Note over Figma Plugin,Chrome Browser: Task Execution
        Figma Plugin->>WebSocket Server: Task Request
        WebSocket Server->>Browser Controller: Execute Action
        Browser Controller->>Chrome Browser: Perform Action
        Chrome Browser-->>Browser Controller: Action Result
        Browser Controller->>Browser Controller: Capture Screenshot
        Browser Controller-->>WebSocket Server: Action Complete
        WebSocket Server-->>Figma Plugin: Task Result
    end

    rect rgb(250, 220, 220)
        Note over Figma Plugin,Chrome Browser: Cleanup
        Figma Plugin->>WebSocket Server: Close Request
        WebSocket Server->>Browser Controller: Cleanup
        Browser Controller->>Chrome Browser: Close Session
        WebSocket Server-->>Figma Plugin: Connection Closed
    end
```

## Configuration

Edit `config.json` to configure:
- WebSocket server port
- Browser options
- Screenshot save path
- Log level

## Development

- Written in Kotlin
- Uses Java-WebSocket for real-time communication
- Selenium WebDriver for browser control
- Jackson for JSON processing
- Gradle for build management

## Git Configuration

- `.gitignore`: Excludes build outputs, IDE files, and user data
- `.gitattributes`: Manages line endings for cross-platform compatibility
- `.gitmodules`: Includes Figma client as a submodule

## License

MIT License