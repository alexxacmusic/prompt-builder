#!/bin/bash
MINIMAX_API_KEY="sk-api-3cWmzG1eBF-c16QkGmLftIeQyX7E-T4dlHXsaPQKtq2wVycsOF31xjduGwlKJt1sG8wgV14x7UJgGh5PRRuo4MYaWbzE4dODh2QoCw-9tIIgnGntpi7R9fo"
IMG_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

echo "=== Test: MiniMax M2.5 via OpenAI-compatible endpoint with image_url ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  "https://api.minimax.io/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -d '{
    "model": "MiniMax-M2.5",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe what you see in this image briefly."},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,'"$IMG_BASE64"'"}}
      ]
    }]
  }' 2>&1

echo ""
echo "=== Test: MiniMax VL-01 via OpenAI-compatible endpoint with image_url ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  "https://api.minimax.io/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -d '{
    "model": "MiniMax-VL-01",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe what you see in this image briefly."},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,'"$IMG_BASE64"'"}}
      ]
    }]
  }' 2>&1
