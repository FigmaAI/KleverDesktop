package com.klever.desktop.browser

import org.openqa.selenium.WebDriver
import org.openqa.selenium.edge.EdgeDriver
import org.openqa.selenium.edge.EdgeDriverService
import org.openqa.selenium.edge.EdgeOptions
import mu.KotlinLogging
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.nio.file.Path
import java.util.zip.ZipInputStream

private val logger = KotlinLogging.logger {}

/**
 * Microsoft Edge WebDriver implementation
 * Edge is the default browser on Windows 10/11
 */
class EdgeDriverImpl : BrowserDriver {
    
    override fun getBrowserType(): BrowserType = BrowserType.EDGE
    
    override fun isAvailable(): Boolean {
        val edgePath = getBrowserPath()
        return edgePath != null && File(edgePath).exists()
    }
    
    override fun getBrowserPath(): String? {
        return when {
            System.getProperty("os.name").lowercase().contains("win") -> {
                // Windows Edge locations
                val possibleLocations = listOf(
                    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                    System.getProperty("user.home") + "\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe"
                )
                possibleLocations.find { File(it).exists() }
            }
            System.getProperty("os.name").lowercase().contains("mac") -> {
                // macOS Edge location
                val edgePath = "/Applications/Microsoft Edge.app"
                if (File(edgePath).exists()) edgePath else null
            }
            else -> {
                // Linux Edge locations
                val possibleLocations = listOf(
                    "/usr/bin/microsoft-edge",
                    "/usr/bin/microsoft-edge-stable",
                    "/opt/microsoft/msedge/msedge"
                )
                possibleLocations.find { File(it).exists() }
            }
        }
    }
    
    override fun setupDriver() {
        try {
            logger.info { "Setting up Edge WebDriver..." }
            
            val driverCachePath = Path.of(
                System.getProperty("user.home"),
                ".kleverdesktop",
                "webdriver",
                "edgedriver"
            ).toString()
            
            // Try to find Edge browser version
            val edgeVersion = getEdgeBrowserVersion()
            if (edgeVersion != null) {
                logger.info { "Detected Edge version: $edgeVersion" }
            }
            
            // Check if driver already exists
            val existingDriver = findEdgeDriverInPath() ?: findManualDriver(driverCachePath)
            if (existingDriver != null) {
                System.setProperty("webdriver.edge.driver", existingDriver)
                logger.info { "Using existing EdgeDriver: $existingDriver" }
                return
            }
            
            // Try automatic download with custom logic
            if (edgeVersion != null) {
                logger.info { "Attempting automatic driver download for Edge $edgeVersion" }
                val downloaded = downloadEdgeDriver(edgeVersion, driverCachePath)
                if (downloaded) {
                    val driverPath = findManualDriver(driverCachePath)
                    if (driverPath != null) {
                        System.setProperty("webdriver.edge.driver", driverPath)
                        logger.info { "Successfully downloaded and configured EdgeDriver" }
                        return
                    }
                }
            }
            
            logger.info { "Edge WebDriver setup completed - will use Selenium Manager as fallback" }
            
        } catch (e: Exception) {
            logger.error(e) { "Edge driver setup failed: ${e.message}" }
            throw RuntimeException(
                "Edge driver setup failed. " +
                "The driver will be downloaded automatically on first use, or you can " +
                "download msedgedriver.exe manually from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/ " +
                "and place it in ${System.getProperty("user.home")}\\.kleverdesktop\\webdriver\\edgedriver",
                e
            )
        }
    }
    
    private fun downloadEdgeDriver(version: String, cacheDir: String): Boolean {
        return try {
            // Microsoft's new domain for EdgeDriver downloads
            val downloadUrl = "https://msedgedriver.microsoft.com/$version/edgedriver_win64.zip"
            logger.info { "Downloading EdgeDriver from: $downloadUrl" }
            
            val cacheDirectory = File(cacheDir)
            if (!cacheDirectory.exists()) {
                cacheDirectory.mkdirs()
            }
            
            // Download and extract
            val url = URL(downloadUrl)
            url.openStream().use { input ->
                ZipInputStream(input).use { zipIn ->
                    var entry = zipIn.nextEntry
                    while (entry != null) {
                        if (!entry.isDirectory && entry.name.endsWith("msedgedriver.exe")) {
                            val outputFile = File(cacheDirectory, "msedgedriver.exe")
                            FileOutputStream(outputFile).use { output ->
                                zipIn.copyTo(output)
                            }
                            // Set executable permission
                            outputFile.setExecutable(true)
                            logger.info { "EdgeDriver downloaded successfully to: ${outputFile.absolutePath}" }
                            return@use
                        }
                        zipIn.closeEntry()
                        entry = zipIn.nextEntry
                    }
                }
            }
            
            true
        } catch (e: Exception) {
            logger.warn { "Failed to download EdgeDriver automatically: ${e.message}" }
            false
        }
    }
    
