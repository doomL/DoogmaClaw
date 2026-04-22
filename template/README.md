# claudeclaw-starter

> A production-ready starter for [ClaudeClaw](https://github.com/moazbuilds/claudeclaw) — Claude Code as your personal AI assistant, running 24/7 via Telegram.

---

## What is this?

ClaudeClaw turns Claude Code into a persistent, identity-aware assistant that lives on your server and talks to you over Telegram (or Discord). It's not a chatbot wrapper — it's Claude Code itself, with full access to your tools, files, and shell, controlled from your phone.

This starter gives you a pre-configured setup with:

- **Telegram bot** — chat with your assistant anywhere, send voice messages, images
- **OpenRouter support** — use any model (Claude, GPT, Gemini, Llama...) as primary or fallback
- **Image generation** — ask for an image, get one inline via Gemini or any OpenRouter image model
- **Agentic mode** — auto-routes messages to the right model based on intent (planning vs implementation)
- **Heartbeat daemon** — always-on background process, survives session resets
- **Cron jobs** — schedule recurring prompts (daily reports, server checks, reminders)
- **Web UI** — optional browser dashboard at `localhost:4632`
- **Plugin ecosystem** — one-command install for code review, browser automation, loops, hooks, and more

---

## Quick start

```bash
git clone https://github.com/doomL/claudeclaw-starter my-claudeclaw
cd my-claudeclaw
chmod +x setup.sh && ./setup.sh
```

Copy the settings template and fill in your credentials:

```bash
cp config/claudeclaw-settings.template.json .claude/claudeclaw/settings.json
```

Edit `.claude/claudeclaw/settings.json` — at minimum set:
- `telegram.token` — your bot token from [@BotFather](https://t.me/BotFather)
- `telegram.allowedUserIds` — your Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot))
- `api` — your Anthropic API key (or leave empty to use Claude Code's default auth)
- `fallback.api` — optional OpenRouter key for fallback/image models

Then edit `CLAUDE.md` — give your assistant a name, personality, and fill in your context.

```bash
claude .
```

---

## Telegram features

Once your bot is running, you can:

| What | How |
|------|-----|
| Send a message | Just text it |
| Send a voice note | Transcribed automatically via Whisper |
| Send an image | Attached as context to your message |
| Ask for an image | "generate me a..." → image comes back inline |
| Schedule a task | "remind me to check the server every day at 8am" |
| Run a one-shot prompt | `/start "summarize my git log"` |

---

## Agentic model routing

ClaudeClaw can automatically pick the right model based on what you're asking:

```json
"agentic": {
  "enabled": true,
  "modes": [
    { "name": "planning", "model": "opus", "keywords": ["plan", "design", "research"] },
    { "name": "implementation", "model": "sonnet", "keywords": ["code", "fix", "deploy"] }
  ]
}
```

Use OpenRouter models as fallback: `"model": "openrouter/google/gemini-2.5-pro"`.

---

## Plugins

After setup, install plugins inside Claude Code with `/install-skill`:

| Plugin | What it does |
|--------|--------------|
| `ralph-loop@claude-plugins-official` | Autonomous loop mode — runs prompts on repeat |
| `hookify@claude-plugins-official` | Prevent unwanted behaviors with pre-tool hooks |
| `commit-commands@claude-plugins-official` | `/commit`, `/push`, `/pr` shortcuts |
| `code-review@claude-plugins-official` | AI code review on your diffs |
| `pr-review-toolkit@claude-plugins-official` | Full PR review suite |
| `dev-browser@dev-browser-marketplace` | Browser automation with persistent state |
| `plugin-dev@claude-plugins-official` | Tools for building your own plugins |

---

## File structure

```
.
├── CLAUDE.md                              # Assistant identity + your personal context
├── config/
│   ├── settings.json                      # Claude Code: registers claudeclaw marketplace
│   └── claudeclaw-settings.template.json  # ClaudeClaw: credentials + behavior template
├── setup.sh                               # One-shot setup script
└── README.md
```

The ClaudeClaw runtime config lives at `.claude/claudeclaw/settings.json` inside your project — **not** the Claude Code `settings.json`. Two different files, both important.

---

## Real things people have done with this

This isn't a toy. Here's what's been built by talking to the assistant from a phone:

**Mobile app CI/CD — from Telegram**
> "build me a new APK"

The assistant SSHes into the server, runs `expo eas build`, monitors the build log, and sends back the `.apk` link when done. No laptop needed.

**Server security monitoring — automated**

A cron job runs every night and does exactly this:
```
check docker container logs for errors, failed auth attempts, and
anything that looks like an intrusion — summarize and alert me
```
If something looks off, it messages you on Telegram unprompted.

**WordPress breach forensics**
> "something's wrong with the site"

The assistant dug through PHP files, found injected malware, identified a rogue admin account added via the database, cleaned it up, and hardened the config — all while narrating what it found.

**Self-improvement loop**
> "install the hookify plugin and configure it to prevent that thing you keep doing"

The assistant installs its own plugins, edits its own `CLAUDE.md`, writes new skills, and evolves its behavior based on your feedback. The setup you're running right now is the result of a session like this.

**Tournament apps — built and deployed from Telegram**
> "make me a darts tournament bracket for tonight, with a paid entry system"

Full HTML/JS single-page app, built and ready to open in a browser. No IDE open.

**Content pipelines and LLM eval infrastructure**

Configured n8n workflows, Qdrant vector caches, LLM evaluation prompts, Spring Boot microservices — all while explaining what each piece does and why.

---

The pattern is the same every time: you describe what you need, the assistant does the work — reading files, running commands, writing code, monitoring processes — and reports back. The only interface is Telegram.

---

## Credits

Built on [ClaudeClaw](https://github.com/moazbuilds/claudeclaw) by [moazbuilds](https://github.com/moazbuilds).
