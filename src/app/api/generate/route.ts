import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { prompt, characterImage, locationImage, model = "gemini" } = await req.json();

    // Handle DALL-E
    if (model === "dalle") {
      if (!OPENAI_API_KEY) {
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }

      if (!prompt) {
        return NextResponse.json(
          { error: "Prompt is required" },
          { status: 400 }
        );
      }

      // Convert prompt to string if it's JSON
      let promptText: string;
      if (typeof prompt === 'string') {
        promptText = prompt;
      } else {
        promptText = `Generate an image based on: ${JSON.stringify(prompt)}`;
      }

      // Call DALL-E 3 API
      console.log("Calling DALL-E 3...");
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: promptText,
          size: "1024x1792", // 9:16 portrait
          quality: "standard",
          n: 1
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("DALL-E error:", errText);
        throw new Error(`DALL-E API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      console.log("DALL-E response:", data);

      if (!data.data || !data.data[0]) {
        throw new Error("No image returned from DALL-E");
      }

      const imageUrl = data.data[0].url;
      return NextResponse.json({ imageUrl });
    }

    // Handle Gemini (default)
    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "Google API key not configured" },
        { status: 500 }
      );
    }

    // For text prompts, we only need character image (location is optional)
    // For JSON prompts, we need both images
    const isTextPrompt = typeof prompt === 'string';

    if (!prompt || !characterImage) {
      return NextResponse.json(
        { error: "Prompt and character image are required" },
        { status: 400 }
      );
    }

    if (!isTextPrompt && !locationImage) {
      return NextResponse.json(
        { error: "Location image required for JSON prompts" },
        { status: 400 }
      );
    }

    console.log("Calling Gemini for image generation...");

    // Handle both text prompts and JSON prompts
    let promptText: string;
    let useLocationImage = true;

    if (typeof prompt === 'string') {
      // Text prompt (already filled)
      promptText = prompt;
      useLocationImage = /location|setting|background|scene|environment|lighting/i.test(prompt);
    } else {
      // JSON prompt — build a clean natural language prompt from the JSON
      const meta = prompt.meta || {};
      const character = prompt.character_lock || {};
      const scene = prompt.scene || {};
      const subject = prompt.subject || {};
      const rules = prompt.photography_rules || {};

      const parts: string[] = [];
      parts.push("Generate a photorealistic image based on the provided reference images.");
      
      if (meta.style) parts.push(`Style: ${meta.style}.`);
      if (meta.camera) parts.push(`Shot on ${meta.camera}.`);
      if (meta.aspect_ratio) parts.push(`Aspect ratio: ${meta.aspect_ratio}.`);
      
      if (subject.action) parts.push(`The subject is ${subject.action}.`);
      if (character.vibe) parts.push(`Vibe: ${character.vibe}.`);
      if (character.outfit?.details) parts.push(`Wearing: ${character.outfit.details}.`);
      
      if (scene.time) parts.push(`Time of day: ${scene.time}.`);
      if (scene.details) parts.push(`Scene details: ${scene.details}.`);
      if (scene.lighting?.type) parts.push(`Lighting: ${scene.lighting.type}.`);
      if (scene.lighting?.effect) parts.push(`Light effect: ${scene.lighting.effect}.`);

      if (rules.realism) parts.push(`Realism level: ${rules.realism}.`);

      parts.push("First reference image shows the character appearance. Second reference image shows the location/environment.");

      promptText = parts.join(" ");
      useLocationImage = !!locationImage;
    }

    // Use v1beta API with correct Google REST API format
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`;

    console.log("Using API URL:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY!
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "image/jpeg", data: characterImage.split(",")[1] } },
              ...(useLocationImage && locationImage ? [{ inline_data: { mime_type: "image/jpeg", data: locationImage.split(",")[1] } }] : [])
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", errText);
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log("Gemini response:", JSON.stringify(data, null, 2));

    // Check if there's an error in the response
    if (data.error) {
      console.error("Gemini API error:", data.error);
      throw new Error(`Gemini API error: ${JSON.stringify(data.error)}`);
    }

    // Extract image from response - check various possible structures
    let imageData = null;
    let textResponse = null;

    // Try different response structures (API returns camelCase)
    const candidates = data?.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          imageData = part.inlineData.data;
          console.log("Found image data in response (inlineData)");
          break;
        } else if (part?.text) {
          textResponse = part.text;
          console.log("Found text in response:", textResponse.substring(0, 500));
        }
      }
      if (imageData) break;
    }

    // Also check snake_case just in case
    if (!imageData && data?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data) {
      imageData = data.candidates[0].content.parts[0].inline_data.data;
      console.log("Found image data in response (inline_data)");
    }

    if (!imageData) {
      // Return more info for debugging
      console.error("Full response structure:", JSON.stringify(data, null, 2));
      throw new Error(`No image in Gemini response. Response: ${JSON.stringify(data).substring(0, 1000)}`);
    }

    const imageUrl = `data:image/png;base64,${imageData}`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
