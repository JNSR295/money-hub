#!/bin/bash

# Wealth Hub Docker/Podman Rebuild Script
# Detect the appropriate container engine and compose tool

echo "🔍 Detecting container compose tool..."

COMPOSE_CMD=""

if podman compose version &> /dev/null; then
    COMPOSE_CMD="podman compose"
elif command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
fi

if [ -z "$COMPOSE_CMD" ]; then
    echo "❌ Error: Neither docker-compose, podman-compose, docker compose, nor podman compose could be found."
    exit 1
fi

echo "✅ Found compose tool: $COMPOSE_CMD"

echo "🔄 Pulling latest git changes (if repository has a remote upstream)..."
if git rev-parse --is-inside-work-tree &> /dev/null; then
    # Only try to pull if there is an upstream branch set
    if git rev-parse --abbrev-ref --symbolic-full-name @{u} &> /dev/null; then
        git pull
    else
        echo "ℹ️ No remote upstream tracking branch set, skipping git pull."
    fi
fi

echo "🛑 Stopping running containers..."
$COMPOSE_CMD down

echo "🏗️ Rebuilding images..."
$COMPOSE_CMD build --no-cache

echo "🚀 Starting containers in detached mode..."
$COMPOSE_CMD up -d

echo "📊 Container status:"
$COMPOSE_CMD ps

echo "🎉 Rebuild completed successfully!"
