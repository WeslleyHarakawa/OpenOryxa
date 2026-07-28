const PROVIDERS = {
    openai:     { label: 'OpenAI API Key',       placeholder: 'sk-proj-...' },
    gemini:     { label: 'Google Gemini API Key', placeholder: 'AIzaSy...' },
    xai:        { label: 'xAI (Grok) API Key',   placeholder: 'xai-...' },
    groq:       { label: 'Groq API Key',         placeholder: 'gsk_...' },
    mistral:    { label: 'Mistral API Key',      placeholder: 'mst-...' },
    deepseek:   { label: 'DeepSeek API Key',     placeholder: 'sk-...' },
    openrouter: { label: 'OpenRouter API Key',   placeholder: 'sk-or-...' },
    zai:        { label: 'Z.AI API Key',         placeholder: '...' },
};

// LLM models available per-instance (all confirmed with tool use via OpenRouter).
// Mirror of server.js ALLOWED_MODELS — keep in sync.
const MODELS = [
    { id: 'openrouter/google/gemini-2.5-flash',                  label: 'Gemini 2.5 Flash',     hint: '$0.30/$2.50' },
    { id: 'openrouter/meta-llama/llama-3.3-70b-instruct',        label: 'Llama 3.3 70B',        hint: '$0.10/$0.32' },
    { id: 'openrouter/x-ai/grok-4-fast',                          label: 'Grok 4 Fast',          hint: '$0.20/$0.50' },
    { id: 'openrouter/x-ai/grok-4.1-fast',                        label: 'Grok 4.1 Fast',        hint: '$0.20/$0.50' },
    { id: 'openrouter/qwen/qwen-2.5-72b-instruct',               label: 'Qwen 2.5 72B',         hint: '$0.13/$0.40' },
    { id: 'openrouter/qwen/qwen3-coder',                          label: 'Qwen3 Coder',          hint: '$0.22/$1.80' },
    { id: 'openrouter/deepseek/deepseek-chat-v3-0324',           label: 'DeepSeek V3',          hint: '$0.20/$0.77' },
    { id: 'openrouter/openai/gpt-4.1-mini',                       label: 'GPT-4.1 Mini',         hint: '$0.40/$1.60' },
    { id: 'openrouter/mistralai/mistral-small-3.2-24b-instruct', label: 'Mistral Small 3.2',    hint: '$0.05/$0.15' },
];
const DEFAULT_MODEL = 'openrouter/google/gemini-2.5-flash';
let avatarBust = Date.now();

