# Klever Desktop Enterprise Distribution Guide

This guide outlines the process for signing and distributing the Klever Desktop application within Grab using Apple's enterprise distribution mechanisms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Certificate and Provisioning Profile](#certificate-and-provisioning-profile)
3. [Code Signing Configuration](#code-signing-configuration)
4. [Building and Signing](#building-and-signing)
5. [Distribution](#distribution)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- Access to Apple Developer Enterprise Program account (Grab's account)
- macOS development environment
- Xcode (latest version recommended)
- Appropriate certificates and provisioning profiles
- Gradle build system

## Certificate and Provisioning Profile

### Step-by-Step Guide to Obtaining Certificates and Profiles

Follow these detailed steps to create and download the necessary certificates and provisioning profiles for macOS app distribution:

#### 1. Access Apple Developer Portal

1. Open your web browser and go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Sign in with your Apple ID that has access to Grab's enterprise account
3. Once logged in, click on "Certificates, Identifiers & Profiles" in the left sidebar

#### 2. Create a Certificate Signing Request (CSR)

Before creating a certificate, you need to generate a Certificate Signing Request (CSR) from your Mac:

1. Open "Keychain Access" application (found in Applications > Utilities)
2. From the menu bar, select Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority
3. Enter your email address and common name (e.g., "Your Name")
4. Select "Saved to disk" and click "Continue"
5. Save the CSR file to your desktop or another convenient location

#### 3. Create a Developer ID Application Certificate

1. In the Apple Developer Portal, select "Certificates" from the left sidebar
2. Click the "+" button to create a new certificate
3. Under "Software," select "Developer ID Application" and click "Continue"
4. Upload the CSR file you created earlier and click "Continue"
5. Apple will generate your certificate. Click "Download" to save it to your computer
6. Double-click the downloaded certificate file (`.cer`) to install it in your Keychain

#### 4. Register an App ID

1. In the Apple Developer Portal, select "Identifiers" from the left sidebar
2. Click the "+" button to register a new identifier
3. Select "App IDs" and click "Continue"
4. Select "App" as the type and click "Continue"
5. Enter a description (e.g., "Klever Desktop")
6. Enter the Bundle ID: `com.grabtaxi.klever`
7. Select any capabilities your app requires
8. Click "Continue" and then "Register"

#### 5. Create a Provisioning Profile for macOS

1. In the Apple Developer Portal, select "Profiles" from the left sidebar
2. Click the "+" button to create a new profile
3. Under "Distribution," select "Developer ID" and click "Continue"
4. Select the App ID you just created and click "Continue"
5. Select the Developer ID Application certificate you created earlier and click "Continue"
6. Enter a profile name (e.g., "Klever Desktop Distribution Profile") and click "Generate"
7. Click "Download" to save the provisioning profile to your computer
   - Note: The downloaded file will have a `.provisionprofile` extension, which is correct for macOS apps

#### 6. Install the Provisioning Profile

1. Create the following directory if it doesn't exist:
   ```
   ~/Library/MobileDevice/Provisioning Profiles/
   ```
2. Copy the downloaded `.provisionprofile` file to this directory
3. Alternatively, you can double-click the provisioning profile to install it automatically

### Verifying Your Certificates and Profiles

To verify that your certificates are properly installed:

1. Open Keychain Access
2. In the "Category" section on the left, click on "Certificates"
3. Look for your "Developer ID Application" certificate
4. Ensure it shows as valid (no red X or expiration warnings)

To verify your provisioning profile:

1. Open Terminal
2. Run the following command to list all installed provisioning profiles:
   ```bash
   ls -la ~/Library/MobileDevice/Provisioning\ Profiles/
   ```
3. To view details of a specific profile, use:
   ```bash
   security cms -D -i ~/Library/MobileDevice/Provisioning\ Profiles/your_profile.provisionprofile
   ```

## Code Signing Configuration

### Updating the Gradle Build File

Modify the `build.gradle.kts` file to enable code signing. The current configuration has signing disabled:

```kotlin
// Current configuration
macOS {
    bundleID = "com.grabtaxi.klever"
    dockName = "Klever Desktop"
    iconFile.set(project.file("src/main/resources/icon.icns"))
    signing {
        sign.set(false) // Currently disabled
    }
}
```

Update it to:

```kotlin
macOS {
    bundleID = "com.grabtaxi.klever"
    dockName = "Klever Desktop"
    iconFile.set(project.file("src/main/resources/icon.icns"))
    
    // Enable code signing
    signing {
        sign.set(true)
        identity.set("Developer ID Application: Grab Holdings Inc.") // Use your actual certificate name
        provisioningProfile.set(file("path/to/your/profile.provisionprofile")) // Update with actual path
    }
    
    // Optional: Configure DMG signing
    dmg {
        signing {
            sign.set(true)
            identity.set("Developer ID Application: Grab Holdings Inc.") // Use your actual certificate name
        }
    }
}
```

### Finding Your Certificate Name

Run this command to list available signing certificates:

```bash
security find-identity -v -p codesigning
```

Look for a certificate with "Developer ID Application" in its name and use the exact name in your build file.

## Building and Signing

### Building a Signed DMG

Run the following command to build and sign the application:

```bash
./gradlew packageDmg
```

The signed DMG will be located in:
```
app/build/compose/binaries/main/dmg/
```

### Notarizing the Application (Recommended)

For better security and to avoid Gatekeeper warnings:

1. Submit the app for notarization:
   ```bash
   xcrun notarytool submit YourApp.dmg --apple-id "your-apple-id@example.com" --password "app-specific-password" --team-id "YOUR_TEAM_ID"
   ```

2. After successful notarization, staple the ticket to your DMG:
   ```bash
   xcrun stapler staple YourApp.dmg
   ```

## Distribution

### Internal Distribution Options

1. **Company File Server**:
   - Upload the signed DMG to your internal file server
   - Share the download link with intended users

2. **MDM Solution**:
   - If Grab uses an MDM solution like Jamf Pro, upload the app to the MDM console
   - Create a deployment policy for target users/devices

3. **Internal App Store**:
   - If Grab has an internal app distribution platform, publish the app there

## Troubleshooting

### Gatekeeper Warnings

If users see "app cannot be opened because the developer cannot be verified":

1. Ensure the app is properly signed
2. Complete the notarization process
3. Instruct users to right-click (or Control-click) the app and select "Open"

### Certificate Issues

If you encounter "certificate not found" errors:

1. Verify the certificate is properly installed in Keychain Access
2. Check that the certificate name in the build file exactly matches the one in Keychain
3. Ensure the certificate hasn't expired

### Build Errors

If the build fails with signing errors:

1. Check that the provisioning profile path is correct
2. Verify the bundle ID matches the one in the provisioning profile
3. Ensure you have the private key for the certificate

---

## Additional Resources

- [Apple Developer Documentation - Distributing macOS Apps](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [Apple Developer Documentation - Code Signing](https://developer.apple.com/documentation/security/code_signing)
- [Apple Developer Enterprise Program](https://developer.apple.com/programs/enterprise/) 