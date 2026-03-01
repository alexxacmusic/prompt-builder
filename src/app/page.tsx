"use client";

import { useState, useRef } from "react";

const DEFAULT_JSON = {
  meta: {
    quality: "ultra photorealistic",
    resolution: "8k",
    camera: "iPhone 15 Pro",
    lens: "24mm wide",
    aspect_ratio: "9:16",
    style: "raw iphone mirror selfie, subtle grain, natural skin texture"
  },
  character_lock: {
    reference: "the woman in ref 2",
    eyes: "",
    body: {
      type: "",
      chest: "",
      waist: "",
      hips: ""
    },
    outfit: {
      style: "like ref 2",
      details: ""
    },
    vibe: "mysterious"
  },
  scene: {
    location: "ref 1",
    time: "",
    details: "smudged mirror with visible fingerprints",
    lighting: {
      type: "",
      effect: ""
    }
  },
  subject: {
    action: "mirror selfie",
    pose: {
      hips: "shifted to one side"
    }
  },
  photography_rules: {
    "iphone_only_look": true,
    "suggestive_not_explicit": true,
    "thirst_trap_energy": true,
    "realism": "very high",
    "no_male_presence": true
  }
};

export default function Home() {
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [locationImage, setLocationImage] = useState<string | null>(null);
  const [jsonPreset, setJsonPreset] = useState(JSON.stringify(DEFAULT_JSON, null, 2));
  const [filledJson, setFilledJson] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const characterInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "character" | "location") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (type === "character") {
          setCharacterImage(result);
        } else {
          setLocationImage(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImages = async () => {
    if (!characterImage || !locationImage) {
      setError("Please upload both character and location images");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImage,
          locationImage,
          jsonTemplate: JSON.parse(jsonPreset)
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setFilledJson(JSON.stringify(data.filledJson, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (filledJson) {
      navigator.clipboard.writeText(filledJson);
    }
  };

  return (
    <main style={{ 
      minHeight: "100vh", 
      padding: "2rem", 
      background: "#0a0a0a", 
      color: "#fff",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "2rem", fontWeight: 300 }}>
          Prompt Builder
        </h1>

        {/* Preset Selector */}
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#888" }}>
            JSON Preset
          </label>
          <select 
            onChange={(e) => {
              if (e.target.value === "default") {
                setJsonPreset(JSON.stringify(DEFAULT_JSON, null, 2));
                setFilledJson("");
              }
            }}
            style={{
              padding: "0.5rem 1rem",
              background: "#1a1a1a",
              border: "1px solid #333",
              color: "#fff",
              borderRadius: "4px",
              width: "200px"
            }}
          >
            <option value="default">Default Preset</option>
          </select>
        </div>

        {/* Image Upload Zones */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
          {/* Character Ref */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#888" }}>
              Character Reference (ref 2)
            </label>
            <div
              onClick={() => characterInputRef.current?.click()}
              style={{
                border: "2px dashed #333",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                cursor: "pointer",
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: characterImage ? `url(${characterImage}) center/cover` : "#111",
                transition: "border-color 0.2s"
              }}
            >
              {characterImage ? null : (
                <span style={{ color: "#666" }}>Drop character image here</span>
              )}
            </div>
            <input
              ref={characterInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "character")}
              style={{ display: "none" }}
            />
          </div>

          {/* Location Ref */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#888" }}>
              Location Reference (ref 1)
            </label>
            <div
              onClick={() => locationInputRef.current?.click()}
              style={{
                border: "2px dashed #333",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                cursor: "pointer",
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: locationImage ? `url(${locationImage}) center/cover` : "#111",
                transition: "border-color 0.2s"
              }}
            >
              {locationImage ? null : (
                <span style={{ color: "#666" }}>Drop location image here</span>
              )}
            </div>
            <input
              ref={locationInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "location")}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={analyzeImages}
          disabled={loading || !characterImage || !locationImage}
          style={{
            padding: "1rem 2rem",
            background: loading ? "#333" : "#fff",
            color: loading ? "#666" : "#000",
            border: "none",
            borderRadius: "4px",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "2rem"
          }}
        >
          {loading ? "Analyzing..." : "Analyze with GPT-4o"}
        </button>

        {error && (
          <div style={{ color: "#ff4444", marginBottom: "1rem" }}>{error}</div>
        )}

        {/* JSON Editor */}
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#888" }}>
            JSON Template
          </label>
          <textarea
            value={jsonPreset}
            onChange={(e) => setJsonPreset(e.target.value)}
            style={{
              width: "100%",
              height: "300px",
              background: "#111",
              border: "1px solid #333",
              color: "#fff",
              padding: "1rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              borderRadius: "4px"
            }}
          />
        </div>

        {/* Filled JSON Output */}
        {filledJson && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ color: "#888" }}>Filled JSON (ready for Nano Banana Pro)</label>
              <button
                onClick={copyToClipboard}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#222",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.875rem"
                }}
              >
                Copy
              </button>
            </div>
            <textarea
              value={filledJson}
              readOnly
              style={{
                width: "100%",
                height: "400px",
                background: "#0d1117",
                border: "1px solid #238636",
                color: "#7ee787",
                padding: "1rem",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                borderRadius: "4px"
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
