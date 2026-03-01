import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { characterImage, locationImage, jsonTemplate } = await req.json();

    if (!characterImage || !locationImage) {
      return NextResponse.json(
        { error: "Both character and location images are required" },
        { status: 400 }
      );
    }

    // Analyze character image
    const characterAnalysis = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this character image and fill in these JSON fields based on what you see:

- eyes: Describe eye color. If they have sunglasses, say "sunglasses" only.
- body.type: Describe body type in 2 words (e.g., "athletic slim", "curvy petite")
- body.chest: Brief description (e.g., "small", "full natural", "medium")
- body.waist: Brief description (e.g., "small", "toned", "average")
- body.hips: Brief description (e.g., "curvy", "athletic", "slim")
- outfit.details: Describe what they're wearing in detail (colors, type of clothing, accessories, etc.)

Return ONLY a JSON object with these exact field names, nothing else.`
            },
            {
              type: "image_url",
              image_url: { url: characterImage }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const characterText = characterAnalysis.choices[0]?.message?.content || "{}";
    let characterData: Record<string, string> = {};
    
    try {
      // Try to parse as JSON
      characterData = JSON.parse(characterText);
    } catch {
      // If parsing fails, try to extract fields manually
      const parseField = (text: string, field: string): string => {
        const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i');
        const match = text.match(regex);
        return match ? match[1] : "";
      };
      
      characterData = {
        eyes: parseField(characterText, "eyes"),
        body_type: parseField(characterText, "body.type"),
        body_chest: parseField(characterText, "body.chest"),
        body_waist: parseField(characterText, "body.waist"),
        body_hips: parseField(characterText, "body.hips"),
        outfit_details: parseField(characterText, "outfit.details")
      };
    }

    // Analyze location image
    const locationAnalysis = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this location image and fill in these JSON fields based on what you see:

- scene.time: Time of day (e.g., "day", "night", "golden hour", "blue hour", "evening")
- lighting.type: Main lighting type (e.g., "natural daylight", "overcast soft light", "indoor fluorescent", "warm ambient", "neon lights")
- lighting.effect: Describe any notable light effects (e.g., "soft glow", "hard shadows", "light rays through window", "neon reflections", "rim light", "sunset flare", "dramatic shadows"). If nothing notable, leave empty.

Return ONLY a JSON object with these exact field names, nothing else.`
            },
            {
              type: "image_url",
              image_url: { url: locationImage }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const locationText = locationAnalysis.choices[0]?.message?.content || "{}";
    let locationData: Record<string, string> = {};
    
    try {
      locationData = JSON.parse(locationText);
    } catch {
      const parseField = (text: string, field: string): string => {
        const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i');
        const match = text.match(regex);
        return match ? match[1] : "";
      };
      
      locationData = {
        scene_time: parseField(locationText, "scene.time"),
        lighting_type: parseField(locationText, "lighting.type"),
        lighting_effect: parseField(locationText, "lighting.effect")
      };
    }

    // Fill in the JSON template
    const filledJson = { ...jsonTemplate };
    
    // Character fields (handle both underscore and dot notations)
    if (characterData.eyes) filledJson.character_lock.eyes = characterData.eyes;
    if (characterData.body_type) filledJson.character_lock.body.type = characterData.body_type;
    if (characterData.body_chest) filledJson.character_lock.body.chest = characterData.body_chest;
    if (characterData.body_waist) filledJson.character_lock.body.waist = characterData.body_waist;
    if (characterData.body_hips) filledJson.character_lock.body.hips = characterData.body_hips;
    if (characterData.outfit_details) filledJson.character_lock.outfit.details = characterData.outfit_details;

    // Also check dot notation from direct JSON parse
    if (characterData["body.type"]) filledJson.character_lock.body.type = characterData["body.type"];
    if (characterData["body.chest"]) filledJson.character_lock.body.chest = characterData["body.chest"];
    if (characterData["body.waist"]) filledJson.character_lock.body.waist = characterData["body.waist"];
    if (characterData["body.hips"]) filledJson.character_lock.body.hips = characterData["body.hips"];
    if (characterData["outfit.details"]) filledJson.character_lock.outfit.details = characterData["outfit.details"];

    // Location fields
    if (locationData.scene_time) filledJson.scene.time = locationData.scene_time;
    if (locationData.lighting_type) filledJson.scene.lighting.type = locationData.lighting_type;
    if (locationData.lighting_effect) filledJson.scene.lighting.effect = locationData.lighting_effect;
    
    // Also check dot notation
    if (locationData["scene.time"]) filledJson.scene.time = locationData["scene.time"];
    if (locationData["lighting.type"]) filledJson.scene.lighting.type = locationData["lighting.type"];
    if (locationData["lighting.effect"]) filledJson.scene.lighting.effect = locationData["lighting.effect"];

    return NextResponse.json({ filledJson });

  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
