# OpenOryxa


**Self-hosted management platform for multiple OpenClaw AI agents.**


Run unlimited AI agents on your own VPS — one dashboard, isolated Docker containers, your rules. No subscriptions, no vendor lock-in.


[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-%23FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/weslleyharakawa)


---


## What is OpenOryxa?


OpenOryxa is a management layer on top of [OpenClaw](https://github.com/openclaw/openclaw). Install once on any Ubuntu VPS and get a dashboard to create and manage as many isolated AI agent instances as you need — each with its own config, API key, and messaging channel.


---


## Features


- **One-command install** — Docker, Traefik, SSL, and dashboard set up automatically
- **Multi-agent** — unlimited isolated OpenClaw containers per server
- **Bring your own keys** — OpenAI, Anthropic, Gemini, or any compatible endpoint
- **25+ messaging channels** — WhatsApp, Telegram, Discord, Slack, SMS, Voice, and more
- **Browser automation** — dedicated Chromium per agent
- **Open source** — MIT, no telemetry, no lock-in


---


## Supported Channels


Each agent can connect to multiple channels simultaneously, powered by OpenClaw.


### Core (built-in)


| Channel | Notes |
|---------|-------|
| WhatsApp | Via Baileys. QR pairing from dashboard. Personal number required. |
| Telegram | Bot API. Create via @BotFather. Supports groups. |
| WebChat | Embeddable widget via WebSocket. |


### Popular (plugins)


| Channel | Notes |
|---------|-------|
| Discord | Bot API. Servers, channels, threads, DMs. |
| Slack | Bolt SDK. Workspace bots and DMs. |
