---
name: telegram-react
description: Add Telegram reaction directives in assistant replies. Use when the user asks for Telegram reaction tags, react directives, emoji reactions, or wants reply text to include reaction metadata. Trigger phrases include "telegram react", "reaction directive", "add react", "emoji reaction", "react tag", and "telegram reply format".
---

# Telegram Reaction Directive

When replying for Telegram, you can include a reaction directive anywhere in the output.

**Format:** square brackets, the word react, a colon, then one emoji, then closing square brackets. Example pattern: react colon fire emoji, wrapped in square brackets (no spaces inside the brackets).

**Human-readable example:** after your text, you might end with a space, then open bracket, react, colon, the fire emoji character, close bracket.

**Runtime behavior:**

- The bot removes all reaction directives from the outgoing text.
- It applies the first valid directive as a Telegram reaction to the user's message.
- The remaining text is sent normally.

Do not use angle brackets or HTML-like placeholders in the directive; only a real Unicode emoji after the colon.
