// The transcription prompt sent to Gemini (tier 1).
// Instructs the model to emit ONLY the transcript JSON matching transcript-schema.mjs.

export const TRANSCRIBE_PROMPT = `You are a precise UI transcription engine. Transcribe this screenshot into a JSON layout description that a text-only model can turn into component code.

Return ONLY valid JSON (no markdown fences, no commentary) with EXACTLY this shape:

{
  "meta": { "image": "<filename>", "width": 1440, "height": 900 },
  "tokens": {
    "colors": [ { "role": "background", "hex": "#0f172a", "share": 0.61 } ],
    "fonts": [ { "role": "heading", "family": "sans-serif", "weight": 700, "size": 48 } ],
    "spacing": { "base": 8, "gap": 16 }
  },
  "layout": [
    { "id": "nav", "type": "nav", "x": 0, "y": 0, "w": 1440, "h": 64, "bg": "#0f172a",
      "children": [
        { "id": "logo", "type": "text", "text": "Acme", "style": { "size": 18, "weight": 700, "color": "#ffffff" } }
      ] }
  ],
  "images": [ { "id": "img1", "alt": "dashboard preview", "x": 320, "y": 200, "w": 800, "h": 400 } ],
  "icons": [ { "id": "ic1", "description": "star", "x": 100, "y": 90, "w": 16, "h": 16 } ]
}

Rules:
- type is one of: nav, hero, section, card, footer, text, group, button, input, image, icon, divider, container.
- Walk the UI top-to-bottom, left-to-right. Nest children inside their visual container.
- Capture EXACT visible text as "text" on text/button/input nodes. Never invent copy.
- Approximate hex colors from the pixels. share is the rough fraction of pixels using that color.
- x/y/w/h are absolute pixels relative to the full image dimensions.
- Leaf nodes: text, button, input, image, icon, divider. Container types hold children.
- No lorem ipsum. No extra JSON fields beyond the shape above.`;
