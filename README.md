# OpenOryxa

**AI Agents SaaS based in OpenClaw. Self-hosted management platform for multiple OpenClaw AI agents.**

Run unlimited AI agents on your own VPS — one dashboard, isolated Docker containers, your rules. No subscriptions, no vendor lock-in.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-%23FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/weslleyharakawa)

🌐 [oryxa.digital](https://oryxa.digital) · 📖 [docs.oryxa.digital](https://docs.oryxa.digital)

---

## What is OpenOryxa?

OpenOryxa is a self-hosted management platform for multiple OpenClaw AI agents. Install once on any Ubuntu VPS and get a dashboard to create and manage as many isolated agent instances as you need — each with its own phone number, API key, model, and dedicated Chromium browser for web automation.

Unlike a single OpenClaw instance, OpenOryxa lets you run **multiple agents in the same Telegram or WhatsApp group** — each with a different personality, trigger, or role. Think of it as your own private **SaaS of OpenClaw agents**.

---

## Features

- **One-command install** — Docker, Traefik, SSL, and dashboard set up automatically
- **Unlimited agents** — each agent runs in its own isolated Docker container
- **Multiple agents in the same group** — different personalities coexisting in the same WhatsApp or Telegram group
- **Multi-model** — OpenAI, Anthropic, Google Gemini, Groq, Ollama, and any OpenAI-compatible API
- **Chromium browser per agent** — each agent gets its own dedicated browser for web automation
- **Wildcard SSL** — automatic HTTPS for `*.yourdomain.com` via Cloudflare + Let's Encrypt
- **Zero platform fee** — MIT licensed, free forever

---

## Quick Start

```bash
curl -fsSL https://get.oryxa.digital | bash
```

The installer will ask for:

- **Domain** — e.g. `myagents.com`
- **Admin email** — for SSL certificate notifications
- **Cloudflare API token** — optional, for wildcard SSL
- **Admin password** — or auto-generate a secure one
- **AI provider** — OpenAI, Anthropic, Google Gemini, Groq, or Ollama
- **API key** — for your chosen provider

Then visit `https://dashboard.yourdomain.com` to create your first agent.

---

## Documentation

Full docs at **[docs.oryxa.digital](https://docs.oryxa.digital)**

- [Install guide](https://docs.oryxa.digital#install)
- [Getting API Keys](https://docs.oryxa.digital#api-keys)
- [Connect WhatsApp](https://docs.oryxa.digital#whatsapp)
- [Connect Telegram](https://docs.oryxa.digital#telegram)
- [AI Providers](https://docs.oryxa.digital#providers)

---

## Contributing

Pull requests welcome. Open an issue first for major changes.

---

## License

[MIT](LICENSE) © 2026 [Weslley Harakawa](https://github.com/WeslleyHarakawa)
