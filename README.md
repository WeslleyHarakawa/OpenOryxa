# OpenOryxa

**Self-hosted management platform for multiple OpenClaw AI agents.**

Run unlimited AI agents on your own VPS — one dashboard, isolated Docker containers, your rules. No subscriptions, no vendor lock-in.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
| Signal | Privacy-focused. Requires dedicated number. |
| SMS | Via Twilio webhook. |
| Voice Call | Telephony via Plivo, Telnyx, or Twilio. |
| LINE | Messaging API bot. |
| Twitch | Chat bot via IRC. |
| IRC | Classic IRC servers. |

### Enterprise & others

| Channel | Notes |
|---------|-------|
| Microsoft Teams | Bot Framework with enterprise support. |
| Google Chat | HTTP webhook. Works with Google Workspace. |
| Mattermost | Bot API with WebSocket. |
| Matrix | Open federated protocol. |
| Nextcloud Talk | Self-hosted Nextcloud chat. |
| WeChat | iLink bot via QR login. |
| Zalo | Vietnamese messenger. Bot API + QR variants. |
| Feishu / Lark | Bot via WebSocket. |
| Nostr | Decentralized DMs via NIP-04. |
| Synology Chat | NAS chat via webhooks. |

---

## Quick Start

```bash
curl -fsSL https://get.oryxa.digital | bash
```

Requires Ubuntu 22.04+ with at least 1GB RAM, ports 80/443 open, and a domain pointed to your server.

---

## Documentation

Full docs at [docs.oryxa.digital](https://docs.oryxa.digital):

- [Getting started](https://docs.oryxa.digital)
- [Creating agents](https://docs.oryxa.digital)
- [WhatsApp setup](https://docs.oryxa.digital)
- [Telegram setup](https://docs.oryxa.digital)
- [Supported channels](https://docs.oryxa.digital/#channels)
- [Configuration reference](https://docs.oryxa.digital)

---

## Contributing

Issues and pull requests are welcome. Open an issue before submitting large changes.

---

## License

[MIT](LICENSE) — © 2026 [Weslley Harakawa](https://github.com/WeslleyHarakawa)
