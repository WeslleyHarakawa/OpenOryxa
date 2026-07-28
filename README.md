# OpenOryxa

**Self-hosted management platform for multiple OpenClaw AI agents.**

Run unlimited AI agents on your own VPS — one dashboard, isolated Docker containers, your rules. No subscriptions, no vendor lock-in.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is OpenOryxa?

OpenOryxa is a management layer on top of [OpenClaw](https://github.com/openclaw/openclaw). Install once on any Ubuntu VPS and get a dashboard to create and manage as many isolated AI agent instances as you need — each with its own config, API key, WhatsApp number, model, and browser.

```
Your VPS → Traefik (SSL) → OpenOryxa Dashboard → [Agent 1] [Agent 2] [Agent N...]
```

Each agent runs in its own Docker container. Create new ones from the dashboard in seconds.

---

## Features

- **One-command install** — a single `curl` sets up Docker, Traefik, SSL, and the dashboard
- **Multi-agent** — unlimited OpenClaw instances, each isolated in its own container
- **Bring your own API key** — OpenAI, Anthropic, Gemini, or any compatible provider
- **WhatsApp & Telegram** — QR-code pairing, no third-party bridges
- **Browser automation** — each agent gets a dedicated Chromium instance
- **MIT licensed** — no telemetry, no lock-in, fork and modify freely

---

## Quick Start

```bash
curl -fsSL https://get.oryxa.digital | bash
```

Requires Ubuntu 22.04+ and root access. Takes ~3 minutes.

After install, visit `https://dashboard.yourdomain.com` and create your first agent.

Full guide: [docs.oryxa.digital](https://docs.oryxa.digital)

---

## Documentation

- [Installation](https://docs.oryxa.digital)
- [Creating agents](https://docs.oryxa.digital)
- [WhatsApp setup](https://docs.oryxa.digital)
- [Telegram setup](https://docs.oryxa.digital)
- [Configuration reference](https://docs.oryxa.digital)

---

## Contributing

Issues and pull requests are welcome. Open an issue before submitting large changes.

---

## License

[MIT](LICENSE) — © 2026 Weslley Harakawa
