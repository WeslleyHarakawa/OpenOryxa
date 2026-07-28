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
- **Unlimited agents** — each agent runs in its own isolated Docker container
- **25+ messaging channels** — WhatsApp, Telegram, Discord, Slack and more (see [OpenClaw docs](https://docs.openclaw.ai/channels))
- **Multi-model** — OpenAI, Anthropic, Google Gemini, Ollama, and any OpenAI-compatible API
- **Wildcard SSL** — automatic HTTPS for `*.yourdomain.com` via Cloudflare + Let's Encrypt
- **Browser automation** — Playwright-powered web browsing per agent
- **Zero platform fee** — MIT licensed, free forever

---

## Quick Start

```bash
curl -fsSL https://get.oryxa.digital | bash
```

The installer will prompt you for:
1. **Domain** — e.g. `yourdomain.com`
2. **Admin email** — for SSL certificate issuance
3. **Cloudflare API token** — for wildcard SSL (optional; leave blank for HTTP challenge)
4. **Admin password** — auto-generated if left blank

Then it installs Docker, deploys Traefik + the dashboard, and prints:

```
Dashboard:  https://dashboard.yourdomain.com
Password:   <generated-password>
```

> **Requirements:** Ubuntu 22.04+ or Debian 11+, 1GB RAM minimum, ports 80 and 443 open.

---

## Documentation

- [OpenOryxa Docs](https://docs.oryxa.digital)
- [OpenClaw Docs](https://docs.openclaw.ai)
- [OpenClaw Channels](https://docs.openclaw.ai/channels)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## License

[MIT](LICENSE) — © 2026 [Weslley Harakawa](https://github.com/WeslleyHarakawa)
