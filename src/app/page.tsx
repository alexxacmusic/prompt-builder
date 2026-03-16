"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const DEFAULT_JSON = {
  meta: {
    quality: "ultra photorealistic",
    resolution: "8k",
    camera: "iPhone 15 Pro",
    lens: "24mm wide",
    aspect_ratio: "9:16",
    style: "natural photography, subtle grain, realistic skin texture"
  },
  character_lock: {
    reference: "the person in the character reference image",
    eyes: "",
    hair: "",
    body: {
      type: ""
    },
    outfit: {
      style: "",
      details: ""
    },
    vibe: ""
  },
  scene: {
    location: "the location in the reference image",
    time: "",
    details: "",
    lighting: {
      type: "",
      effect: ""
    }
  },
  subject: {
    action: "standing portrait",
    pose: ""
  },
  photography_rules: {
    "iphone_look": true,
    "realism": "very high"
  }
};

const PRESETS = [
  { id: "memory-selfie", name: "memory selfie" },
  { id: "portrait", name: "portrait" },
  { id: "landscape", name: "landscape" }
];

// Empty template for new presets
const EMPTY_JSON = {
  meta: {
    quality: "",
    resolution: "",
    camera: "",
    lens: "",
    aspect_ratio: "",
    style: ""
  },
  character_lock: {
    reference: "",
    eyes: "",
    body: {
      type: "",
      chest: "",
      waist: "",
      hips: ""
    },
    outfit: {
      style: "",
      details: ""
    },
    vibe: ""
  },
  scene: {
    location: "",
    time: "",
    details: "",
    lighting: {
      type: "",
      effect: ""
    }
  },
  subject: {
    action: "",
    pose: {
      hips: ""
    }
  },
  photography_rules: {}
};