// ===== I18N (PT default, EN, ES) =====
// Strings are looked up via `t('key')`. Markup elements with
// `data-i18n="key"` get their innerText replaced by `applyI18n()`.
// Inputs with `data-i18n-placeholder="key"` get their placeholder set.
const I18N = {
    pt: {
        'login.subtitle': 'Entre para gerenciar seus OpenOryxa AI Agents.',
        'login.email': 'Email',
        'login.email_ph': 'você@dominio.com',
        'login.password': 'Senha',
        'login.submit': 'Entrar',
        'login.error_generic': 'falha',
        'login.error_connection': 'erro de conexão',
        'nav.dashboard': 'Dashboard',
        'nav.instances': 'Instâncias',
        'nav.settings': 'Configurações',
        'nav.users': 'Usuários',
        'nav.logout': 'Sair',
        'role.admin': 'Administrator',
        'role.admin_short': 'Admin',
        'role.user': 'Usuário',
        'topbar.search_ph': 'Buscar agentes...',
        'topbar.new_agent': 'Novo Agente',
        'stats.vps_ip': 'VPS na Contabo',
        'stats.base_domain': 'Domínio Base',
        'stats.active_agents': 'Agentes Ativos',
        'card.online': 'Online',
        'card.offline': 'Offline',
        'card.edit': 'Editar',
        'card.pause': 'Pausar',
        'card.start': 'Iniciar',
        'card.delete': 'Deletar',
        'card.connect_whatsapp': 'Conectar WhatsApp',
        'card.connect_telegram': 'Conectar Telegram',
        'card.open_ui': 'Abrir UI',
        'detail.back': 'Voltar',
        'modal.detail_card_en': 'Detalhes em inglês (página de ficha)',
        'modal.detail_card_en_help': 'O que aparece na página de detalhes da agente — texto público em inglês.',
        'empty.title': 'Nenhum agente',
        'empty.admin': 'Comece criando seu primeiro agente OpenOryxa.',
        'empty.user': 'Nenhuma instância atribuída a você ainda.',
        'settings.llm_provider': 'Provedor de LLM',
        'settings.llm_provider_help': 'A chave do provedor selecionado será usada pelos agentes.',
        'settings.default_provider': 'Provedor padrão',
        'settings.integrations': 'Integrações',
        'settings.saved': 'salvo ✓',
        'settings.save_error': 'erro ao salvar',
        'users.new': 'Novo Usuário',
        'users.col_name': 'Nome',
        'users.col_email': 'Email',
        'users.col_role': 'Papel',
        'users.col_instances': 'Instâncias',
        'modal.new_agent_title': 'Criar Novo Agente OpenOryxa',
        'modal.subdomain': 'Nome do Agente (Subdomínio)',
        'modal.subdomain_ph': 'ex: financeiro',
        'modal.owner': 'Dono (usuário)',
        'modal.owner_none': '— sem dono (só admin) —',
        'modal.onboarding': 'Onboarding do Agente',
        'modal.onboarding_help': 'Responde o que o OpenOryxa perguntaria no primeiro contato.',
        'modal.agent_name': 'Nome do agente',
        'modal.example_maria': 'ex: Maria',
        'modal.example_joana': 'ex: Joana',
        'modal.example_finance': 'ex: Financeiro',
        'modal.example_person': 'ex: João Silva',
        'modal.creature': 'Tipo (creature)',
        'modal.creature_assistant': 'Assistente',
        'modal.creature_robot': 'Robô',
        'modal.creature_familiar': 'Familiar',
        'modal.creature_machine_spirit': 'Espírito da máquina',
        'modal.vibe': 'Vibe',
        'modal.vibe_pro': 'Profissional e direto',
        'modal.vibe_warm': 'Caloroso e acolhedor',
        'modal.vibe_sharp': 'Afiado e sarcástico',
        'modal.vibe_calm': 'Calmo e paciente',
        'modal.vibe_playful': 'Brincalhão',
        'modal.emoji': 'Emoji',
        'modal.human_name': 'Nome do humano',
        'modal.department': 'Departamento',
        'modal.ai_email': 'Email da IA',
        'modal.instructions': 'Instruções / Contexto',
        'modal.instructions_ph': 'Você é um agente do departamento financeiro...',
        'modal.provision': 'Provisionar Agente',
        'modal.edit_agent': 'Editar Agente',
        'modal.edit_user': 'Editar Usuário',
        'modal.repeat_password': 'Repetir senha',
        'modal.new_password': 'Nova senha',
        'modal.password_optional_hint': '(deixe em branco para manter)',
        'actions.cancel': 'Cancelar',
        'actions.save': 'Salvar',
        'actions.create': 'Criar',
        'actions.saving': 'Salvando...',
        'wa.title': 'Conectar WhatsApp',
        'wa.intro': 'Iniciando sessão... Escaneie o QR abaixo no WhatsApp → Aparelhos Conectados → Conectar um aparelho.',
        'wa.connected': 'Conectado!',
        'wa.preparing': 'Preparando sessão...',
        'wa.timeout': 'Timeout (4 min). Feche e tente novamente.',
        'alerts.session_expired': 'Sessão expirou — entre novamente.',
        'alerts.error_prefix': 'Erro: ',
        'alerts.delete_confirm': 'Excluir {name}? (remove container, cert LE, vínculo de usuário)',
        'alerts.password_mismatch': 'Senhas não conferem',
        'provision.starting': '⏳ Iniciando...',
        'provision.proxy_cut': '⏳ Proxy cortou a resposta. Verificando se a instância subiu...',
        'provision.container_ok': '⏳ Container criado. Aguardando SSL + HTTPS...',
        'provision.ready': '✅ Tudo pronto, abrindo...',
        'provision.timeout': '⚠️ Timeout aguardando readiness. Verifique em Instâncias.',
        'provision.provisioning': 'Provisionando...',
        'provision.error_prefix': '❌ Erro: ',
        'provision.container_label': 'Container',
        'provision.cert_label': 'Certificado SSL',
        'provision.https_label': 'HTTPS público',
        'provision.confirm_open': 'A instância {name} {parts}. Abrir mesmo assim? (pode retornar 404)',
        'provision.starting_container': 'container ainda iniciando',
        'provision.starting_cert': 'certificado SSL ainda sendo emitido',
        'provision.starting_https': 'HTTPS ainda não responde',
        'provision.not_ready': 'não está pronta',
        'modal.llm_model': 'Modelo de IA',
        'modal.llm_model_help': '— via OpenRouter, com tool use validado',
        'modal.api_key': 'Chave de API',
        'modal.api_key_help': '— sobrepõe a chave global para este agente',
        'modal.api_key_ph': 'sk-... (deixar vazio = usar chave global)',
        'modal.api_key_ph_set': '●●●● (chave configurada — deixar vazio para manter)',
        'modal.avatar_label': 'Foto do agente',
        'modal.avatar_change': 'Trocar foto',
        'modal.company_name_help': '— opcional, aparece como @empresa',
        'modal.topics_help': '— um por linha',
    },
    en: {
        'login.subtitle': 'Sign in to manage your OpenOryxa AI Agents.',
        'login.email': 'Email',
        'login.email_ph': 'you@domain.com',
        'login.password': 'Password',
        'login.submit': 'Sign in',
        'login.error_generic': 'failed',
        'login.error_connection': 'connection error',
        'nav.dashboard': 'Dashboard',
        'nav.instances': 'Instances',
        'nav.settings': 'Settings',
        'nav.users': 'Users',
        'nav.logout': 'Sign out',
        'role.admin': 'Administrator',
        'role.admin_short': 'Admin',
        'role.user': 'User',
        'topbar.search_ph': 'Search agents...',
        'topbar.new_agent': 'New Agent',
        'stats.vps_ip': 'VPS on Contabo',
        'stats.base_domain': 'Base Domain',
        'stats.active_agents': 'Active Agents',
        'card.online': 'Online',
        'card.offline': 'Offline',
        'card.edit': 'Edit',
        'card.pause': 'Pause',
        'card.start': 'Start',
        'card.delete': 'Delete',
        'card.connect_whatsapp': 'Connect WhatsApp',
        'card.connect_telegram': 'Connect Telegram',
        'card.open_ui': 'Open UI',
        'detail.back': 'Back',
        'modal.detail_card_en': 'English profile details',
        'modal.detail_card_en_help': "What shows on the agent's detail page — public English copy.",
        'empty.title': 'No agents yet',
        'empty.admin': 'Start by creating your first OpenOryxa agent.',
        'empty.user': 'No instance assigned to you yet.',
        'settings.llm_provider': 'LLM Provider',
        'settings.llm_provider_help': 'The selected provider key will be used by the agents.',
        'settings.default_provider': 'Default provider',
        'settings.integrations': 'Integrations',
        'settings.saved': 'saved ✓',
        'settings.save_error': 'save error',
        'users.new': 'New User',
        'users.col_name': 'Name',
        'users.col_email': 'Email',
        'users.col_role': 'Role',
        'users.col_instances': 'Instances',
        'modal.new_agent_title': 'Create New OpenOryxa Agent',
        'modal.subdomain': 'Agent Name (Subdomain)',
        'modal.subdomain_ph': 'e.g. finance',
        'modal.owner': 'Owner (user)',
        'modal.owner_none': '— no owner (admin only) —',
        'modal.onboarding': 'Agent Onboarding',
        'modal.onboarding_help': 'Answer what OpenOryxa would ask on first contact.',
        'modal.agent_name': 'Agent name',
        'modal.example_maria': 'e.g. Maria',
        'modal.example_joana': 'e.g. Joanna',
        'modal.example_finance': 'e.g. Finance',
        'modal.example_person': 'e.g. John Smith',
        'modal.creature': 'Type (creature)',
        'modal.creature_assistant': 'Assistant',
        'modal.creature_robot': 'Robot',
        'modal.creature_familiar': 'Familiar',
        'modal.creature_machine_spirit': 'Machine Spirit',
        'modal.vibe': 'Vibe',
        'modal.vibe_pro': 'Professional and direct',
        'modal.vibe_warm': 'Warm and welcoming',
        'modal.vibe_sharp': 'Sharp and sarcastic',
        'modal.vibe_calm': 'Calm and patient',
        'modal.vibe_playful': 'Playful',
        'modal.emoji': 'Emoji',
        'modal.human_name': 'Human name',
        'modal.department': 'Department',
        'modal.ai_email': 'AI email',
        'modal.instructions': 'Instructions / Context',
        'modal.instructions_ph': 'You are an agent of the finance department...',
        'modal.provision': 'Provision Agent',
        'modal.edit_agent': 'Edit Agent',
        'modal.edit_user': 'Edit User',
        'modal.repeat_password': 'Repeat password',
        'modal.new_password': 'New password',
        'modal.password_optional_hint': '(leave blank to keep)',
        'actions.cancel': 'Cancel',
        'actions.save': 'Save',
        'actions.create': 'Create',
        'actions.saving': 'Saving...',
        'wa.title': 'Connect WhatsApp',
        'wa.intro': 'Starting session... Scan the QR below in WhatsApp → Linked Devices → Link a device.',
        'wa.connected': 'Connected!',
        'wa.preparing': 'Preparing session...',
        'wa.timeout': 'Timeout (4 min). Close and try again.',
        'alerts.session_expired': 'Session expired — please sign in again.',
        'alerts.error_prefix': 'Error: ',
        'alerts.delete_confirm': 'Delete {name}? (removes container, LE cert, user link)',
        'alerts.password_mismatch': 'Passwords do not match',
        'provision.starting': '⏳ Starting...',
        'provision.proxy_cut': '⏳ Proxy cut the response. Checking if the instance came up...',
        'provision.container_ok': '⏳ Container created. Waiting for SSL + HTTPS...',
        'provision.ready': '✅ All set, opening...',
        'provision.timeout': '⚠️ Timeout waiting for readiness. Check in Instances.',
        'provision.provisioning': 'Provisioning...',
        'provision.error_prefix': '❌ Error: ',
        'provision.container_label': 'Container',
        'provision.cert_label': 'SSL Certificate',
        'provision.https_label': 'Public HTTPS',
        'provision.confirm_open': 'Instance {name} {parts}. Open anyway? (may return 404)',
        'provision.starting_container': 'container still starting',
        'provision.starting_cert': 'SSL certificate still being issued',
        'modal.llm_model': 'AI Model',
        'modal.llm_model_help': '— via OpenRouter, tool use validated',
        'modal.api_key': 'API Key',
        'modal.api_key_help': '— overrides the global key for this agent',
        'modal.api_key_ph': 'sk-... (leave blank = use global key)',
        'modal.api_key_ph_set': '●●●● (key configured — leave blank to keep)',
        'modal.avatar_label': 'Agent photo',
        'modal.avatar_change': 'Change photo',
        'modal.company_name_help': '— optional, shows as @company',
        'modal.topics_help': '— one per line',
        'provision.starting_https': 'HTTPS not responding yet',
        'provision.not_ready': 'is not ready',
    },
    es: {
        'login.subtitle': 'Inicia sesión para gestionar tus OpenOryxa AI Agents.',
        'login.email': 'Correo',
        'login.email_ph': 'tu@dominio.com',
        'login.password': 'Contraseña',
        'login.submit': 'Entrar',
        'login.error_generic': 'fallo',
        'login.error_connection': 'error de conexión',
        'nav.dashboard': 'Panel',
        'nav.instances': 'Instancias',
        'nav.settings': 'Ajustes',
        'nav.users': 'Usuarios',
        'nav.logout': 'Salir',
        'role.admin': 'Administrador',
        'role.admin_short': 'Admin',
        'role.user': 'Usuario',
        'topbar.search_ph': 'Buscar agentes...',
        'topbar.new_agent': 'Nuevo Agente',
        'stats.vps_ip': 'VPS en Contabo',
        'stats.base_domain': 'Dominio Base',
        'stats.active_agents': 'Agentes Activos',
        'card.online': 'En línea',
        'card.offline': 'Fuera de línea',
        'card.edit': 'Editar',
        'card.pause': 'Pausar',
        'card.start': 'Iniciar',
        'card.delete': 'Eliminar',
        'card.connect_whatsapp': 'Conectar WhatsApp',
        'card.connect_telegram': 'Conectar Telegram',
        'card.open_ui': 'Abrir UI',
        'detail.back': 'Volver',
        'modal.detail_card_en': 'Detalles en inglés (página de ficha)',
        'modal.detail_card_en_help': 'Lo que aparece en la página de detalles del agente — texto público en inglés.',
        'empty.title': 'Sin agentes',
        'empty.admin': 'Comienza creando tu primer agente OpenOryxa.',
        'empty.user': 'Aún no tienes ninguna instancia asignada.',
        'settings.llm_provider': 'Proveedor de LLM',
        'settings.llm_provider_help': 'La clave del proveedor seleccionado será usada por los agentes.',
        'settings.default_provider': 'Proveedor por defecto',
        'settings.integrations': 'Integraciones',
        'settings.saved': 'guardado ✓',
        'settings.save_error': 'error al guardar',
        'users.new': 'Nuevo Usuario',
        'users.col_name': 'Nombre',
        'users.col_email': 'Correo',
        'users.col_role': 'Rol',
        'users.col_instances': 'Instancias',
        'modal.new_agent_title': 'Crear Nuevo Agente OpenOryxa',
        'modal.subdomain': 'Nombre del Agente (Subdominio)',
        'modal.subdomain_ph': 'ej: finanzas',
        'modal.owner': 'Dueño (usuario)',
        'modal.owner_none': '— sin dueño (solo admin) —',
        'modal.onboarding': 'Onboarding del Agente',
        'modal.onboarding_help': 'Responde lo que OpenOryxa preguntaría en el primer contacto.',
        'modal.agent_name': 'Nombre del agente',
        'modal.example_maria': 'ej: María',
        'modal.example_joana': 'ej: Juana',
        'modal.example_finance': 'ej: Finanzas',
        'modal.example_person': 'ej: Juan Pérez',
        'modal.creature': 'Tipo (creature)',
        'modal.creature_assistant': 'Asistente',
        'modal.creature_robot': 'Robot',
        'modal.creature_familiar': 'Familiar',
        'modal.creature_machine_spirit': 'Espíritu de la máquina',
        'modal.vibe': 'Vibe',
        'modal.vibe_pro': 'Profesional y directo',
        'modal.vibe_warm': 'Cálido y acogedor',
        'modal.vibe_sharp': 'Agudo y sarcástico',
        'modal.vibe_calm': 'Tranquilo y paciente',
        'modal.vibe_playful': 'Juguetón',
        'modal.emoji': 'Emoji',
        'modal.human_name': 'Nombre del humano',
        'modal.department': 'Departamento',
        'modal.ai_email': 'Correo de la IA',
        'modal.instructions': 'Instrucciones / Contexto',
        'modal.instructions_ph': 'Eres un agente del departamento de finanzas...',
        'modal.provision': 'Aprovisionar Agente',
        'modal.edit_agent': 'Editar Agente',
        'modal.edit_user': 'Editar Usuario',
        'modal.repeat_password': 'Repetir contraseña',
        'modal.new_password': 'Nueva contraseña',
        'modal.password_optional_hint': '(dejar en blanco para mantener)',
        'actions.cancel': 'Cancelar',
        'actions.save': 'Guardar',
        'actions.create': 'Crear',
        'actions.saving': 'Guardando...',
        'wa.title': 'Conectar WhatsApp',
        'wa.intro': 'Iniciando sesión... Escanea el QR en WhatsApp → Dispositivos vinculados → Vincular un dispositivo.',
        'wa.connected': '¡Conectado!',
        'wa.preparing': 'Preparando sesión...',
        'wa.timeout': 'Timeout (4 min). Cierra y vuelve a intentar.',
        'alerts.session_expired': 'Sesión expirada — inicia sesión de nuevo.',
        'alerts.error_prefix': 'Error: ',
        'alerts.delete_confirm': '¿Eliminar {name}? (quita contenedor, cert LE, vínculo de usuario)',
        'alerts.password_mismatch': 'Las contraseñas no coinciden',
        'provision.starting': '⏳ Iniciando...',
        'provision.proxy_cut': '⏳ El proxy cortó la respuesta. Verificando si la instancia se levantó...',
        'provision.container_ok': '⏳ Contenedor creado. Esperando SSL + HTTPS...',
        'provision.ready': '✅ Todo listo, abriendo...',
        'provision.timeout': '⚠️ Timeout esperando readiness. Verifica en Instancias.',
        'provision.provisioning': 'Aprovisionando...',
        'provision.error_prefix': '❌ Error: ',
        'provision.container_label': 'Contenedor',
        'provision.cert_label': 'Certificado SSL',
        'provision.https_label': 'HTTPS público',
        'provision.confirm_open': 'La instancia {name} {parts}. ¿Abrir igual? (puede dar 404)',
        'provision.starting_container': 'contenedor aún iniciando',
        'provision.starting_cert': 'certificado SSL aún emitiéndose',
        'provision.starting_https': 'HTTPS aún no responde',
        'provision.not_ready': 'no está lista',
    },
};
let LANG = (function () {
    try {
        const saved = localStorage.getItem('oryxa.lang');
        if (saved && I18N[saved]) return saved;
    } catch {}
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    if (I18N[nav]) return nav;
    return 'pt';
})();
function t(key, vars) {
    const dict = I18N[LANG] || I18N.pt;
    let s = dict[key];
    if (s == null) s = (I18N.pt[key] != null ? I18N.pt[key] : key);
    if (vars && typeof s === 'string') {
        for (const k of Object.keys(vars)) {
            s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
        }
    }
    return s;
}
function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        el.setAttribute('placeholder', t(key));
    });
    document.documentElement.setAttribute('lang', LANG === 'pt' ? 'pt-br' : LANG);
    document.querySelectorAll('[data-lang-switcher] .lang-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-lang') === LANG);
    });
}
function setLang(lang) {
    if (!I18N[lang]) return;
    LANG = lang;
    try { localStorage.setItem('oryxa.lang', lang); } catch {}
    applyI18n();
    // Trigger a re-render hook so dynamically-rendered content (cards, tables)
    // gets re-translated. The hook is a no-op until initAppUI registers it.
    if (typeof window.__oryxaOnLangChange === 'function') {
        try { window.__oryxaOnLangChange(); } catch {}
    }
}
// Wire language switchers (every element matching `[data-lang-switcher]`).
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang-switcher] .lang-btn');
    if (!btn) return;
    const lang = btn.getAttribute('data-lang');
    if (lang) setLang(lang);
});
// Apply translations as soon as the DOM is parsed.
document.addEventListener('DOMContentLoaded', () => applyI18n());

