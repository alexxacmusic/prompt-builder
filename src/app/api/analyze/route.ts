import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { characterImage, locationImage, jsonTemplate } = await req.json();
    console.log("Received request, images size:", characterImage?.length, locationImage?.length);

    // Detect if this is a text preset (has placeholders) or JSON preset
    const isTextPreset = typeof jsonTemplate === 'string' && !jsonTemplate.trim().startsWith('{');

    // For text presets with placeholders
    if (isTextPreset) {
      console.log("OPENAI_API_KEY env:", OPENAI_API_KEY ? "set (" + OPENAI_API_KEY.substring(0, 20) + "...)" : "NOT SET");

      if (!OPENAI_API_KEY) {
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }

      const prompt = jsonTemplate as string;
      const hasCharPlaceholder = /\[CHAR-[^\]]+\]/i.test(prompt);
      const hasLocPlaceholder = /\[LOC-[^\]]+\]/i.test(prompt);

      // Check if we have required images
      if (hasCharPlaceholder && !characterImage) {
        return NextResponse.json(
          { error: "Character image required for placeholders" },
         { status: 400 }
        );
      }
      if (hasLocPlaceholder && !locationImage) {
        return NextResponse.json(
          { error: "Location image required for [LOC-*] placeholders" },
          { status: 400 }
        );
      }

      // Build descriptions to fill
      const charDescriptions: string[] = [];
      const locDescriptions: string[] = [];

      const charMatch = prompt.match(/\[CHAR-[^\]]+\]/gi) || [];
      for (const placeholder of charMatch) {
        const field = placeholder.toUpperCase().replace('[CHAR-', '').replace(']', '');
        if (field.includes('OUTFIT') || field.includes('CLOTHING')) {
          charDescriptions.push("Describe what the person is wearing (clothing items, colors, style)");
        } else if (field.includes('HAIR')) {
          charDescriptions.push("Describe hair color and style");
        } else if (field.includes('BODY')) {
          charDescriptions.push("Describe body type");
        } else if (field.includes('EYES')) {
          charDescriptions.push("Describe eye color or if wearing sunglasses");
        } else if (field.includes('SKIN')) {
          charDescriptions.push("Describe skin tone");
        } else if (field.includes('VIBE') || field.includes('MOOD')) {
          charDescriptions.push("Describe the person's vibe or energy");
        } else {
          charDescriptions.push(`Describe ${field.toLowerCase()}`);
        }
      }

      const locMatch = prompt.match(/\[LOC-[^\]]+\]/gi) || [];
      for (const placeholder of locMatch) {
        const field = placeholder.toUpperCase().replace('[LOC-', '').replace(']', '');
        if (field.includes('DESCRIPTION') || field.includes('SETTING') || field.includes('LOCATION')) {
          locDescriptions.push("Describe the location/environment");
        } else if (field.includes('LIGHTING')) {
          locDescriptions.push("Describe the lighting (type, mood, effects)");
        } else if (field.includes('TIME')) {
          locDescriptions.push("Describe time of day");
        } else {
          locDescriptions.push(`Describe ${field.toLowerCase()}`);
        }
      }

      // Get all unique placeholder keys - KEEP THE FULL KEY including CHAR-/LOC- prefix
      const charKeys = charMatch.map(p => p.replace('[', '').replace(']', '')); // e.g., "CHAR-HAIR"
      const locKeys = locMatch.map(p => p.replace('[', '').replace(']', '')); // e.g., "LOC-DESCRIPTION"
      const allPlaceholders = [...charKeys, ...locKeys]; // Keep full keys!

      console.log("DEBUG: allPlaceholders:", allPlaceholders);

      // Build a prompt - ask for more detailed descriptions
      const keys = allPlaceholders.map(k => k.replace('CHAR-', '').replace('LOC-', '')).join(', ');
      let analysisText = `Look at the character image. Describe in detail: ${keys}. Format: ${allPlaceholders.map(k => k.replace('CHAR-', '').replace('LOC-', '') + ': detailed description').join(', ')}`;

      console.log("DEBUG: analysisText:", analysisText);

      console.log("Sending to GPT, char image present:", !!characterImage, "loc image present:", !!locationImage);

      // Send to GPT-4o with both images
      const gptRequest = {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: analysisText },
              ...(characterImage ? [{ type: "image_url", image_url: { url: characterImage } }] : [])
            ]
          }
        ],
        max_tokens: 1500
      };
      console.log("GPT request - analysis text:", analysisText.substring(0, 200));

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(gptRequest)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.log("GPT API error:", errText);
        throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
      }

      const result = await response.json();
      let content = result.choices[0]?.message?.content || "";
      console.log("GPT response:", content.substring(0, 500));

      // Parse the response - smarter extraction for full paragraphs
      let filledValues: Record<string, string> = {};

      // Convert to lowercase for matching
      const lowerContent = content.toLowerCase();

      // For each placeholder, try to find relevant descriptions
      for (const key of allPlaceholders) {
        const shortKey = key.replace('CHAR-', '').replace('LOC-', '').toLowerCase();

        // Define keywords to look for based on placeholder type
        let keywords: string[] = [];
        if (shortKey.includes('hair')) {
          keywords = ['hair', 'hairstyle', 'hairdo'];
        } else if (shortKey.includes('outfit') || shortKey.includes('clothing') || shortKey.includes('wear')) {
          keywords = ['wearing', 'outfit', 'clothes', 'clothing', 'dressed', 'attire'];
        } else if (shortKey.includes('body')) {
          keywords = ['body', 'figure', 'physique'];
        } else if (shortKey.includes('skin')) {
          keywords = ['skin', 'complexion'];
        } else if (shortKey.includes('description') || shortKey.includes('setting')) {
          keywords = ['setting', 'background', 'location', 'environment', 'scene'];
        }

        // Look for sentences containing these keywords
        const sentences = content.split(/[.!?\n]+/);
        for (const sentence of sentences) {
          const lowerSentence = sentence.toLowerCase();
          for (const kw of keywords) {
            if (lowerSentence.includes(kw)) {
              // Clean up the sentence
              let desc = sentence.trim();
              // Remove leading words like "The hair is" or "She is wearing"
              desc = desc.replace(/^(the\\s+|a\\s+|an\\s+|she\\s+is\\s+|she\\s+has\\s+|the\\s+(person|woman)\\s+has\\s+)/i, '');
              if (desc.length > 3 && desc.length < 500) {
                filledValues[key] = desc;
                break;
              }
            }
          }
          if (filledValues[key]) break;
        }
      }

      console.log("Extracted values:", JSON.stringify(filledValues));

      // Keep the "HAIR:" prefix format - do NOT strip it

      // Replace placeholders in the prompt
      let filledPrompt = prompt;
      for (const [key, value] of Object.entries(filledValues)) {
        if (value && value.length > 2 && value.length < 500) {
          const placeholderRegex = new RegExp(`\\[${key.replace('-', '[-_]')}\\]`, 'gi');
          filledPrompt = filledPrompt.replace(placeholderRegex, value);
        }
      }

      console.log("Final filled prompt:", filledPrompt.substring(0, 200));
      return NextResponse.json({ filledPrompt, isTextPreset: true });
    }

    // Original JSON preset logic
    if (!characterImage) {
      return NextResponse.json(
        { error: "Character image is required" },
        { status: 400 }
      );
    }

    console.log("OPENAI_API_KEY env:", OPENAI_API_KEY ? "set (" + OPENAI_API_KEY.substring(0, 20) + "...)" : "NOT SET");

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Find empty fields in the template to know what to analyze
    const findEmptyFields = (obj: any, prefix = ""): string[] => {
      const emptyFields: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        if (value === "" || value === null || value === undefined) {
          emptyFields.push(fieldPath);
        } else if (typeof value === "object" && value !== null) {
          emptyFields.push(...findEmptyFields(value, fieldPath));
        }
      }
      return emptyFields;
    };

    const emptyCharacterFields = jsonTemplate.character_lock ? findEmptyFields(jsonTemplate.character_lock) : [];
    const emptySceneFields = jsonTemplate.scene ? findEmptyFields(jsonTemplate.scene) : [];

    // Build dynamic prompt based on empty fields
    const buildCharacterPrompt = (fields: string[]): string | null => {
      if (fields.length === 0) return null;
      const descriptions: string[] = [];
      for (const field of fields) {
        if (field.includes("eyes")) descriptions.push("- eyes: Describe eye color or say 'sunglasses' if wearing sunglasses");
        if (field.includes("body") && field.includes("type")) descriptions.push("- body.type: Body type in 2 words (e.g., 'athletic slim', 'curvy petite')");
        if (field.includes("body") && field.includes("chest")) descriptions.push("- body.chest: Brief description (e.g., 'small', 'full natural', 'medium')");
        if (field.includes("body") && field.includes("waist")) descriptions.push("- body.waist: Brief description (e.g., 'small', 'toned', 'average')");
        if (field.includes("body") && field.includes("hips")) descriptions.push("- body.hips: Brief description (e.g., 'curvy', 'athletic', 'slim')");
        if (field.includes("outfit") || field.includes("clothing")) descriptions.push("- outfit.details: Describe clothing in detail");
        if (field.includes("hair")) descriptions.push("- hair: Hair color and style");
        if (field.includes("skin")) descriptions.push("- skin: Skin tone description");
        if (field.includes("vibe")) descriptions.push("- vibe: Overall mood/energy");
        if (field.includes("reference")) descriptions.push("- reference: Brief description of the person");
      }
      return descriptions.length > 0 ? descriptions.join("\n") : null;
    };

    const buildScenePrompt = (fields: string[]): string | null => {
      if (fields.length === 0) return null;
      const descriptions: string[] = [];
      for (const field of fields) {
        if (field.includes("time")) descriptions.push("- scene.time: Time of day (e.g., 'day', 'night', 'golden hour', 'evening')");
        if (field.includes("location")) descriptions.push("- scene.location: Type of place/setting");
        if (field.includes("lighting") && field.includes("type")) descriptions.push("- lighting.type: Main lighting type (e.g., 'natural daylight', 'warm ambient')");
        if (field.includes("lighting") && field.includes("effect")) descriptions.push("- lighting.effect: Light effects (e.g., 'soft glow', 'rim light', 'sunset flare')");
        if (field.includes("details")) descriptions.push("- details: Environment details");
      }
      return descriptions.length > 0 ? descriptions.join("\n") : null;
    };

    const characterPrompt = buildCharacterPrompt(emptyCharacterFields);
    const scenePrompt = buildScenePrompt(emptySceneFields);

    // Analyze character image
    let characterAnalysis;
    try {
      console.log("Calling OpenAI for character analysis...");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this character image and fill in these JSON fields based on what you see:

${characterPrompt || "- Describe the character in detail"}

Return ONLY a JSON object with the exact field names, nothing else.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: characterImage
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
      }

      characterAnalysis = await response.json();
      console.log("Character analysis complete");
    } catch (openaiError: any) {
      console.error("OpenAI character error:", openaiError?.message);
      throw new Error("OpenAI API error: " + (openaiError?.message || "Connection error"));
    }

    const characterText = characterAnalysis.choices[0]?.message?.content || "{}";
    let characterData: Record<string, string> = {};
    
    try {
      // Try to parse as JSON
      characterData = JSON.parse(characterText);
    } catch {
      // If parsing fails, try to extract fields manually with more robust regex
      console.log("Character response not valid JSON, attempting regex extraction:", characterText);
      const parseField = (text: string, field: string): string => {
        try {
          // Match field name followed by colon and value (quoted or unquoted)
          const regex = new RegExp(`"${field.replace('.', '\\.')}"\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^,}\\n]+))`, 'i');
          const match = text.match(regex);
          if (match) {
            return (match[1] || match[2] || match[3] || "").trim();
          }
        } catch (e) {
          console.error("Regex error for field", field, e);
        }
        return "";
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

    // Analyze location image (optional — skip if not provided)
    let locationData: Record<string, string> = {};
    if (locationImage && scenePrompt) {
      let locationAnalysis;
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze this location image and fill in these JSON fields based on what you see:

${scenePrompt}

Return ONLY a JSON object with the exact field names, nothing else.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: locationImage
                    }
                  }
                ]
              }
            ],
            max_tokens: 500
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
        }

        locationAnalysis = await response.json();
      } catch (openaiError: any) {
        console.error("OpenAI location error:", openaiError?.message);
        throw new Error("OpenAI API error: " + (openaiError?.message || "Connection error"));
      }

      const locationText = locationAnalysis.choices[0]?.message?.content || "{}";
      try {
        locationData = JSON.parse(locationText);
      } catch {
        console.log("Location response not valid JSON:", locationText);
        const parseField = (text: string, field: string): string => {
          try {
            const regex = new RegExp(`"${field.replace('.', '\\.')}"\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^,}\\n]+))`, 'i');
            const match = text.match(regex);
            if (match) return (match[1] || match[2] || match[3] || "").trim();
          } catch (e) { console.error("Regex error for field", field, e); }
          return "";
        };
        locationData = {
          scene_time: parseField(locationText, "scene.time"),
          lighting_type: parseField(locationText, "lighting.type"),
          lighting_effect: parseField(locationText, "lighting.effect")
        };
      }
    }

    // Fill in the JSON template dynamically
    let filledJson: Record<string, any>;
    try {
      filledJson = JSON.parse(JSON.stringify(jsonTemplate)); // Deep clone
    } catch {
      filledJson = { ...jsonTemplate };
    }

    // Helper to set nested values
    const setNestedValue = (obj: any, path: string, value: string) => {
      const keys = path.split(".");
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    };

    // Apply character data under character_lock
    for (const [key, value] of Object.entries(characterData)) {
      if (value) {
        const path = "character_lock." + key;
        setNestedValue(filledJson, path, value);
        if (key.includes("_")) {
          const dotPath = "character_lock." + key.replace(/_/g, ".");
          setNestedValue(filledJson, dotPath, value);
        }
      }
    }

    // Apply location data under scene
    for (const [key, value] of Object.entries(locationData)) {
      if (value) {
        const path = "scene." + key;
        setNestedValue(filledJson, path, value);
        if (key.includes("_")) {
          const dotPath = "scene." + key.replace(/_/g, ".");
          setNestedValue(filledJson, dotPath, value);
        }
      }
    }

    return NextResponse.json({ filledJson });

  } catch (error) {
    console.error("Analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "Analysis failed";
    const errorStack = error instanceof Error ? error.stack : "";
    return NextResponse.json(
      { error: errorMessage, details: errorStack },
      { status: 500 }
    );
  }
}
