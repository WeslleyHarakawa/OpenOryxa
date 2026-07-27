# OpenOryxa

**Self-hosted AI agent management platform.** Deploy and manage OpenClaw AI agents on your own VPS with one command.

```bash
curl -fsSL https://get.oryxa.digital | bash
```

> MIT License · Open Source · Self-hosted
>
> ---
>
> ## What is OpenOryxa?
>
> OpenOryxa is an open source platform for deploying and managing AI agents powered by [OpenClaw](https://github.com/openclaw). It gives you a web dashboard to create, configure, and monitor multiple AI agents — each running in its own isolated Docker container on infrastructure you control.
>
> - **[*] One-command install** — A single curl command sets up everything: Docker, Traefik with automatic SSL, and the management dashboard.
> - - **[*] Multi-agent management** — Create and manage multiple AI agents from a single dashboard. Each agent runs in its own isolated container.
>   - - **[*] Bring your own API keys** — Connect OpenAI, Anthropic, Gemini, or any compatible provider. Your keys stay on your server.
>     - - **[*] WhatsApp & Telegram** — Connect agents to WhatsApp and Telegram with built-in pairing support.
>       - - **[*] Browser automation** — Each agent gets a dedicated Chromium instance for web browsing and automation.
>         - - **[*] Fully open source** — MIT licensed. Fork it, modify it, run it anywhere. No telemetry, no phoning home.
>          
>           - ---
>
> ## Requirements
>
> - Ubuntu 22.04+ VPS (1GB RAM minimum)
> - - Ports 80 and 443 open
>   - - A domain name pointing to your server
>     - - At least one AI provider API key (OpenAI, Anthropic, Gemini, etc.)
>      
>       - ---
>
> ## Quick Start
>
> ```bash
> curl -fsSL https://get.oryxa.digital | bash
> ```
>
> The installer will:
> 1. Install Docker and Docker Compose
> 2. 2. Deploy Traefik with automatic Let's Encrypt SSL
>    3. 3. Pull and start the OpenOryxa manager
>       4. 4. Print your dashboard URL and admin password
>         
>          5. ---
>         
>          6. ## Documentation
>         
>          7. Full documentation at **[oryxa.digital/docs](https://oryxa.digital/docs)**
>
> - [Install](https://oryxa.digital/docs#install)
> - - [Configure](https://oryxa.digital/docs#configure)
>   - - [Create an agent](https://oryxa.digital/docs#create-agent)
>     - - [WhatsApp setup](https://oryxa.digital/docs#whatsapp)
>       - - [Telegram setup](https://oryxa.digital/docs#telegram)
>         - - [AI Providers](https://oryxa.digital/docs#providers)
>           - - [Troubleshooting](https://oryxa.digital/docs#troubleshooting)
>            
>             - ---
>
> ## License
>
> MIT — see [LICENSE](./LICENSE)
>
> ---
>
> Made by [@weslleyharakawa](https://x.com/weslleyharakawa)