document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    let me = null;
    let instancesCache = [];

    // eye toggles (delegated)
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.toggle-eye');
        if (!btn) return;
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        // For the edit modal API key field: fetch real key on first reveal
        if (btn.dataset.target === 'editAgentApiKey' && !target.value) {
            const instName = (document.getElementById('editInstanceTarget') || {}).value;
            if (instName) {
                try {
                    const r = await fetch('/api/instances/' + encodeURIComponent(instName) + '/apikey', { credentials: 'same-origin' });
                    const d = await r.json();
                    if (d.key) { target.value = d.key; target.type = 'text'; btn.querySelector('i').className = 'fa-regular fa-eye-slash'; return; }
                    console.warn('[apikey] response:', d);
                } catch (err) { console.error('[apikey] fetch error:', err); }
            }
        }
        target.type = target.type === 'password' ? 'text' : 'password';
        btn.querySelector('i').className = target.type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
    });

    async function loadMe() {
        try {
            const r = await fetch('/api/me');
            if (!r.ok) return null;
            return await r.json();
        } catch { return null; }
    }

    function showLogin() {
        loginView.style.display = '';
        appView.style.display = 'none';
    }
    function showApp() {
        loginView.style.display = 'none';
        appView.style.display = '';
        document.body.classList.toggle('role-admin', me.role === 'admin');
        // Display the user's friendly name when set, otherwise fall back to the email.
        const displayName = (me.name && me.name.trim()) ? me.name.trim() : me.email;
        document.getElementById('userName').innerText = displayName;
        document.getElementById('userRole').innerText = me.role === 'admin' ? t('role.admin') : t('role.user');
        document.getElementById('avatarImg').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;
        applyI18n();
        initAppUI();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.innerText = '';
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
            if (!r.ok) {
                const err = await r.json();
                loginError.innerText = err.error || t('login.error_generic');
                return;
            }
            me = await loadMe();
            if (me) showApp();
        } catch { loginError.innerText = t('login.error_connection'); }
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        me = null;
        showLogin();
    });

    // boot
    (async () => {
        me = await loadMe();
        if (me) showApp(); else showLogin();
    })();

    function initAppUI() {
        const modal = document.getElementById('newInstanceModal');
        const userModal = document.getElementById('newUserModal');
        const newInstanceForm = document.getElementById('newInstanceForm');
        const newUserForm = document.getElementById('newUserForm');
        const instancesGrid = document.getElementById('instancesGrid');
        const instancesGridFull = document.getElementById('instancesGridFull');
        const activeCount = document.getElementById('activeInstancesCount');
        const settingsForm = document.getElementById('settingsForm');
        const settingsStatus = document.getElementById('settingsStatus');
        const providerSelect = document.getElementById('defaultProvider');
        const providerKeyInput = document.getElementById('providerKey');
        const providerKeyLabel = document.getElementById('providerKeyLabel');
        const usersTbody = document.getElementById('usersTbody');
        const newUserInstances = document.getElementById('newUserInstances');
        const instanceOwnerSel = document.getElementById('instanceOwner');
        let settingsCache = {};

        const openModal = () => modal.classList.add('active');
        const resetAvatarPreview = () => {
            const img = document.getElementById('avatarPreview');
            const ico = document.getElementById('avatarPreviewIcon');
            if (img) { img.src = ''; img.style.display = 'none'; }
            if (ico) ico.style.display = '';
        };
        const hideModal = () => { modal.classList.remove('active'); newInstanceForm.reset(); resetAvatarPreview(); const st = newInstanceForm.querySelector('.provision-status'); if (st) st.remove(); };
        // Avatar preview when file selected
        const avatarInput = document.getElementById('instanceAvatar');
        if (avatarInput) {
            avatarInput.addEventListener('change', (ev) => {
                const f = ev.target.files && ev.target.files[0];
                const img = document.getElementById('avatarPreview');
                const ico = document.getElementById('avatarPreviewIcon');
                if (!f) { resetAvatarPreview(); return; }
                if (f.size > 8 * 1024 * 1024) { alert('Imagem muito grande (máx 8MB).'); ev.target.value = ''; return; }
                const reader = new FileReader();
                reader.onload = () => { img.src = reader.result; img.style.display = ''; ico.style.display = 'none'; };
                reader.readAsDataURL(f);
            });
        }
        const openUserModal = () => userModal.classList.add('active');
        const hideUserModal = () => { userModal.classList.remove('active'); newUserForm.reset(); };

        const btn1 = document.getElementById('btnNewInstance'); if (btn1) btn1.onclick = openModal;
        const btn2 = document.getElementById('btnNewInstance2'); if (btn2) btn2.onclick = openModal;
        document.querySelector('.close-modal').onclick = hideModal;
        document.querySelector('.cancel-modal').onclick = hideModal;

        const btnNewUser = document.getElementById('btnNewUser'); if (btnNewUser) btnNewUser.onclick = async () => { await populateUserInstances(); openUserModal(); };
        document.querySelector('.close-user-modal').onclick = hideUserModal;
        document.querySelector('.cancel-user-modal').onclick = hideUserModal;

        function applyRoute() {
            const raw = (location.hash || '#dashboard').replace('#', '') || 'dashboard';
            // Special route: #instance/<name>
            const m = raw.match(/^instance\/([a-z0-9-]+)$/);
            const view = m ? 'instance-detail' : raw;
            document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
            document.querySelectorAll('[data-view-panel]').forEach(el => el.style.display = el.dataset.viewPanel === view ? '' : 'none');
            if (view === 'configuracoes') loadSettings();
            if (view === 'usuarios') loadUsers();
            if (view === 'instance-detail' && m) renderInstanceDetail(m[1]);
        }
        window.addEventListener('hashchange', applyRoute);
        applyRoute();

        // ---- Instances
        const fetchInstances = async () => {
            try {
                const res = await fetch('/api/instances');
                if (res.status === 401) { location.reload(); return; }
                const data = await res.json();
                instancesCache = Array.isArray(data) ? data : [];
                renderInstances();
            } catch (e) { console.error(e); }
        };
        const instanceCard = (inst) => {
            const name = inst.name.replace('openclaw-', '');
            const isOnline = inst.status.includes('Up');
            const isAdmin = me.role === 'admin';
            const p = inst.persona || {};
            const deptEn = p.departmentEn || p.department || '';
            const company = (p.companyName || '').trim();
            const deptLine = deptEn + (company ? ` <span style="opacity:0.7">@${company}</span>` : '');
            return `
                <div class="instance-card instance-card-clickable" data-instance-name="${name}">
                    <div class="instance-header">
                        <div class="instance-id-row">
                            <div class="instance-avatar-wrap" title="${isOnline ? t('card.online') : t('card.offline')}">
                                <img class="instance-avatar" src="/avatars/${name}.png?v=${avatarBust}" alt="${p.name || name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || name)}&background=6366f1&color=fff&size=128'">
                                <span class="status-dot ${isOnline ? 'status-dot-online' : 'status-dot-offline'}"></span>
                            </div>
                            <div class="instance-id">
                                <h4 class="instance-name">${p.name || name}</h4>
                                ${deptEn ? `<div class="instance-dept-en">${deptLine}</div>` : ''}
                                ${(inst.provider || p.humanName || p.email) ? `
                                    <div class="instance-meta">
                                        ${inst.provider ? `
                                            <label class="meta-chip model-chip" onclick="event.stopPropagation()" title="Trocar modelo de IA">
                                                <i class="fa-solid fa-microchip"></i>
                                                <select class="model-select" data-name="${name}" onchange="changeInstanceModel('${name}', this)" onclick="event.stopPropagation()">
                                                    ${MODELS.map(m => `<option value="${m.id}" ${(inst.model || DEFAULT_MODEL) === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
                                                </select>
                                            </label>
                                        ` : ''}
                                        ${p.humanName ? `<span class='meta-chip'><i class='fa-solid fa-user'></i> ${p.humanName}</span>` : ''}
                                        ${p.email ? `<a href='mailto:${p.email}' class='meta-chip' onclick='event.stopPropagation()'><i class='fa-solid fa-envelope'></i> ${p.email}</a>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="instance-footer" style="justify-content:flex-end">
                        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                            ${isAdmin ? `<button class="btn btn-secondary" title="${t('card.edit')}" onclick="event.stopPropagation();openEditInstance('${name}')"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
                            ${isAdmin ? `<button class="btn btn-secondary" title="${isOnline ? t('card.pause') : t('card.start')}" onclick="event.stopPropagation();instanceAction('${name}','${isOnline ? 'stop' : 'start'}')"><i class="fa-solid ${isOnline ? 'fa-pause' : 'fa-play'}"></i></button>` : ''}
                            ${isAdmin ? `<button class="btn btn-secondary action-delete" title="${t('card.delete')}" onclick="event.stopPropagation();instanceAction('${name}','delete')"><i class="fa-solid fa-trash" style="color:#ef4444"></i></button>` : ''}
                            <button class="btn btn-secondary card-btn-wa" data-name="${name}" onclick="event.stopPropagation();connectWhatsApp('${name}')" title="${t('card.connect_whatsapp')}"><i class="fa-brands fa-whatsapp" style="color:#25D366"></i></button>
                            <button class="btn btn-secondary${(inst.telegram && inst.telegram.connected) ? ' is-connected' : ''}" onclick="event.stopPropagation();connectTelegram('${name}')" title="${(inst.telegram && inst.telegram.connected && inst.telegram.botUsername) ? 'Connected: @' + inst.telegram.botUsername : t('card.connect_telegram')}"><i class="fa-brands fa-telegram" style="color:#229ED9"></i></button>
                            <a class="btn btn-secondary" title="Ver navegador do agente ao vivo" href="https://browser-${name}.oryxa.digital" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none"><i class="fa-solid fa-globe" style="color:#60a5fa"></i></a>
                            <button class="btn btn-secondary" onclick="event.stopPropagation();openInstanceUI('${name}')">${t('card.open_ui')}</button>
                        </div>
                    </div>
                </div>`;
        };
        const renderInstances = () => {
            const applyLayout = (grid, count) => {
                if (!grid) return;
                grid.classList.remove('single-card', 'dual-card');
                if (count === 1) grid.classList.add('single-card');
                else if (count === 2) grid.classList.add('dual-card');
            };
            if (instancesCache.length === 0) {
                instancesGrid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ghost"></i><h2>${t('empty.title')}</h2><p>${me.role==='admin'?t('empty.admin'):t('empty.user')}</p></div>`;
                if (instancesGridFull) instancesGridFull.innerHTML = instancesGrid.innerHTML;
                applyLayout(instancesGrid, 0);
                applyLayout(instancesGridFull, 0);
                activeCount.innerText = '0'; return;
            }
            activeCount.innerText = instancesCache.length;
            const sorted = [...instancesCache].sort((a, b) => {
                const an = (a.name || '').replace(/^openclaw-/, '').toLowerCase();
                const bn = (b.name || '').replace(/^openclaw-/, '').toLowerCase();
                return an.localeCompare(bn);
            });
            const html = sorted.map(instanceCard).join('');
            instancesGrid.innerHTML = html;
            if (instancesGridFull) instancesGridFull.innerHTML = html;
            applyLayout(instancesGrid, instancesCache.length);
            applyLayout(instancesGridFull, instancesCache.length);
            // Async: fetch WhatsApp status for each card and mark "is-connected"
            sorted.forEach((inst) => {
                const n = (inst.name || '').replace(/^openclaw-/, '');
                fetch(`/api/instances/${encodeURIComponent(n)}/whatsapp/qr`)
                    .then(r => r.ok ? r.json() : null)
                    .then(d => {
                        if (!d || d.status !== 'connected') return;
                        document.querySelectorAll(`.card-btn-wa[data-name="${n}"]`).forEach(btn => {
                            btn.classList.add('is-connected');
                            btn.title = 'Connected';
                        });
                    })
                    .catch(() => {});
            });
        };
        // Re-render dynamic content when the user switches language.
        
                        // /*rb-instance-search-mo*/ live filter for the instances grid.
        // The grid is re-rendered with innerHTML on every fetch, so we observe
        // the grids and reapply the current filter automatically.
        (function setupInstanceSearch() {
            const input = document.getElementById('searchInstances');
            if (!input) return;
            const grids = [instancesGrid, instancesGridFull].filter(Boolean);
            const applyFilter = () => {
                const q = (input.value || '').trim().toLowerCase();
                for (const grid of grids) {
                    let visible = 0;
                    grid.querySelectorAll('.instance-card').forEach(card => {
                        let show = !q;
                        if (q) {
                            const text = (card.textContent || '').toLowerCase();
                            show = text.includes(q);
                        }
                        card.style.display = show ? '' : 'none';
                        if (show) visible++;
                    });
                    grid.classList.remove('single-card', 'dual-card');
                    if (visible === 1) grid.classList.add('single-card');
                    else if (visible === 2) grid.classList.add('dual-card');
                }
            };
            input.addEventListener('input', applyFilter);
            const obs = new MutationObserver(() => applyFilter());
            for (const grid of grids) obs.observe(grid, { childList: true });
        })();
        window.__oryxaOnLangChange = () => {
            try {
                if (me) document.getElementById('userRole').innerText = me.role === 'admin' ? t('role.admin') : t('role.user');
                renderInstances();
            } catch {}
        };
        // ---- Edit instance persona ----
        const editModal = document.getElementById('editInstanceModal');
        const editForm = document.getElementById('editInstanceForm');
        function closeEditModal() { if (editModal) editModal.classList.remove('active'); }
        if (editModal) {
            editModal.querySelector('.close-edit-modal')?.addEventListener('click', closeEditModal);
            editModal.querySelector('.cancel-edit-modal')?.addEventListener('click', closeEditModal);
            editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });
        }
        window.openEditInstance = (name) => {
            const inst = instancesCache.find(i => i.name.replace(/^openclaw-/, '') === name);
            if (!inst) return;
            const p = inst.persona || {};
            document.getElementById('editInstanceName').innerText = p.name || name;
            // API key field: show placeholder if already set
            const editApiKeyEl = document.getElementById('editAgentApiKey');
            if (editApiKeyEl) {
                const savedKey = (inst.apiKey || '');
                editApiKeyEl.value = '';
                editApiKeyEl.placeholder = savedKey ? t('modal.api_key_ph_set') : t('modal.api_key_ph');
            }
            // Avatar preview: show current avatar
            const editAvatarPreview = document.getElementById('editAvatarPreview');
            const editAvatarStatus = document.getElementById('editAvatarStatus');
            const editAvatarInput = document.getElementById('editInstanceAvatar');
            if (editAvatarPreview) {
                editAvatarPreview.src = '/avatars/' + name + '.png?t=' + Date.now();
                editAvatarPreview.style.display = 'block';
                editAvatarPreview.onerror = function() { this.style.display = 'none'; };
            }
            if (editAvatarInput) {
                editAvatarInput.value = '';
                if (editAvatarStatus) editAvatarStatus.textContent = '';
                editAvatarInput.onchange = function() {
                    const f = this.files[0]; if (!f) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        if (editAvatarPreview) { editAvatarPreview.src = ev.target.result; editAvatarPreview.style.display = 'block'; }
                        if (editAvatarStatus) editAvatarStatus.textContent = f.name;
                    };
                    reader.readAsDataURL(f);
                };
            }
            document.getElementById('editInstanceTarget').value = name;
            document.getElementById('editAgentPersona').value = p.name || '';
            document.getElementById('editAgentCreature').value = p.creature || 'AI';
            document.getElementById('editAgentVibe').value = p.vibe || 'profissional e direto';
            document.getElementById('editAgentEmoji').value = p.emoji || '';
            document.getElementById('editHumanName').value = p.humanName || '';
            document.getElementById('editAgentDepartment').value = p.department || '';
            document.getElementById('editAgentEmail').value = p.email || '';
            document.getElementById('editAgentInstructions').value = p.instructions || '';
            // EN detail fields
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            setVal('editAgentCompanyName', p.companyName);
            setVal('editAgentDepartmentEn', p.departmentEn);
            setVal('editAgentPositionEn', p.positionEn);
            setVal('editAgentFunctionEn', p.functionEn);
            setVal('editAgentDescriptionEn', p.descriptionEn);
            setVal('editAgentTopicsEn', Array.isArray(p.topicsEn) ? p.topicsEn.join('\n') : '');
            // Populate model dropdown from MODELS
            const modelSel = document.getElementById('editAgentModel');
            if (modelSel) {
                const currentModel = inst.model || DEFAULT_MODEL;
                modelSel.innerHTML = MODELS.map(m => `<option value="${m.id}" ${currentModel === m.id ? 'selected' : ''}>${m.label} <span>(${m.hint})</span></option>`).join('');
                modelSel.setAttribute('data-original', currentModel);
            }
            editModal.classList.add('active');
        };
        if (editForm) editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const target = document.getElementById('editInstanceTarget').value;
            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            const topicsRaw = getVal('editAgentTopicsEn');
            const modelSel = document.getElementById('editAgentModel');
            const newModel = modelSel ? modelSel.value : '';
            const originalModel = modelSel ? modelSel.getAttribute('data-original') : '';
            const apiKeyVal = (document.getElementById('editAgentApiKey') || {}).value || '';
            const body = {
                name: document.getElementById('editAgentPersona').value,
                creature: document.getElementById('editAgentCreature').value,
                vibe: document.getElementById('editAgentVibe').value,
                emoji: document.getElementById('editAgentEmoji').value,
                humanName: document.getElementById('editHumanName').value,
                department: document.getElementById('editAgentDepartment').value,
                email: document.getElementById('editAgentEmail').value,
                instructions: document.getElementById('editAgentInstructions').value,
                companyName: getVal('editAgentCompanyName'),
                departmentEn: getVal('editAgentDepartmentEn'),
                positionEn: getVal('editAgentPositionEn'),
                functionEn: getVal('editAgentFunctionEn'),
                descriptionEn: getVal('editAgentDescriptionEn'),
                topicsEn: topicsRaw.split('\n').map(s => s.trim()).filter(Boolean),
                ...(apiKeyVal ? { apiKey: apiKeyVal } : {}),
            };
            const btn = editForm.querySelector('button[type="submit"]');
            btn.disabled = true; const orig = btn.innerHTML; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('actions.saving')}`;
            try {
                const r = await fetch(`/api/instances/${target}/persona`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || t('alerts.error_prefix').replace(': ',''));
                // If model changed, also fire the model-switch endpoint
                if (newModel && newModel !== originalModel) {
                    const r2 = await fetch(`/api/instances/${target}/model`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: newModel }) });
                    const d2 = await r2.json().catch(() => ({}));
                    if (!r2.ok) throw new Error(t('alerts.error_prefix') + (d2.error || r2.status));
                }
                // Upload avatar if selected
                const avatarInput2 = document.getElementById('editInstanceAvatar');
                if (avatarInput2 && avatarInput2.files && avatarInput2.files[0]) {
                    try {
                        const f2 = avatarInput2.files[0];
                        const b64 = await new Promise((res2, rej2) => { const rd = new FileReader(); rd.onload = e => res2(e.target.result); rd.onerror = rej2; rd.readAsDataURL(f2); });
                        await fetch('/api/instances/' + encodeURIComponent(target) + '/avatar', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: b64 })
                        });
                    } catch (ae) { console.warn('edit avatar upload error:', ae); }
                }
                closeEditModal();
                avatarBust = Date.now();
                await fetchInstances();
            } catch (err) { alert('Erro: ' + err.message); }
            finally { btn.disabled = false; btn.innerHTML = orig; }
        });
        // Card click opens detail page, but not when clicking a button/link inside the card.
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.instance-card-clickable');
            if (!card) return;
            if (e.target.closest('button, a')) return;
            const name = card.getAttribute('data-instance-name');
            if (name) location.hash = `#instance/${name}`;
        });

        // Back button on detail page → instances list
        const backBtn = document.getElementById('detailBack');
        if (backBtn) backBtn.onclick = () => { location.hash = me.role === 'admin' ? '#instancias' : '#dashboard'; };

        // Render the full instance detail page (avatar, EN bio, actions)
        window.renderInstanceDetail = (name) => {
            const container = document.getElementById('instanceDetailContent');
            if (!container) return;
            const inst = instancesCache.find(i => (i.name || '').replace('openclaw-', '') === name);
            if (!inst) {
                container.innerHTML = `<div class="detail-section"><p>Instância não encontrada. <a href="#instancias">Voltar à lista</a></p></div>`;
                // Try to load instances if not loaded yet
                fetchInstances().then(() => {
                    if (location.hash === `#instance/${name}`) renderInstanceDetail(name);
                });
                return;
            }
            const isOnline = (inst.status || '').includes('Up');
            const isAdmin = me.role === 'admin';
            const p = inst.persona || {};
            const cap = name.charAt(0).toUpperCase() + name.slice(1);
            const provName = ({openai:'OpenAI gpt-4o-mini',openrouter:'OpenRouter Gemini 2.5 Flash',xai:'xAI Grok-4',groq:'Groq Llama-3.3',mistral:'Mistral Large',deepseek:'DeepSeek',gemini:'Gemini 2.5 Flash',zai:'Z.AI'})[inst.provider] || inst.provider || '';
            const topics = Array.isArray(p.topicsEn) ? p.topicsEn : [];
            const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const tgConnected = !!(inst.telegram && inst.telegram.connected);
            const tgUser = inst.telegram && inst.telegram.botUsername;
            const connectedTag = `<span class="connected-tag">Connected</span>`;
            container.innerHTML = `
                <div class="detail-hero">
                    ${isAdmin ? `
                    <div class="detail-actions-admin">
                        <button class="action-icon" title="${t('card.edit')}" onclick="openEditInstance('${name}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="action-icon" title="${isOnline ? t('card.pause') : t('card.start')}" onclick="instanceAction('${name}','${isOnline ? 'stop' : 'start'}')"><i class="fa-solid ${isOnline ? 'fa-pause' : 'fa-play'}"></i></button>
                        <button class="action-icon action-delete" title="${t('card.delete')}" onclick="instanceAction('${name}','delete')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                    <div class="detail-avatar-wrap">
                        <img class="detail-avatar" src="/avatars/${name}.png?v=${avatarBust}" alt="${p.name || name}" title="Clique para ampliar" onclick="openAvatarLightbox('${name}', '${(p.name || cap).replace(/'/g, "\\'")}')" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || cap)}&background=6366f1&color=fff&size=512'">
                        <span class="status-dot ${isOnline ? 'status-dot-online' : 'status-dot-offline'}" title="${isOnline ? t('card.online') : t('card.offline')}"></span>
                    </div>
                    <div class="detail-info">
                        <h2 class="detail-name">${p.name || cap}</h2>
                        ${p.positionEn ? `<div class="detail-position">${esc(p.positionEn)}${p.companyName ? ` <span style="opacity:0.7">@${esc(p.companyName)}</span>` : ''}</div>` : ''}
                        <div class="detail-meta-row">
                            ${p.departmentEn ? `<span class='meta-chip'><i class='fa-solid fa-building'></i> ${esc(p.departmentEn)}</span>` : ''}
                            ${inst.provider ? `
                                <label class="meta-chip model-chip" title="Trocar modelo de IA">
                                    <i class="fa-solid fa-microchip"></i>
                                    <select class="model-select" data-name="${name}" onchange="changeInstanceModel('${name}', this)">
                                        ${MODELS.map(m => `<option value="${m.id}" ${(inst.model || DEFAULT_MODEL) === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
                                    </select>
                                </label>
                            ` : ''}
                            ${p.humanName ? `<span class='meta-chip'><i class='fa-solid fa-user'></i> ${esc(p.humanName)}</span>` : ''}
                            ${p.email ? `<a href='mailto:${esc(p.email)}' class='meta-chip'><i class='fa-solid fa-envelope'></i> ${esc(p.email)}</a>` : ''}
                            <a href='https://${name}.oryxa.digital' target='_blank' class='meta-chip'><i class='fa-solid fa-globe'></i> ${name}.oryxa.digital</a>
                        </div>
                        <div class="connection-row">
                            <button class="connection-btn" id="connBtnWA" onclick="connectWhatsApp('${name}')">
                                <i class="fa-brands fa-whatsapp" style="color:#25D366"></i>
                                <span>WhatsApp</span>
                                <span class="connected-tag" id="waConnTag" style="display:none">Connected</span>
                            </button>
                            <button class="connection-btn" onclick="connectTelegram('${name}')">
                                <i class="fa-brands fa-telegram" style="color:#229ED9"></i>
                                <span>Telegram${tgConnected && tgUser ? ` <span class="conn-sub">@${esc(tgUser)}</span>` : ''}</span>
                                ${tgConnected ? connectedTag : ''}
                            </button>
                            <button class="connection-btn is-primary" onclick="openInstanceUI('${name}')">
                                <i class="fa-solid fa-up-right-from-square"></i>
                                <span>${t('card.open_ui')}</span>
                            </button>
                        </div>
                    </div>
                </div>
                ${p.functionEn ? `
                <div class="detail-section">
                    <h3>Function</h3>
                    <p>${esc(p.functionEn)}</p>
                </div>` : ''}
                ${(p.descriptionEn || p.instructions) ? `
                <div class="detail-section">
                    <h3>About ${p.name || cap}</h3>
                    <p>${esc(p.descriptionEn || p.instructions)}</p>
                </div>` : ''}
                ${topics.length ? `
                <div class="detail-section">
                    <h3>Core Topics</h3>
                    <div class="topic-chips">
                        ${topics.map(tt => `<span class='topic-chip'>${esc(tt)}</span>`).join('')}
                    </div>
                </div>` : ''}
            `;
            // Async check WhatsApp connection state
            (async () => {
                try {
                    const r = await fetch(`/api/instances/${encodeURIComponent(name)}/whatsapp/qr`);
                    if (!r.ok) return;
                    const d = await r.json();
                    if (d && d.status === 'connected') {
                        const tag = document.getElementById('waConnTag');
                        if (tag) tag.style.display = '';
                    }
                } catch {}
            })();
        };

        window.openAvatarLightbox = (name, label) => {
            // Remove any existing lightbox
            document.querySelectorAll('.avatar-lightbox').forEach(el => el.remove());
            const lb = document.createElement('div');
            lb.className = 'avatar-lightbox';
            lb.innerHTML = `
                <button class="avatar-lightbox-close" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
                <img src="/avatars/${name}.png" alt="${label || name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(label || name)}&background=6366f1&color=fff&size=1024'">
            `;
            document.body.appendChild(lb);
            // Trigger transition
            requestAnimationFrame(() => lb.classList.add('active'));
            const close = () => {
                lb.classList.remove('active');
                setTimeout(() => lb.remove(), 200);
                document.removeEventListener('keydown', onKey);
            };
            const onKey = (e) => { if (e.key === 'Escape') close(); };
            document.addEventListener('keydown', onKey);
            lb.addEventListener('click', (e) => {
                // Click on backdrop or close button → close. Click on image → don't close.
                if (e.target === lb || e.target.closest('.avatar-lightbox-close')) close();
            });
        };

        // Trocar modelo de uma instância. Recebe o <select> que disparou o change.
        window.changeInstanceModel = async (name, sel) => {
            const newModel = sel.value;
            const prevModel = sel.getAttribute('data-prev') || sel.querySelector('option[selected]')?.value || DEFAULT_MODEL;
            sel.setAttribute('data-prev', newModel);
            sel.disabled = true;
            try {
                const r = await fetch(`/api/instances/${encodeURIComponent(name)}/model`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: newModel }),
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.error || ('http ' + r.status));
                // Update cache so UI reflects the new value
                const cached = instancesCache.find(i => (i.name || '').replace(/^openclaw-/, '') === name);
                if (cached) cached.model = newModel;
                // Brief feedback (label flash)
                const chip = sel.closest('.meta-chip');
                if (chip) {
                    chip.style.background = 'rgba(34,197,94,0.18)';
                    setTimeout(() => { chip.style.background = ''; }, 1400);
                }
            } catch (e) {
                alert(t('alerts.error_prefix') + e.message);
                sel.value = prevModel;
            } finally {
                sel.disabled = false;
            }
        };

        window.openInstanceUI = (name) => {
            // Open native OpenClaw control UI with token via fragment.
            const win = window.open('about:blank', '_blank');
            if (!win) { alert('Bloqueio de pop-up. Permita pop-ups e tente de novo.'); return; }
            (async () => {
                try {
                    const r = await fetch('/api/instances/' + encodeURIComponent(name) + '/token', { credentials: 'same-origin' });
                    if (!r.ok) { win.location = 'https://' + name + '.oryxa.digital'; return; }
                    const j = await r.json();
                    win.location = j.url || ('https://' + name + '.oryxa.digital' + (j.token ? '/#token=' + j.token : ''));
                } catch (e) {
                    win.location = 'https://' + name + '.oryxa.digital';
                }
            })();
        };
                window.connectTelegram = async (name) => {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.style.zIndex = 1000;
            modal.innerHTML = `
                <div class="modal-content" style="max-width:520px">
                    <div class="modal-header">
                        <h2><i class="fa-brands fa-telegram" style="color:#229ED9;margin-right:8px"></i>Telegram — ${name}</h2>
                        <button id="closeTg" class="close-modal">&times;</button>
                    </div>
                    <div id="tgBody" style="padding:8px 0">
                        <p style="color:var(--text-muted);font-size:13px;line-height:1.5">
                            1. Abra <a href="https://t.me/BotFather" target="_blank" style="color:var(--primary)">@BotFather</a> no Telegram<br>
                            2. Envie <code>/newbot</code> e siga as instruções<br>
                            3. Cole abaixo o token que ele te der
                        </p>
                        <div style="margin-top:16px">
                            <label style="display:block;font-size:13px;color:var(--text-muted);margin-bottom:6px">Bot Token</label>
                            <input id="tgToken" type="text" placeholder="123456789:AAH..." style="width:100%;padding:10px;border-radius:8px;background:rgba(15,23,42,0.6);border:1px solid var(--border);color:white;font-family:monospace;font-size:13px"/>
                        </div>
                        <div id="tgStatus" style="margin-top:12px;font-size:13px;color:var(--text-muted)"></div>
                        <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
                            <button id="tgCancel" class="btn btn-secondary">Cancelar</button>
                            <button id="tgSave" class="btn btn-primary">Conectar</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            const close = () => modal.remove();
            modal.querySelector('#closeTg').onclick = close;
            modal.querySelector('#tgCancel').onclick = close;
            modal.onclick = (e) => { if (e.target === modal) close(); };
            try {
                const r = await fetch(`/api/instances/${name}/telegram/status`);
                const d = await r.json();
                if (d.configured && d.botUsername) {
                    modal.querySelector('#tgStatus').innerHTML = `<span style="color:#10b981">✓ Já conectado: <a href="${d.botUrl}" target="_blank" style="color:var(--primary)">@${d.botUsername}</a></span>`;
                }
            } catch {}
            modal.querySelector('#tgSave').onclick = async () => {
                const token = modal.querySelector('#tgToken').value.trim();
                if (!token) { modal.querySelector('#tgStatus').innerHTML = `<span style="color:var(--danger)">Cole o token primeiro</span>`; return; }
                modal.querySelector('#tgSave').disabled = true;
                modal.querySelector('#tgStatus').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Configurando...`;
                try {
                    const r = await fetch(`/api/instances/${name}/telegram/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
                    modal.querySelector('#tgStatus').innerHTML = `<span style="color:#10b981">✓ Connected! Open <a href="${d.botUrl}" target="_blank" style="color:var(--primary)">@${d.botUsername}</a> on Telegram and send a message.</span>`;
                    setTimeout(() => fetchInstances(), 1000);
                } catch (e) {
                    modal.querySelector('#tgStatus').innerHTML = `<span style="color:var(--danger)">${t('alerts.error_prefix')}${e.message}</span>`;
                    modal.querySelector('#tgSave').disabled = false;
                }
            };
        };

window.connectWhatsApp = async (name) => {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.style.zIndex = 1000;
            modal.innerHTML = `
                <div class="modal-content" style="max-width:520px">
                    <div class="modal-header">
                        <h2><i class="fa-brands fa-whatsapp" style="color:#25D366;margin-right:8px"></i>${t('wa.title')} — ${name}</h2>
                        <button id="closeWa" class="close-modal">&times;</button>
                    </div>
                    <div id="waBody" style="padding:8px 0">
                        <p style="color:var(--text-muted);font-size:13px">${t('wa.intro')}</p>
                        <div id="waStatus" style="margin-top:16px;padding:16px;background:rgba(15,23,42,0.6);border-radius:10px;text-align:center;min-height:280px;display:flex;align-items:center;justify-content:center">
                            <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;color:var(--primary)"></i>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#closeWa').onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            // Start WhatsApp login and poll for QR
            try {
                await fetch(`/api/instances/${name}/whatsapp/start`, { method: 'POST' });
            } catch {}
            const statusEl = modal.querySelector('#waStatus');
            let tries = 0;
            const poll = setInterval(async () => {
                tries++;
                try {
                    const r = await fetch(`/api/instances/${name}/whatsapp/qr`);
                    const d = await r.json();
                    if (d.status === 'connected') {
                        statusEl.innerHTML = `<div style="color:#10b981"><i class="fa-solid fa-circle-check" style="font-size:48px"></i><p style="margin-top:12px">${t('wa.connected')}</p></div>`;
                        clearInterval(poll);
                        return;
                    }
                    if (d.status === 'qr' && d.dataUrl) {
                        statusEl.innerHTML = `<img src="${d.dataUrl}" alt="QR WhatsApp" style="border-radius:10px;background:white;padding:8px;max-width:100%">`;
                    } else if (d.status === 'error') {
                        statusEl.innerHTML = `<p style="color:var(--danger);font-size:13px">${d.message}</p>`;
                        clearInterval(poll);
                    } else {
                        statusEl.innerHTML = `<div style="color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:28px"></i><p style="margin-top:12px;font-size:13px">${d.message || t('wa.preparing')}</p></div>`;
                    }
                } catch {}
                if (tries > 120) { clearInterval(poll); statusEl.innerHTML = `<p style="color:var(--danger)">${t('wa.timeout')}</p>`; }
            }, 2000);
            modal.addEventListener('click', () => { /* cleanup on close via closeWa */ });
        };

        window.instanceAction = async (name, action) => {
            if (action === "delete") {
                const typed = prompt(`Para apagar a instancia "${name}" definitivamente, digite o nome dela abaixo:

(esta accao remove o container, dados e workspace — IRREVERSIVEL)`);
                if (typed === null) return;
                if (typed.trim() !== name) {
                    alert(`Nome nao bate. Digitaste "${typed}", esperava "${name}". Cancelado.`);
                    return;
                }
            }
            try {
                const r = await fetch(`/api/instances/${name}/${action}`, { method: 'POST' });
                if (r.status === 401) { alert(t('alerts.session_expired')); location.reload(); return; }
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    alert(t('alerts.error_prefix') + (err.error || `HTTP ${r.status}`));
                }
                fetchInstances();
            } catch (e) { alert(t('alerts.error_prefix') + e.message); }
        };

        async function waitForReady(name, statusEl) {
            const t0 = Date.now();
            const maxMs = 4 * 60 * 1000;
            const expectedMs = 120 * 1000; // ~2min ideal
            while (Date.now() - t0 < maxMs) {
                try {
                    const r = await fetch(`/api/instances/${name}/status`);
                    const s = await r.json();
                    // Combine step-based + time-based progress
                    const stepPct = (s.healthy ? 33 : 0) + (s.cert ? 33 : 0) + (s.https ? 34 : 0);
                    const timePct = Math.min(95, Math.round((Date.now() - t0) / expectedMs * 100));
                    const pct = s.ready ? 100 : Math.min(Math.max(stepPct, Math.round(timePct * 0.9)), 95);
                    const elapsed = Math.round((Date.now() - t0) / 1000);
                    if (statusEl) statusEl.innerHTML = `
                        <div style="display:flex;flex-direction:column;gap:8px">
                            <div>${s.healthy ? '✅' : '⏳'} Container</div>
                            <div>${s.cert ? '✅' : '⏳'} Certificado SSL</div>
                            <div>${s.https ? '✅' : '⏳'} HTTPS público</div>
                            <div style="margin-top:8px;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden">
                                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),#8b5cf6);transition:width 0.4s ease"></div>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
                                <span>${pct}%</span>
                                <span>${elapsed}s</span>
                            </div>
                        </div>
                    `;
                    if (s.ready) return true;
                } catch {}
                await new Promise(r => setTimeout(r, 3000));
            }
            return false;
        }

        newInstanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ownerId = instanceOwnerSel.value || null;
            const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            const topicsRaw = getVal('agentTopicsEn');
            const data = {
                name: document.getElementById('instanceName').value,
                llmProvider: document.getElementById('llmProvider').value,
                ownerId,
                persona: {
                    name: document.getElementById('agentPersona').value,
                    creature: document.getElementById('agentCreature').value,
                    vibe: document.getElementById('agentVibe').value,
                    emoji: document.getElementById('agentEmoji').value,
                    humanName: document.getElementById('humanName').value,
                    department: document.getElementById('agentDepartment').value,
                    email: document.getElementById('agentEmail').value,
                    instructions: document.getElementById('agentInstructions').value,
                    companyName: getVal('agentCompanyName'),
                    departmentEn: getVal('agentDepartmentEn'),
                    positionEn: getVal('agentPositionEn'),
                    functionEn: getVal('agentFunctionEn'),
                    descriptionEn: getVal('agentDescriptionEn'),
                    topicsEn: topicsRaw.split('\n').map(s => s.trim()).filter(Boolean),
                }
            };
            const submitBtn = newInstanceForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('provision.provisioning')}`;
            let statusEl = newInstanceForm.querySelector('.provision-status');
            if (!statusEl) {
                statusEl = document.createElement('div');
                statusEl.className = 'provision-status';
                statusEl.style.cssText = 'margin-top:12px;padding:12px;background:rgba(15,23,42,0.6);border-radius:10px;font-size:13px;color:var(--text-muted);line-height:1.8';
                newInstanceForm.insertBefore(statusEl, newInstanceForm.querySelector('.modal-footer'));
            }
            statusEl.innerHTML = '⏳ Iniciando...';
            try {
                let result = null;
                let resOk = true;
                try {
                    const res = await fetch('/api/instances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                    resOk = res.ok;
                    const txt = await res.text();
                    try { result = JSON.parse(txt); } catch { result = null; }
                    if (!resOk && result && result.error) { statusEl.innerHTML = '❌ ' + result.error; return; }
                } catch (netErr) {
                    // Proxy timeout / connection closed — provisionamento pode ter iniciado no backend
                    statusEl.innerHTML = '⏳ Proxy cortou a resposta. Verificando se a instância subiu...';
                }
                statusEl.innerHTML = '⏳ Container criado. Aguardando SSL + HTTPS...';
                // Upload do avatar (se houver) — fire-and-forget mas com feedback no statusEl
                const avatarFile = (document.getElementById('instanceAvatar') || {}).files;
                if (avatarFile && avatarFile[0]) {
                    try {
                        const f = avatarFile[0];
                        const b64 = await new Promise((resolve, reject) => {
                            const r = new FileReader();
                            r.onload = () => resolve(r.result);
                            r.onerror = reject;
                            r.readAsDataURL(f);
                        });
                        const r = await fetch(`/api/instances/${encodeURIComponent(data.name)}/avatar`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: b64 }),
                        });
                        if (!r.ok) {
                            const err = await r.json().catch(() => ({}));
                            console.warn('avatar upload failed:', err.error || r.status);
                        }
                    } catch (e) { console.warn('avatar upload error:', e); }
                }
                fetchInstances();
                const ready = await waitForReady(data.name, statusEl);
                if (ready) {
                    statusEl.innerHTML = '✅ Tudo pronto, abrindo...';
                    await new Promise(r => setTimeout(r, 600));
                    hideModal();
                    const url = (result && result.url) || `https://${data.name}.oryxa.digital`;
                    window.open(url, '_blank');
                } else {
                    statusEl.innerHTML = '⚠️ Timeout aguardando readiness. Verifique em Instâncias.';
                }
            } catch (err) { statusEl.innerHTML = '❌ Erro: ' + err.message; }
            finally { submitBtn.disabled = false; submitBtn.innerText = 'Provisionar Agente'; }
        });

        // ---- Settings
        function showProviderKey(p) {
            const info = PROVIDERS[p] || PROVIDERS.openai;
            providerKeyLabel.textContent = info.label;
            providerKeyInput.placeholder = info.placeholder;
            providerKeyInput.value = (settingsCache.providerKeys && settingsCache.providerKeys[p]) || '';
        }
        providerSelect.addEventListener('change', () => showProviderKey(providerSelect.value));
        async function loadSettings() {
            try {
                const r = await fetch('/api/settings');
                if (!r.ok) return;
                const s = await r.json();
                settingsCache = s;
                providerSelect.value = s.defaultProvider || 'openai';
                showProviderKey(providerSelect.value);
                document.getElementById('braveKey').value = s.braveKey || '';
                document.getElementById('elevenKey').value = s.elevenKey || '';
                const groqEl = document.getElementById('groqKey'); if (groqEl) groqEl.value = s.groqKey || '';
                const wpEl = document.getElementById('whisperProvider'); if (wpEl) wpEl.value = s.whisperProvider || 'groq';
            } catch {}
        }
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p = providerSelect.value;
            settingsCache.providerKeys = settingsCache.providerKeys || {};
            settingsCache.providerKeys[p] = providerKeyInput.value;
            const payload = {
                defaultProvider: p,
                providerKeys: settingsCache.providerKeys,
                braveKey: document.getElementById('braveKey').value,
                elevenKey: document.getElementById('elevenKey').value,
                    groqKey: (document.getElementById('groqKey') || {}).value || '',
                    whisperProvider: (document.getElementById('whisperProvider') || {}).value || 'groq',
            };
            settingsStatus.textContent = t('actions.saving');
            try {
                const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
                settingsStatus.textContent = r.ok ? t('settings.saved') : t('settings.save_error');
                setTimeout(() => settingsStatus.textContent = '', 3000);
            } catch { settingsStatus.textContent = t('settings.save_error'); }
        });

        // ---- Users
        async function loadUsers() {
            try {
                const r = await fetch('/api/users');
                if (!r.ok) { usersTbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger)">sem permissão</td></tr>'; return; }
                const users = await r.json();
                usersTbody.innerHTML = users.map(u => `
                    <tr>
                        <td>${u.name || '—'}</td>
                        <td>${u.email}</td>
                        <td><span class="status-badge ${u.role==='admin'?'status-online':'status-offline'}">${u.role}</span></td>
                        <td>${(u.instances||[]).join(', ') || '—'}</td>
                        <td style="text-align:right">
                            <button class="action-icon" onclick="editUser('${u.id}')"><i class="fa-solid fa-pen"></i></button>
                            ${u.id !== me.id ? `<button class="action-icon action-delete" onclick="deleteUser('${u.id}','${u.email}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `).join('');
            } catch (e) { console.error(e); }
        }
        const editUserModal = document.getElementById('editUserModal');
        const editUserForm = document.getElementById('editUserForm');
        const openEditUserModal = () => editUserModal.classList.add('active');
        const hideEditUserModal = () => { editUserModal.classList.remove('active'); editUserForm.reset(); };
        document.querySelector('.close-edit-user-modal').onclick = hideEditUserModal;
        document.querySelector('.cancel-edit-user-modal').onclick = hideEditUserModal;

        async function populateEditUserInstances(selected) {
            const box = document.getElementById('editUserInstancesBox');
            if (!box) return;
            try {
                const r = await fetch('/api/instances');
                const items = await r.json();
                if (items.length === 0) { box.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma instância disponível.</p>'; return; }
                const sel = new Set(selected || []);
                box.innerHTML = items.map(i => {
                    const n = i.name.replace('openclaw-', '');
                    return `
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px;border-radius:6px" class="inst-check-item">
                            <input type="checkbox" value="${n}" class="edit-inst-check" ${sel.has(n)?'checked':''} style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary)">
                            <span>${n}</span>
                        </label>
                    `;
                }).join('');
            } catch {}
        }

        window.editUser = async (id) => {
            try {
                const r = await fetch('/api/users');
                const users = await r.json();
                const u = users.find(x => x.id === id);
                if (!u) return;
                document.getElementById('editUserId').value = u.id;
                document.getElementById('editUserName').value = u.name || '';
                document.getElementById('editUserEmail').value = u.email || '';
                document.getElementById('editUserPassword').value = '';
                document.getElementById('editUserRole').value = u.role || 'user';
                await populateEditUserInstances(u.instances || []);
                openEditUserModal();
            } catch (e) { console.error(e); }
        };

        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editUserId').value;
            const pw = document.getElementById('editUserPassword').value;
            const checked = Array.from(document.querySelectorAll('#editUserInstancesBox input.edit-inst-check:checked')).map(cb => cb.value);
            const payload = {
                name: document.getElementById('editUserName').value,
                email: document.getElementById('editUserEmail').value,
                role: document.getElementById('editUserRole').value,
                instances: checked
            };
            if (pw) payload.password = pw;
            const r = await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { hideEditUserModal(); loadUsers(); populateOwnerDropdown(); }
            else { const err = await r.json().catch(()=>({})); alert('Erro: ' + (err.error || 'falha')); }
        });

        window.deleteUser = async (id, email) => {
            if (!confirm(`Excluir usuário ${email}?`)) return;
            const r = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (r.ok) loadUsers(); else alert('falha ao excluir');
        };
        async function populateUserInstances() {
            const box = document.getElementById('newUserInstancesBox');
            if (!box) return;
            try {
                const r = await fetch('/api/instances');
                const items = await r.json();
                if (items.length === 0) { box.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma instância disponível.</p>'; return; }
                box.innerHTML = items.map(i => {
                    const n = i.name.replace('openclaw-', '');
                    return `
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px;border-radius:6px" class="inst-check-item">
                            <input type="checkbox" value="${n}" class="inst-check" style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary)">
                            <span>${n}</span>
                        </label>
                    `;
                }).join('');
            } catch {}
        }
        async function populateOwnerDropdown() {
            if (me.role !== 'admin') return;
            try {
                const r = await fetch('/api/users');
                if (!r.ok) return;
                const users = await r.json();
                instanceOwnerSel.innerHTML = `<option value="">${t('modal.owner_none')}</option>` +
                    users.filter(u => u.role !== 'admin').map(u => `<option value="${u.id}">${u.email}</option>`).join('');
            } catch {}
        }
        populateOwnerDropdown();
        newUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = document.getElementById('newUserPassword').value;
            const pw2 = document.getElementById('newUserPassword2').value;
            if (pw !== pw2) { alert('Senhas não conferem'); return; }
            const checked = Array.from(document.querySelectorAll('#newUserInstancesBox input.inst-check:checked')).map(cb => cb.value);
            const payload = {
                name: document.getElementById('newUserName').value,
                email: document.getElementById('newUserEmail').value,
                password: pw,
                role: document.getElementById('newUserRole').value,
                instances: checked
            };
            const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { hideUserModal(); loadUsers(); populateOwnerDropdown(); }
            else { const err = await r.json(); alert('Erro: ' + (err.error || 'falha')); }
        });

        fetchInstances();
        setInterval(fetchInstances, 5000);
    }
});


