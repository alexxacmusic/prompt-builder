# Nano Banana — Prompt Builder

A tool for generating AI images using reference photos. Upload a character and a location, let the app analyze them, then generate the final image with Gemini or DALL-E 3.

---

## How It Works

### The Flow

```
Upload images → Analyze → (edit JSON) → Generate → Download
```

**1. Upload References**
- **Character Reference** — a photo of the person (face, body, outfit)
- **Location Reference** — a photo of the environment/background (optional)

**2. Analyze**
Sends both images to GPT-4o Vision. It reads the images and fills in the empty fields in your JSON template — things like eye color, body type, outfit details, lighting type, time of day, etc.

The analyzed JSON replaces the template in place so you can review and edit before generating.

**3. Edit (optional)**
The Template JSON section is editable. You can tweak anything before hitting Generate.

**4. Generate**
Sends the filled JSON + both reference images to the selected model (Gemini or DALL-E 3). Returns a generated image.

**5. Download**
Click the image to fullscreen, or hit Download.

---

## The JSON Template

The template is a structured prompt. Key sections:

```json
{
  "meta": {
    "quality": "ultra photorealistic",
    "resolution": "8k",
    "camera": "iPhone 15 Pro",
    "aspect_ratio": "9:16",
    "style": "raw iphone mirror selfie"
  },
  "character_lock": {
    "eyes": "",        ← filled by Analyze
    "body": {
      "type": "",      ← filled by Analyze
      "chest": "",     ← filled by Analyze
      ...
    },
    "outfit": {
      "details": ""    ← filled by Analyze
    }
  },
  "scene": {
    "location": "ref 1",
    "time": "",        ← filled by Analyze (if location image provided)
    "lighting": {
      "type": "",      ← filled by Analyze
      "effect": ""
    }
  },
  "photography_rules": {
    "thirst_trap_energy": true,
    "realism": "very high"
  }
}
```

**Empty string fields (`""`) get filled by Analyze.** Fields with values are kept as-is.

---

## Text Presets (Placeholder Format)

Besides JSON, you can use plain text prompts with placeholders:

```
Mirror selfie of a woman with [CHAR-HAIR] hair wearing [CHAR-OUTFIT],
standing in [LOC-DESCRIPTION] with [LOC-LIGHTING] lighting.
```

- `[CHAR-*]` — filled from the character image
- `[LOC-*]` — filled from the location image

Analyze replaces the placeholders with descriptions extracted from the images.

---

## Presets

- **Default Template** — mirror selfie preset (JSON format)
- **memory selfie / portrait / landscape** — built-in presets (coming soon)
- **Custom presets** — create your own via the `+ New` button. Saved in localStorage.

---

## Models

| Model | Notes |
|-------|-------|
| **Gemini** | Default. Uses Gemini imagen via Nano Banana skill. |
| **DALL-E 3** | OpenAI image generation. |

---

## API Keys Required (Vercel env vars)

| Variable | Used For |
|----------|----------|
| `OPENAI_API_KEY` | Analyze (GPT-4o Vision) + DALL-E generation |
| `GEMINI_API_KEY` | Gemini image generation |

---

## Local Dev

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Deploy

```bash
npx vercel --prod --token YOUR_TOKEN --yes
```

Live URL: https://prompt-builder-eta.vercel.app
