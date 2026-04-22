<p align="center">
  <img src="images/claudeclaw-banner.svg" alt="DoogmaClaw Banner" />
</p>
<p align="center">
  <img src="images/claudeclaw-wordmark.png" alt="DoogmaClaw Wordmark" />
</p>

<p align="center">
  <img src="https://awesome.re/badge.svg" alt="Awesome" />
  <a href="https://github.com/doomL/DoogmaClaw/stargazers">
    <img src="https://img.shields.io/github/stars/doomL/DoogmaClaw?style=flat-square&color=f59e0b" alt="GitHub Stars" />
  </a>
  <a href="https://github.com/doomL/DoogmaClaw">
    <img src="https://img.shields.io/static/v1?label=downloads&message=personal%20fork&color=2da44e&style=flat-square" alt="Downloads" />
  </a>
  <a href="https://github.com/doomL/DoogmaClaw/commits/master">
    <img src="https://img.shields.io/github/last-commit/doomL/DoogmaClaw?style=flat-square&color=0ea5e9" alt="Last Commit" />
  </a>
  <a href="https://github.com/doomL/DoogmaClaw/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/doomL/DoogmaClaw?style=flat-square&color=a855f7" alt="Contributors" />
  </a>
</p>

<p align="center"><b>DoogmaClaw: A personalized, power-user fork of ClaudeClaw.</b></p>

DoogmaClaw is a custom version of ClaudeClaw designed for maximum automation and advanced agentic workflows. It turns Claude Code into a personal assistant that never sleeps, with enhanced capabilities for Telegram, Discord, and complex task scheduling.

## 🚀 Key Enhancements in DoogmaClaw

Compared to the original ClaudeClaw, this fork includes:
- **Advanced Runner Logic:** Overhauled execution flow for better reliability and complex agentic behaviors.
- **Rich Telegram Integration:** Added support for native Telegram reactions and advanced response formatting.
- **Agentic Routing:** Enhanced model handling and fallback mechanisms.
- **Template Configurations:** Includes a `/template` directory with production-ready configurations, custom skills, and automation scripts (e.g., Daily Email Digest).

## 🛠 Getting Started

### Installation
To use this fork instead of the marketplace version:
```bash
# Remove original if installed
claude plugin marketplace remove moazbuilds/claudeclaw

# Add and install DoogmaClaw
claude plugin marketplace add doomL/DoogmaClaw
claude plugin install claudeclaw
```

Then run:
```
/claudeclaw:start
```

### Using the Templates
The `/template` folder contains example setups. You can copy these to your `~/.claude/` directory to quickly get started with advanced automations.

## Features (Inherited & Enhanced)

### Automation
- **Heartbeat:** Periodic check-ins with configurable intervals and custom prompts.
- **Cron Jobs:** Timezone-aware schedules for repeating or one-time tasks.

### Communication
- **Telegram:** Text, image, and voice support + native reactions.
- **Discord:** DMs, server mentions, slash commands, and isolated thread sessions.

### Reliability and Control
- **Web Dashboard:** Real-time management of jobs and logs.
- **Security Levels:** Granular access control from read-only to full system access.

## Contributors
Based on the original work by [moazbuilds](https://github.com/moazbuilds/claudeclaw).

<a href="https://github.com/doomL/DoogmaClaw/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=doomL/DoogmaClaw" />
</a>