    private fun getEdgeBrowserVersion(): String? {
        return try {
            val edgePath = getBrowserPath() ?: return null
            val edgeFile = File(edgePath)
            
            if (!edgeFile.exists()) return null
            
            when {
                isWindows -> {
                    // On Windows, read version from registry or file properties
                    val process = ProcessBuilder(
                        "reg", "query", 
                        "HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\BLBeacon",
                        "/v", "version"
                    ).start()
                    
                    val output = process.inputStream.bufferedReader().readText()
                    process.waitFor()
                    
                    // Extract version number from registry output
                    val versionRegex = """version\s+REG_SZ\s+(\d+\.\d+\.\d+\.\d+)""".toRegex()
                    versionRegex.find(output)?.groupValues?.get(1)
                }
                else -> null
            }
        } catch (e: Exception) {
            logger.debug { "Could not detect Edge version: ${e.message}" }
            null
        }
    }
    
    private val isWindows: Boolean
        get() = System.getProperty("os.name").lowercase().contains("win")
    
    // Helper method to find EdgeDriver in system PATH
    private fun findEdgeDriverInPath(): String? {
        val edgeDriverName = if (isWindows) "msedgedriver.exe" else "msedgedriver"
        
        val pathEnv = System.getenv("PATH") ?: return null
        val pathSeparator = if (isWindows) ";" else ":"
        
        return pathEnv.split(pathSeparator)
            .map { File(it, edgeDriverName) }
            .find { it.exists() && it.canExecute() }
            ?.absolutePath
    }
    
    // Helper method to find manually placed driver in cache directory
    private fun findManualDriver(cachePath: String): String? {
        val edgeDriverName = if (isWindows) "msedgedriver.exe" else "msedgedriver"
        val driverDir = File(cachePath)
        
        if (!driverDir.exists()) {
            return null
        }
        
        // Search recursively in the cache directory
        return driverDir.walk()
            .filter { it.isFile && it.name == edgeDriverName }
            .firstOrNull()
            ?.absolutePath
    }
    
    override fun createDriver(userDataDir: File): WebDriver {
        try {
            logger.info { "Creating Edge WebDriver..." }
            
            // Create user data directory if it doesn't exist
            if (!userDataDir.exists()) {
                userDataDir.mkdirs()
                logger.debug { "Created user data directory: ${userDataDir.absolutePath}" }
            }
            
            val options = EdgeOptions().apply {
                // Common options
                addArguments("--remote-allow-origins=*")
                addArguments("--user-data-dir=${userDataDir.absolutePath}")
                addArguments("disable-features=msEdgeEnableNurturingFramework")
                setExperimentalOption("detach", true)
                
                // Platform-specific options
                when {
                    System.getProperty("os.name").lowercase().contains("win") -> {
                        addArguments("--start-maximized")
                        addArguments("--disable-gpu")
                    }
                    System.getProperty("os.name").lowercase().contains("mac") -> {
                        addArguments("--start-maximized")
                    }
                    else -> {
                        addArguments("--start-maximized")
                        addArguments("--no-sandbox")
                    }
                }
                
                // Set browser binary location explicitly
                val browserPath = getBrowserPath()
                if (browserPath != null) {
                    setBinary(browserPath)
                    logger.debug { "Using Edge browser at: $browserPath" }
                }
            }
            
            // Create EdgeDriver - always try to use our downloaded driver first
            val driverPath = System.getProperty("webdriver.edge.driver")
            val driver = if (driverPath != null && File(driverPath).exists()) {
                logger.info { "Using EdgeDriver from: $driverPath" }
                val service = EdgeDriverService.Builder()
                    .usingDriverExecutable(File(driverPath))
                    .usingAnyFreePort()
                    .build()
                EdgeDriver(service, options)
            } else {
                // Fallback: Let Selenium Manager handle it (will likely fail with old domain)
                logger.warn { "No driver found, using Selenium Manager as fallback" }
                EdgeDriver(options)
            }
            
            logger.info { "Edge WebDriver created successfully" }
            return driver
            
        } catch (e: Exception) {
            logger.error(e) { "Failed to create Edge driver: ${e.message}" }
            
            // Provide helpful error message
            val errorMsg = when {
                e.message?.contains("Cannot find msedgedriver") == true ||
                e.message?.contains("no msedgedriver in") == true -> {
                    "Edge driver not found. Please ensure Microsoft Edge is installed and try again. " +
                    "If the issue persists, download msedgedriver.exe manually from " +
                    "https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/ and place it in your PATH"
                }
                e.message?.contains("session not created") == true -> {
                    "Failed to start Edge browser session. Please ensure Microsoft Edge is not already running with conflicting settings"
                }
                else -> {
                    "Edge driver creation failed: ${e.message}"
                }
            }
            
            throw RuntimeException(errorMsg, e)
        }
    }
}

