#!/bin/bash

# File to read/write environment variables
ENV_FILE=".env.production"

# Static values
DOCKER_USERNAME="sajibsv"
EMAIL="sajib.softvence@gmail.com"

# Get values from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name || 'empty_name'")
PACKAGE_VERSION=$(node -p "require('./package.json').version || '0.0.1'")

# Generate IMAGE_TAG
IMAGE_TAG="${DOCKER_USERNAME}/${PACKAGE_NAME}:${PACKAGE_VERSION}"

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
RESET="\033[0m"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $ENV_FILE file not found${RESET}"
    exit 1
fi

echo -e "${BLUE}🔄 Updating dynamic values in $ENV_FILE...${RESET}"

# Temporary env file
TMP_ENV=$(mktemp)

# Update lines with only required values and preserve structure
while IFS= read -r line || [ -n "$line" ]; do
    # Preserve comments and empty lines
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        echo "$line" >> "$TMP_ENV"
        continue
    fi

    # Update specific values
    case "$line" in
        DOCKER_USERNAME=*)
            echo "DOCKER_USERNAME=$DOCKER_USERNAME" >> "$TMP_ENV"
            ;;
        PACKAGE_NAME=*)
            echo "PACKAGE_NAME=$PACKAGE_NAME" >> "$TMP_ENV"
            ;;
        PACKAGE_VERSION=*)
            echo "PACKAGE_VERSION=$PACKAGE_VERSION" >> "$TMP_ENV"
            ;;
        EMAIL=*)
            echo "EMAIL=$EMAIL" >> "$TMP_ENV"
            ;;
        IMAGE_TAG=*)
            echo "IMAGE_TAG=$IMAGE_TAG" >> "$TMP_ENV"
            ;;
        MAIL_PASS=*)
            # Always wrap MAIL_PASS value in double quotes
            value="${line#MAIL_PASS=}"
            value="${value%\"}"
            value="${value#\"}"
            echo "MAIL_PASS=\"$value\"" >> "$TMP_ENV"
            ;;
        *)
            # Everything else as-is
            echo "$line" >> "$TMP_ENV"
            ;;
    esac
done < "$ENV_FILE"



# Replace original .env with updated one
mv "$TMP_ENV" "$ENV_FILE"

echo -e "${GREEN}✅ Updated values:${RESET}"
echo -e "   DOCKER_USERNAME: $DOCKER_USERNAME"
echo -e "   PACKAGE_NAME: $PACKAGE_NAME"
echo -e "   PACKAGE_VERSION: $PACKAGE_VERSION"
echo -e "   EMAIL: $EMAIL"
echo -e "   IMAGE_TAG: $IMAGE_TAG"

echo -e "${BLUE}🚀 Uploading GitHub secrets from ${ENV_FILE}...${RESET}"

# Uploading secrets
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi

    # Parse KEY=VALUE
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"

        # Strip surrounding quotes (unless MAIL_PASS)
        if [[ "$key" != "MAIL_PASS" ]]; then
            value="${value%\"}"
            value="${value#\"}"
        fi

        echo -e "${GREEN}✨ Setting secret:${RESET} ${BLUE}${key}${RESET} 🔑"

        if gh secret set "$key" --body "$value" 2>/dev/null; then
            echo -e "${GREEN}✅ Secret $key set successfully!${RESET}"
        else
            echo -e "${RED}❌ Failed to set secret $key${RESET}"
            if ! command -v gh &> /dev/null; then
                echo -e "${RED}❌ GitHub CLI (gh) is not installed.${RESET}"
                exit 1
            fi
            if ! gh auth status &> /dev/null; then
                echo -e "${RED}❌ GitHub CLI is not authenticated. Run 'gh auth login'.${RESET}"
                exit 1
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping invalid line: $line${RESET}"
    fi
done < "$ENV_FILE"

echo -e "${BLUE}🎉 All done! Secrets uploaded to GitHub.${RESET}"


