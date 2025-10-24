# Privacy Policy for KleverDesktop

**Last Updated:** October 24, 2025

## Introduction

KleverDesktop ("we", "our", or "the application") is committed to protecting your privacy. This Privacy Policy explains our practices regarding the collection, use, and disclosure of information when you use our desktop application.

## Information We Do NOT Collect

**KleverDesktop does not collect, store, transmit, or process any personal information.** This includes, but is not limited to:

- Personal identification information (name, email address, phone number, etc.)
- Usage statistics or analytics
- Device information
- Location data
- Browsing history
- User behavior data
- Any other personally identifiable information

## How KleverDesktop Works

KleverDesktop is a desktop application that operates entirely on your local machine. Here's what happens when you use the application:

### Local Operation

1. **WebSocket Server**: The application runs a local WebSocket server (default: `localhost:8080`) that only accepts connections from your local machine. This server does not communicate with external servers operated by us.

2. **Browser Automation**: The application uses Selenium WebDriver to control Google Chrome browser locally on your device for automated usability testing of Figma designs.

3. **Screenshot Processing**: Screenshots captured during testing are processed locally on your device and are temporarily stored only as needed for the testing session.

### Data You Provide

While using KleverDesktop, you may provide the following information, which is stored only locally on your device:

- **Figma File URLs**: URLs of Figma files you wish to test
- **Figma File Passwords**: Optional passwords for protected Figma files
- **AI Model API Keys**: API keys for third-party AI services (OpenAI, Azure OpenAI, Ollama, etc.)
- **Test Descriptions and Personas**: Task descriptions and personas for usability testing

**Important:** None of this information is transmitted to us. It remains on your local device.

### Third-Party Services

When you configure and use AI model integration, KleverDesktop will communicate directly with the third-party AI service provider you have chosen (such as OpenAI, Microsoft Azure, or local Ollama instances). This communication includes:

- Screenshots of the designs you are testing
- Prompts and test descriptions you have created

**Please note:**
- This data is sent directly from your device to the third-party AI service provider
- We do not intercept, collect, or have access to this data
- The privacy policies of these third-party services apply to data you send to them
- We recommend reviewing the privacy policies of any third-party AI services you choose to use:
  - [OpenAI Privacy Policy](https://openai.com/privacy/)
  - [Microsoft Azure Privacy Policy](https://privacy.microsoft.com/en-us/privacystatement)

## Data Storage

KleverDesktop stores configuration data locally on your device, including:

- Application settings (server port, preferences, etc.)
- AI model configurations and API keys
- Temporary screenshot files (automatically deleted after use)

All data is stored in local configuration files on your device and is never transmitted to our servers or any third parties (except the AI service providers you explicitly configure).

## Local Configuration Files Location

Configuration files are stored locally in:
- **macOS**: `~/Library/Application Support/KleverDesktop/` or within the application directory
- **Windows**: `%APPDATA%\KleverDesktop\` or within the application directory
- **Linux**: `~/.config/KleverDesktop/` or within the application directory

## Network Communication

KleverDesktop's WebSocket server only accepts connections from `localhost` (your local machine). The application does not:

- Connect to any remote servers operated by us
- Send telemetry or analytics data
- Report crashes or errors to external services
- Check for updates automatically (unless explicitly implemented in future versions with user consent)

The only external network connections made by KleverDesktop are:

1. Connections to Figma's servers (when loading Figma files via the browser)
2. Connections to third-party AI service providers (when you explicitly configure and use AI models)
3. Connections made by Selenium WebDriver for Chrome browser automation

## Children's Privacy

KleverDesktop is not directed to children under the age of 13, and we do not knowingly collect any information from children.

## Open Source

KleverDesktop is open-source software. You can review our source code at [https://github.com/FigmaAI/KleverDesktop](https://github.com/FigmaAI/KleverDesktop) to verify our privacy practices.

## Security

Since KleverDesktop operates entirely locally on your device and does not transmit data to our servers, the security of your data primarily depends on your device's security measures. We recommend:

- Keeping your operating system and security software up to date
- Using strong passwords for your user account
- Protecting your AI API keys and not sharing them with others
- Being cautious about which Figma files and data you choose to analyze with third-party AI services

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last Updated" date at the top of this Privacy Policy. Continued use of KleverDesktop after such changes constitutes acceptance of the updated Privacy Policy.

## Your Rights

Since we do not collect any personal information, there is no personal data for you to access, correct, or delete from our servers. However, you can:

- Delete the application and all its local configuration files at any time
- Clear your local configuration by manually deleting the configuration files
- Remove or modify your stored API keys in the application settings

## Contact Us

If you have any questions about this Privacy Policy or KleverDesktop's privacy practices, please contact us by:

- Opening an issue on our GitHub repository: [https://github.com/FigmaAI/KleverDesktop/issues](https://github.com/FigmaAI/KleverDesktop/issues)
- Contacting us through the Figma Community plugin page

## Compliance

This privacy policy is designed to comply with:

- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Other applicable privacy regulations

Since KleverDesktop does not collect personal information, most data protection regulations' requirements for data collection, processing, and storage do not apply.

## Summary

**In short:** KleverDesktop is a privacy-focused desktop application that:
- ✅ Operates entirely on your local machine
- ✅ Does not collect any personal information
- ✅ Does not send data to our servers
- ✅ Only communicates with third-party AI services that you explicitly configure
- ✅ Stores all settings and configurations locally on your device
- ✅ Is open-source and transparent about its operations

---

**You own your data. We don't collect it.**