export default function Home() {
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [locationImage, setLocationImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [jsonPreset, setJsonPreset] = useState(JSON.stringify(DEFAULT_JSON, null, 2));
  const [filledJson, setFilledJson] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customPresets, setCustomPresets] = useState<{id: string, name: string, json: string}[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState("");
  const [model, setModel] = useState("gemini");

  // Load presets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('promptBuilderPresets');
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load presets:", e);
      }
    }
  }, []);

  // Save presets to localStorage when they change
  const savePresets = (presets: {id: string, name: string, json: string}[]) => {
    localStorage.setItem('promptBuilderPresets', JSON.stringify(presets));
    setCustomPresets(presets);
  };

  const allPresets = [...PRESETS, ...customPresets];

  const createNewPreset = () => {
    const name = prompt("Enter name for new preset:");
    if (name) {
      const newPreset = {
        id: `custom-${Date.now()}`,
        name,
        json: JSON.stringify(EMPTY_JSON, null, 2)
      };
      savePresets([...customPresets, newPreset]);
      setSelectedPreset(newPreset.id);
      setJsonPreset(newPreset.json);
      setTemplateOpen(true);
    }
  };

  const deletePreset = (id: string) => {
    if (confirm("Delete this preset?")) {
      savePresets(customPresets.filter(p => p.id !== id));
      if (selectedPreset === id) {
        setSelectedPreset("default");
        setJsonPreset(JSON.stringify(DEFAULT_JSON, null, 2));
      }
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `generated-${Date.now()}.jpg`;
    link.click();
  };

  const characterInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (dataUrl: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = dataUrl;
    });
  };

  const processFile = async (file: File, type: "character" | "location") => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const compressed = await compressImage(result);
      if (type === "character") {
        setCharacterImage(compressed);
      } else {
        setLocationImage(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent, type: "character" | "location") => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file, type);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "character" | "location") => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  // Check if location image is required based on preset type
  const isTextPreset = jsonPreset && !jsonPreset.trim().startsWith('{');
  const hasLocPlaceholder = isTextPreset && /\[LOC-[^\]]+\]/i.test(jsonPreset);
  const locationRequired = Boolean(hasLocPlaceholder);

  const analyzeImages = async () => {
    console.log(">>> analyzeImages called!", { characterImage: !!characterImage, locationImage: !!locationImage, locationRequired });
    // For text presets without location placeholders, only require character image
    if (!characterImage || (!locationImage && locationRequired)) {
      setError(locationRequired ? "Please upload both character and location images" : "Please upload a character image");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Detect if this is a text preset or JSON preset
      const isText = !jsonPreset.trim().startsWith('{');
      console.log("Analyzing...", { isText, hasChar: !!characterImage, hasLoc: !!locationImage });

      const templateValue = isText
        ? jsonPreset              // Text preset - send as string
        : JSON.parse(jsonPreset); // JSON preset - parse it

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImage,
          locationImage,
          jsonTemplate: templateValue
        })
      });

      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ` + text.substring(0, 200));
      }

      if (!response.ok) {
        throw new Error(data.error + (data.details ? " | " + data.details : "") || "Analysis failed");
      }

      console.log("Analysis response:", data);

      // Handle both JSON and text presets
      if (data.filledPrompt) {
        // Text preset - use the filled prompt directly
        setFilledJson(data.filledPrompt);
        setJsonPreset(data.filledPrompt);
      } else if (data.filledJson) {
        const filled = JSON.stringify(data.filledJson, null, 2);
        setFilledJson(filled);
        setJsonPreset(filled); // update template in place so user sees the result immediately
      }
      setOutputOpen(true);
      setTemplateOpen(true);
    } catch (err) {
      console.error("Analyze error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    console.log(">>> generateImage called", { characterImage: !!characterImage, filledJson: filledJson?.substring(0, 50) });
    if (!characterImage || !filledJson) {
      console.log("Error: missing characterImage or filledJson");
      setError("Please analyze images first");
      return;
    }

    // For text presets, we need locationImage only if the prompt requires it
    // But for now, just check if we have what we need
    if (!locationImage && jsonPreset.includes('[LOC-')) {
      setError("Location image required for this preset");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      let parsedPrompt;
      const isText = !filledJson.trim().startsWith('{');

      if (isText) {
        // Text prompt - use as string directly
        parsedPrompt = filledJson;
      } else {
        // JSON prompt - parse it
        try {
          parsedPrompt = JSON.parse(filledJson);
        } catch (parseErr) {
          setError("Invalid JSON in output. Please fix the JSON syntax before generating.");
          setGenerating(false);
          return;
        }
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: parsedPrompt,
          characterImage,
          locationImage,
          model
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Generation failed");
      }

      const data = await response.json();

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
      }
    } catch (err) {
      console.error("Generate error:", err);
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (filledJson) {
      navigator.clipboard.writeText(filledJson);
    }
  };

  const controlStyle = {
    padding: "0.7rem 0.85rem",
    borderRadius: "6px",
    fontSize: "0.8rem",
    background: "#1a1a1a",
    color: "#fff",
    border: "1px solid #333",
    minWidth: 0
  };

  const refCardStyle = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: "10px",
    padding: "0.75rem",
    position: "relative" as const
  };

  return (
    <main style={{ 
      minHeight: "100vh", 
      padding: "2rem", 
      background: "#0a0a0a", 
      color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontWeight: 400, fontSize: "1.25rem" }}>Prompt Builder</h1>
          <span style={{ background: "#222", padding: "0.25rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", color: "#777" }}>
            nano banana
          </span>
        </div>

        <div
          className="split-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
            minHeight: "70vh",
            alignItems: "stretch"
          }}
        >
          <div className="input-side" style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
            <div className="ref-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={refCardStyle}>
                <div style={{ fontSize: "0.6rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                  Character Reference
                </div>
                <div
                  onClick={() => characterInputRef.current?.click()}
                  onDrop={(e) => handleDrop(e, "character")}
                  onDragOver={handleDragOver}
                  style={{
                    border: characterImage ? "1px solid #333" : "1px dashed #333",
                    borderRadius: "6px",
                    aspectRatio: "3/4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0a0a0a",
                    color: characterImage ? "transparent" : "#444",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    overflow: "hidden"
                  }}
                >
                  {characterImage ? (
                    <img
                      src={characterImage}
                      alt="Character reference"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }}
                    />
                  ) : (
                    "Drop image"
                  )}
                </div>
                {characterImage && (
                  <button
                    onClick={() => setCharacterImage(null)}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.8)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "16px",
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                )}
                <input
                  ref={characterInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "character")}
                  style={{ display: "none" }}
                />
              </div>

              <div style={refCardStyle}>
                <div style={{ fontSize: "0.6rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                  Location Reference
                </div>
                <div
                  onClick={() => locationInputRef.current?.click()}
                  onDrop={(e) => handleDrop(e, "location")}
                  onDragOver={handleDragOver}
                  style={{
                    border: locationImage ? "1px solid #333" : "1px dashed #333",
                    borderRadius: "6px",
                    aspectRatio: "3/4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0a0a0a",
                    color: locationImage ? "transparent" : "#444",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    overflow: "hidden"
                  }}
                >
                  {locationImage ? (
                    <img
                      src={locationImage}
                      alt="Location reference"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }}
                    />
                  ) : (
                    "Drop image"
                  )}
                </div>
                {locationImage && (
                  <button
                    onClick={() => setLocationImage(null)}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.8)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "16px",
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                )}
                <input
                  ref={locationInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "location")}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="controls-row" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{ ...controlStyle, flex: 1 }}
                >
                  <option value="gemini">Gemini</option>
                  <option value="dalle">DALL-E</option>
                </select>
                <select
                  value={selectedPreset}
                  onChange={(e) => {
                    const customPreset = customPresets.find(p => p.id === e.target.value);
                    setSelectedPreset(e.target.value);
                    if (customPreset) {
                      setJsonPreset(customPreset.json);
                    } else if (e.target.value === "default") {
                      setJsonPreset(JSON.stringify(DEFAULT_JSON, null, 2));
                    }
                  }}
                  style={{ ...controlStyle, flex: 1.2 }}
                >
                  <option value="default">Default Template</option>
                  {PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {customPresets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (custom)</option>
                  ))}
                </select>
                <button
                  onClick={createNewPreset}
                  style={{
                    ...controlStyle,
                    background: "#222",
                    color: "#888",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  + New
                </button>
                {selectedPreset.startsWith("custom-") && (
                  <button
                    onClick={() => deletePreset(selectedPreset)}
                    style={{
                      ...controlStyle,
                      background: "#2a1111",
                      color: "#ff6666",
                      border: "1px solid #442222",
                      cursor: "pointer"
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="controls-row" style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={analyzeImages}
                  disabled={loading || !characterImage || (!locationImage && locationRequired)}
                  style={{
                    flex: 1,
                    padding: "0.8rem 1rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: loading ? "not-allowed" : "pointer",
                    background: loading ? "#333" : "#fff",
                    color: loading ? "#666" : "#000",
                    border: "none"
                  }}
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </button>
                <button
                  onClick={generateImage}
                  disabled={generating || !filledJson}
                  style={{
                    flex: 1,
                    padding: "0.8rem 1rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: generating || !filledJson ? "not-allowed" : "pointer",
                    background: generating ? "#333" : "#111",
                    color: generating ? "#666" : "#fff",
                    border: "1px solid #333"
                  }}
                >
                  {generating ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ color: "#ff4444", fontSize: "0.85rem" }}>{error}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", overflow: "hidden" }}>
                <div
                  onClick={() => setTemplateOpen(!templateOpen)}
                  style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                >
                  <span style={{ color: "#666", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Template JSON</span>
                  <span style={{ color: "#444", fontSize: "0.75rem" }}>{templateOpen ? "▼" : "▶"}</span>
                </div>
                {templateOpen && (
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ color: "#555", fontSize: "0.65rem" }}>
                        {selectedPreset.startsWith("custom-") ? "Editing custom preset" : "Template JSON"}
                      </span>
                      {selectedPreset.startsWith("custom-") && (
                        <button
                          onClick={() => {
                            savePresets(customPresets.map(p =>
                              p.id === selectedPreset ? { ...p, json: jsonPreset } : p
                            ));
                            alert("Preset saved!");
                          }}
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.65rem",
                            background: "#1a3320",
                            color: "#4ade80",
                            border: "1px solid #2a4430",
                            cursor: "pointer"
                          }}
                        >
                          Save
                        </button>
                      )}
                    </div>
                    <textarea
                      value={jsonPreset}
                      onChange={(e) => setJsonPreset(e.target.value)}
                      style={{
                        width: "100%",
                        height: "150px",
                        background: "#0a0a0a",
                        border: "1px solid #1a1a1a",
                        borderRadius: "6px",
                        color: "#888",
                        padding: "0.75rem",
                        fontFamily: "'SF Mono', monospace",
                        fontSize: "0.7rem",
                        lineHeight: 1.4
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", overflow: "hidden" }}>
                <div
                  onClick={() => setOutputOpen(!outputOpen)}
                  style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                >
                  <span style={{ color: "#666", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Filled JSON</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {filledJson && (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
                        style={{ background: "transparent", border: "none", color: "#444", fontSize: "0.7rem", cursor: "pointer" }}
                      >
                        copy
                      </button>
                    )}
                    <span style={{ color: "#444", fontSize: "0.75rem" }}>{outputOpen ? "▼" : "▶"}</span>
                  </div>
                </div>
                {outputOpen && (
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <textarea
                      value={filledJson || "// output will appear here"}
                      onChange={(e) => setFilledJson(e.target.value)}
                      style={{
                        width: "100%",
                        height: "150px",
                        background: "#0a0a0a",
                        border: filledJson ? "1px solid #238636" : "1px solid #1a1a1a",
                        borderRadius: "6px",
                        color: filledJson ? "#7ee787" : "#444",
                        padding: "0.75rem",
                        fontFamily: "'SF Mono', monospace",
                        fontSize: "0.7rem",
                        lineHeight: 1.4,
                        resize: "vertical"
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="output-side" style={{ minWidth: 0 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: "10px", padding: "1rem", minHeight: "70vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Generated</h3>
                {generatedImage && (
                  <button
                    onClick={downloadImage}
                    style={{
                      padding: "0.3rem 0.7rem",
                      borderRadius: "4px",
                      fontSize: "0.65rem",
                      background: "#1a3320",
                      color: "#4ade80",
                      border: "1px solid #2a4430",
                      cursor: "pointer"
                    }}
                  >
                    Download
                  </button>
                )}
              </div>
              <div
                onClick={() => generatedImage && setIsFullscreen(true)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#080808",
                  borderRadius: "8px",
                  color: "#333",
                  fontSize: "0.75rem",
                  cursor: generatedImage ? "pointer" : "default",
                  overflow: "hidden",
                  minHeight: "320px",
                  padding: "1rem"
                }}
              >
                {generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="Generated"
                    style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
                  />
                ) : (
                  "waiting..."
                )}
              </div>
              {(generating || loading) && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.65rem", color: "#555" }}>{loading ? "Analyzing..." : "Generating..."}</span>
                    <span style={{ fontSize: "0.65rem", color: "#555" }}>processing...</span>
                  </div>
                  <div style={{ width: "100%", height: "3px", background: "#222", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{
                      width: "100%",
                      height: "100%",
                      background: loading ? "#3b82f6" : "#22c55e",
                      borderRadius: "2px",
                      animation: "progress 1.5s ease-in-out infinite",
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progress {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }

        @media (max-width: 900px) {
          .split-layout {
            grid-template-columns: 1fr !important;
          }

          .controls-row {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 640px) {
          .ref-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Fullscreen Modal */}
      {isFullscreen && generatedImage && (
        <div
          onClick={() => setIsFullscreen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            cursor: "pointer"
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadImage();
            }}
            style={{
              position: "absolute",
              top: "1rem",
              right: "4rem",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              background: "#fff",
              color: "#000",
              border: "none",
              cursor: "pointer",
              zIndex: 1001
            }}
          >
            Download
          </button>
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              fontSize: "1.5rem",
              background: "#333",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              zIndex: 1001
            }}
          >
            ×
          </button>
          <img
            src={generatedImage}
            alt="Generated Fullscreen"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              borderRadius: "8px"
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
