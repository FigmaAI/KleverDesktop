#!/bin/bash
# This script sources the environment variables from .envrc for local testing

if [ -f .envrc ]; then
    echo "Loading environment variables from .envrc..."
    set -a
    source .envrc
    set +a
    echo "Environment variables loaded successfully."
else
    echo "Error: .envrc file not found!"
    exit 1
fi

# Run the specified command with the loaded environment variables
if [ $# -gt 0 ]; then
    exec "$@"
fi 