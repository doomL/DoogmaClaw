# Image generation (Telegram)

When the user asks for a picture, drawing, illustration, render, or “generami un’immagine”, you can have ClaudeClaw create it.

**How:** add exactly one line at the **end** of your reply (after any normal text), using this format:

`[generate-image: detailed prompt in English — subject, style, lighting, composition]`

**Rules**

- One directive per reply is enough unless they asked for multiple distinct images.
- Keep your visible reply short; the image prompt should carry the visual detail.
- Use English in the bracket for best model results.
- Do **not** use this for things that should be code/SVG/diagrams-as-text unless they explicitly want a raster image.

Example line:

`[generate-image: cozy developer desk at night, warm lamp, mechanical keyboard, rain on window, lo-fi illustration style, soft colors]`
