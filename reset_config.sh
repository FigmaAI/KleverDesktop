#!/bin/bash
# KleverDesktop 설정 초기화 스크립트

echo "Resetting KleverDesktop configuration..."

# macOS의 Java Preferences 초기화
defaults delete com.klever.desktop 2>/dev/null || true

echo "Configuration reset complete!"
echo "Please restart the app and enter your API key again."

