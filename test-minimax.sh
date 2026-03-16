#!/bin/bash
# Test MiniMax VL API with a small base64 image

MINIMAX_API_KEY="sk-api-3cWmzG1eBF-c16QkGmLftIeQyX7E-T4dlHXsaPQKtq2wVycsOF31xjduGwlKJt1sG8wgV14x7UJgGh5PRRuo4MYaWbzE4dODh2QoCw-9tIIgnGntpi7R9fo"

# Create a tiny 1x1 red pixel PNG as base64 for testing
IMG_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

echo "=== Test 1: MiniMax M2.5 with Anthropic Messages format ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  "https://api.minimax.io/anthropic/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $MINIMAX_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "MiniMax-M2.5",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe what you see in this image. Return a JSON object with field eyes set to a description."},
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "'"$IMG_BASE64"'"}}
      ]
    }]
  }' 2>&1

echo ""
echo "=== Test 2: MiniMax M2.5 text-only (no image) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  "https://api.minimax.io/anthropic/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $MINIMAX_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "MiniMax-M2.5",
    "max_tokens": 100,
    "messages": [{
      "role": "user",
      "content": "Say hello"
    }]
  }' 2>&1

echo ""
echo "=== Test 3: MiniMax VL-01 with image ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  "https://api.minimax.io/anthropic/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $MINIMAX_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "MiniMax-VL-01",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What do you see?"},
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "'"$IMG_BASE64"'"}}
      ]
    }]
  }' 2>&1