// ============= CRON JOBS UI =============
window.renderInstanceCron = async (name) => {
    const wrap = document.getElementById('cronJobsWrap-' + name);
    if (!wrap) return;
    wrap.innerHTML = '<div style="opacity:0.6;padding:12px">A carregar crons...</div>';
    try {
        const r = await fetch('/api/instances/' + encodeURIComponent(name) + '/cron', { credentials: 'same-origin' });
        const j = await r.json();
        if (!j.ok) {
            wrap.innerHTML = `<div style="color:#ef4444;padding:12px">${t('alerts.error_prefix')}${j.error||'?'}</div>`;
            return;
        }
        const isAdmin = (window.me || {}).role === 'admin';
        const rows = (j.crons || []).map(c => `
            <tr>
                <td style="font-family:monospace;font-size:12px;padding:6px 10px">${(c.id||'').slice(0,12)}</td>
                <td style="font-family:monospace;padding:6px 10px">${c.schedule||''}</td>
                <td style="padding:6px 10px">${(c.description||'').replace(/</g,'&lt;')}</td>
                <td style="padding:6px 10px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(c.request||'').replace(/"/g,'&quot;')}">${(c.request||'').slice(0,80).replace(/</g,'&lt;')}</td>
                ${isAdmin ? `<td style="padding:6px 10px"><button class="btn btn-secondary" style="padding:4px 8px" onclick="deleteCronJob('${name}','${c.id||''}')"><i class="fa-solid fa-trash" style="color:#ef4444"></i></button></td>` : ''}
            </tr>
        `).join('');
        const empty = (j.crons || []).length === 0 ? '<div style="padding:16px;opacity:0.6;text-align:center">Sem cron jobs configurados.</div>' : '';
        wrap.innerHTML = `
            ${empty}
            ${(j.crons||[]).length ? `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:rgba(255,255,255,0.05);text-align:left">
                    <th style="padding:8px 10px">ID</th>
                    <th style="padding:8px 10px">Schedule</th>
                    <th style="padding:8px 10px">Descrição</th>
                    <th style="padding:8px 10px">Request</th>
                    ${isAdmin ? '<th style="padding:8px 10px">Acção</th>' : ''}
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>` : ''}
            ${isAdmin ? `
            <div style="margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,0.02)">
                <h4 style="margin:0 0 10px 0">Adicionar Cron Job</h4>
                <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;align-items:center;font-size:13px">
                    <label>Schedule (cron)</label>
                    <input id="cronSchedule-${name}" placeholder='ex: 0 8 * * * (todos dias 8h)' style="padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit">
                    <label>Descrição</label>
                    <input id="cronDesc-${name}" placeholder="ex: Monitor diário invoices" style="padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit">
                    <label style="align-self:start;padding-top:6px">Request (linguagem natural)</label>
                    <textarea id="cronReq-${name}" rows="3" placeholder='ex: Bom dia! Verifica emails novos no info@harakawa.tech sobre invoices...' style="padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:inherit;font-family:inherit;resize:vertical"></textarea>
                </div>
                <button class="btn btn-primary" style="margin-top:10px" onclick="addCronJob('${name}')">+ Adicionar</button>
                <div id="cronAddMsg-${name}" style="margin-top:8px;font-size:12px"></div>
            </div>` : ''}
        `;
    } catch (e) {
        wrap.innerHTML = `<div style="color:#ef4444;padding:12px">${t('alerts.error_prefix')}${e.message}</div>`;
    }
};

