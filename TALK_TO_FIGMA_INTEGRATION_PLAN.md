# Project: `talk-to-figma` WebSocket Server Integration into KleverDesktop

## 1. Objective

To improve the user experience for designers by eliminating the need to set up and run a separate Node.js (`bun`) server. This will be achieved by integrating the WebSocket server functionality required by `@/cursor-talk-to-figma-mcp` directly into the existing `@/KleverDesktop` Kotlin application.

## 2. Background

The `@/cursor-talk-to-figma-mcp` plugin requires a WebSocket server to facilitate communication between the Figma plugin and other clients. Currently, this server is a standalone `bun`-based application (`socket.ts`). This creates a technical hurdle for non-developer users (designers) who are not familiar with Node.js environments.

By embedding the server into `@/KleverDesktop`, users can start the required service with a simple menu click within an application they already use.

## 3. Feasibility Analysis

**Conclusion: High Feasibility.**

- **Existing Technology Stack:** `@/KleverDesktop` already utilizes the `java-websocket` library to run its own WebSocket server (`KleverServer.kt`), so no new major dependencies are needed.
- **Clear Requirements:** The logic of the `socket.ts` server is a standard channel-based pub/sub model, which is straightforward to replicate in Kotlin using the existing websocket library.
- **Minimal UI Impact:** The change only requires adding a new menu item to the existing UI, which is a low-complexity task.

## 4. Implementation Plan

### Phase 1: Backend (Kotlin WebSocket Server)

1.  **Create New Server Class:**
    - Create a new file `TalkToFigmaServer.kt` in `app/src/main/kotlin/com/klever/desktop/server/`.
    - The class `TalkToFigmaServer` will extend `org.java_websocket.server.WebSocketServer`.
    - It will be configured to listen on **port 3055**.

2.  **Implement Channel Logic:**
    - The server will maintain a map to manage channels and connected clients: `private val channels = ConcurrentHashMap<String, MutableSet<WebSocket>>()`.
    - **`onMessage`:**
        - Parse incoming JSON messages.
        - Implement a `type: "join"` message handler that adds the client `WebSocket` to the specified channel set.
        - Implement a `type: "message"` handler that broadcasts the message to all other clients in the sender's channel.
    - **`onOpen` / `onClose`:**
        - Implement connection and disconnection logic, ensuring clients are correctly removed from any channels they have joined.

### Phase 2: UI Integration (Kotlin Desktop UI)

1.  **Add Menu Item:**
    - Locate the main UI definition file (likely `app/src/main/kotlin/com/klever/desktop/ui/MainWindow.kt`).
    - Add a new menu item with the label "Start TalkToFigma Server".

2.  **Implement Server Control:**
    - The menu item's action will:
        - Instantiate `TalkToFigmaServer`.
        - Call the `start()` method on the server instance.
        - The server should run in a background thread to avoid blocking the UI.
    - Implement a mechanism to prevent multiple servers from starting and to stop the server when the application closes. A toggle-like behavior for the menu item ("Start Server" / "Stop Server") would be ideal.

3.  **User Feedback:**
    - Provide feedback to the user that the server has successfully started or stopped (e.g., via a status bar message, a log entry in the UI, or changing the menu item text).

## 5. Affected Files

- **New File:** `KleverDesktop/app/src/main/kotlin/com/klever/desktop/server/TalkToFigmaServer.kt`
- **New File:** `KleverDesktop/TALK_TO_FIGMA_INTEGRATION_PLAN.md` (this file)
- **Modified File:** `KleverDesktop/app/src/main/kotlin/com/klever/desktop/ui/MainWindow.kt` (or equivalent UI definition file)
- **Potentially Modified:** `KleverDesktop/app/src/main/kotlin/com/klever/desktop/App.kt` (to manage the server lifecycle). 