window.addCronJob = async (name) => {
    const schedule = (document.getElementById('cronSchedule-' + name) || {}).value || '';
    const description = (document.getElementById('cronDesc-' + name) || {}).value || '';
    const request = (document.getElementById('cronReq-' + name) || {}).value || '';
    const msg = document.getElementById('cronAddMsg-' + name);
    if (!schedule || !description || !request) {
        if (msg) msg.innerHTML = '<span style="color:#ef4444">Preenche os 3 campos.</span>';
        return;
    }
    if (msg) msg.innerHTML = '<span style="opacity:0.6">A adicionar...</span>';
    try {
        const r = await fetch('/api/instances/' + encodeURIComponent(name) + '/cron', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedule, description, request })
        });
        const j = await r.json();
        if (!j.ok) { if (msg) msg.innerHTML = '<span style="color:#ef4444">' + (j.error||'?') + '</span>'; return; }
        if (msg) msg.innerHTML = '<span style="color:#22c55e">Adicionado.</span>';
        ['cronSchedule-','cronDesc-','cronReq-'].forEach(p => { const el = document.getElementById(p+name); if (el) el.value=''; });
        setTimeout(() => renderInstanceCron(name), 500);
    } catch (e) {
        if (msg) msg.innerHTML = '<span style="color:#ef4444">' + e.message + '</span>';
    }
};

window.deleteCronJob = async (name, jobId) => {
    if (!confirm('Apagar este cron job?')) return;
    try {
        const r = await fetch('/api/instances/' + encodeURIComponent(name) + '/cron/' + encodeURIComponent(jobId), {
            method: 'DELETE', credentials: 'same-origin'
        });
        const j = await r.json();
        if (!j.ok) { alert('Erro: ' + (j.error||'?')); return; }
        renderInstanceCron(name);
    } catch (e) { alert('Erro: ' + e.message); }
};

// Hook: append Cron Jobs section after instance detail renders
(function() {
    const _origRender = window.renderInstanceDetail;
    if (_origRender && !_origRender._cronPatched) {
        window.renderInstanceDetail = function(name) {
            _origRender.call(this, name);
            const container = document.getElementById('instanceDetailContent');
            if (!container) return;
            if (!document.getElementById('cronJobsSection-' + name)) {
                const section = document.createElement('div');
                section.className = 'detail-section';
                section.id = 'cronJobsSection-' + name;
                section.innerHTML = '<h3><i class="fa-solid fa-clock"></i> Cron Jobs</h3><div id="cronJobsWrap-' + name + '"></div>';
                container.appendChild(section);
                setTimeout(() => renderInstanceCron(name), 100);
            }
        };
        window.renderInstanceDetail._cronPatched = true;
    }
})();


// Botão "Sugerir Emoji" no modal create
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnSuggestEmoji');
    if (!btn) return;
    btn.onclick = async () => {
        const emojiInput = document.getElementById('agentEmoji');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';
        try {
            const body = {
                persona: (document.getElementById('agentPersona')||{}).value || '',
                humanName: (document.getElementById('humanName')||{}).value || '',
                department: (document.getElementById('agentDepartment')||{}).value || '',
                type: (document.getElementById('agentCreature')||{}).value || '',
                vibe: (document.getElementById('agentVibe')||{}).value || '',
            };
            const r = await fetch('/api/suggest-emoji', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const j = await r.json();
            if (j.ok && j.emoji) {
                if (emojiInput) emojiInput.value = j.emoji;
            } else {
                alert('Erro a sugerir emoji: ' + (j.error || '?'));
            }
        } catch (e) {
            alert('Erro: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    };
});

