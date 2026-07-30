const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

const BASE_DIR = '/opt/openoryxa/instances';
const NETWORK = 'openclaw-network';
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:latest';
const OPENCLAW_PORT = process.env.OPENCLAW_PORT || '18789';
const SETTINGS_PATH = path.join(BASE_DIR, '.settings.json');
const USERS_PATH = path.join(BASE_DIR, '.users.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'openoryxa-' + crypto.randomBytes(16).toString('hex');
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'openoryxa';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
const DOMAIN = process.env.DOMAIN || 'oryxa.digital';

const PROVIDER_ENV = {
    openai:     ['OPENAI_API_KEY'],
    gemini:     ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    xai:        ['XAI_API_KEY'],
    groq:       ['GROQ_API_KEY'],
    mistral:    ['MISTRAL_API_KEY'],
    deepseek:   ['DEEPSEEK_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
    zai:        ['ZAI_API_KEY', 'Z_AI_API_KEY'],
};


// /*rb-agent-model-injector*/
// Default OpenClaw model id per provider. Used at provisioning time so the
// agent picks the right backend instead of falling back to the hardcoded
// upstream default (`openai/gpt-5.4`).
const PROVIDER_TO_MODEL = {
    "openai": "openai/gpt-4o-mini",
    "gemini": "google/gemini-2.5-flash",
    "xai": "xai/grok-4",
    "groq": "groq/llama-3.3-70b-versatile",
    "mistral": "mistral/mistral-large-latest",
    "deepseek": "deepseek/deepseek-chat",
    "openrouter": "openrouter/openai/gpt-4o-mini",
    "zai": "zai/glm-4.6"
};
async function ensureAgentModelForProvider(containerName, provider) {
    const model = PROVIDER_TO_MODEL[provider];
    if (!model) return false;
    const setModelJs = `
const fs = require('fs');
const p = '/home/node/.openclaw/openclaw.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.agents = c.agents || {};
c.agents.defaults = c.agents.defaults || {};
if (c.agents.defaults.model && c.agents.defaults.model !== '__OLD__') process.exit(2);
c.agents.defaults.model = '__MODEL__';
fs.writeFileSync(p + '.tmp', JSON.stringify(c, null, 2));
fs.renameSync(p + '.tmp', p);
console.log('agents.defaults.model =', c.agents.defaults.model);
`.replace('__MODEL__', model);
    const b64 = Buffer.from(setModelJs).toString('base64');
    try {
        await runCommand(`echo ${b64} | base64 -d | docker exec --user 0 -i ${shellQuote(containerName)} sh -c 'cat > /tmp/rb-set-model.js && node /tmp/rb-set-model.js'`);
        console.log(`agent model set on ${containerName}: ${model}`);
        return true;
    } catch (e) {
        if (e.code === 2) return false;
        console.error(`set model failed on ${containerName}:`, e.message);
        return false;
    }
}

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Pairing CLI fix-wrapper. The upstream `openclaw pairing list/approve` boots the
// full gateway and never exits, so docker exec/timeout always kill it before output
// reaches stdout. This wrapper short-circuits those two subcommands by reading/writing
// ~/.openclaw/credentials/<channel>-pairing.json and <channel>-<account>-allowFrom.json
// directly. All other subcommands are forwarded to /app/openclaw.mjs unchanged.
// Installed at /usr/local/bin/openclaw inside each openclaw-* container; original
// preserved at /usr/local/bin/openclaw.original.
const PAIRING_WRAPPER_B64 = 'IyEvYmluL2Jhc2gKIyAvdXNyL2xvY2FsL2Jpbi9vcGVuY2xhdyDigJQgd3JhcHBlciB0aGF0IGZhc3QtcGF0aHMgYHBhaXJpbmcgbGlzdGAgYW5kIGBwYWlyaW5nIGFwcHJvdmVgCiMgdG8gYXZvaWQgdGhlIHVwc3RyZWFtIENMSSBidWcgd2hlcmUgaXQgYm9vdHMgdGhlIGZ1bGwgZ2F0ZXdheSBhbmQgbmV2ZXIgZXhpdHMuCiMgQWxsIG90aGVyIHN1YmNvbW1hbmRzIGFyZSBmb3J3YXJkZWQgdG8gdGhlIG9yaWdpbmFsIGJpbmFyeS4KIwojIEluc3RhbGxlZCBieSBSQiBBSSBBZ2VudCBvcHMgb24gMjAyNi0wNC0zMC4gU2FmZSB0byByZW1vdmU6IGp1c3QgcmVzdG9yZSB0aGUgb3JpZ2luYWwKIyBzeW1saW5rOiBsbiAtc2YgL2FwcC9vcGVuY2xhdy5tanMgL3Vzci9sb2NhbC9iaW4vb3BlbmNsYXcKCnNldCAtZQpPUklHPS9hcHAvb3BlbmNsYXcubWpzClNUQVRFPSIke0hPTUU6LS9ob21lL25vZGV9Ly5vcGVuY2xhdy9jcmVkZW50aWFscyIKCiMgb25seSBpbnRlcmNlcHQgd2hlbiBmaXJzdCBub24tZmxhZyBhcmcgaXMgInBhaXJpbmciCiMgYWxsb3cgZmxhZ3MgYmVmb3JlICJwYWlyaW5nIiAoZS5nLiAtLWxvZy1sZXZlbCB0cmFjZSkgLSBidXQgZm9yIHNpbXBsaWNpdHksIGludGVyY2VwdCBvbmx5CiMgd2hlbiAicGFpcmluZyIgaXMgYXQgcG9zaXRpb24gMSBhbmQgc3ViY29tbWFuZCBpcyBsaXN0L2FwcHJvdmUuCmlmIFsgIiQxIiA9ICJwYWlyaW5nIiBdICYmIHsgWyAiJDIiID0gImxpc3QiIF0gfHwgWyAiJDIiID0gImFwcHJvdmUiIF07IH07IHRoZW4KICBleGVjIG5vZGUgLWUgJwpjb25zdCBmcyA9IHJlcXVpcmUoImZzIik7CmNvbnN0IHBhdGggPSByZXF1aXJlKCJwYXRoIik7Cgpjb25zdCBhcmd2ID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDEpOwpjb25zdCBzdWIgPSBhcmd2WzFdOyAvLyBsaXN0IHwgYXBwcm92ZQoKLy8gbWluaW1hbCBhcmcgcGFyc2luZzogLS1jaGFubmVsLCAtLWFjY291bnQsIC0tbm90aWZ5LCAtLWpzb24sIGFuZCBwb3NpdGlvbmFscwpsZXQgY2hhbm5lbCA9ICIiOwpsZXQgYWNjb3VudCA9ICIiOwpsZXQgY29kZSA9ICIiOwpsZXQganNvbiA9IGZhbHNlOwpjb25zdCBwb3MgPSBbXTsKZm9yIChsZXQgaSA9IDI7IGkgPCBhcmd2Lmxlbmd0aDsgaSsrKSB7CiAgY29uc3QgYSA9IGFyZ3ZbaV07CiAgaWYgKGEgPT09ICItLWNoYW5uZWwiKSB7IGNoYW5uZWwgPSBhcmd2WysraV0gfHwgIiI7IH0KICBlbHNlIGlmIChhID09PSAiLS1hY2NvdW50IikgeyBhY2NvdW50ID0gYXJndlsrK2ldIHx8ICIiOyB9CiAgZWxzZSBpZiAoYSA9PT0gIi0tanNvbiIpIHsganNvbiA9IHRydWU7IH0KICBlbHNlIGlmIChhID09PSAiLS1ub3RpZnkiKSB7IC8qIG5vdGlmeSBpcyBpZ25vcmVkIGluIGZhc3QgcGF0aCAqLyB9CiAgZWxzZSBpZiAoYS5zdGFydHNXaXRoKCItLSIpKSB7IC8qIHVua25vd24gZmxhZywgc2tpcCB3aXRoIG5vLWFyZyBhc3N1bXB0aW9uICovIH0KICBlbHNlIHsgcG9zLnB1c2goYSk7IH0KfQoKY29uc3QgU1RBVEUgPSBwcm9jZXNzLmVudi5PUEVOQ0xBV19TVEFURV9ESVIgfHwgKHByb2Nlc3MuZW52LkhPTUUgKyAiLy5vcGVuY2xhdyIpOwpjb25zdCBjcmVkRGlyID0gcGF0aC5qb2luKFNUQVRFLCAiY3JlZGVudGlhbHMiKTsKCi8vIHJlc29sdmUgY2hhbm5lbCArIGNvZGUgZnJvbSBwb3NpdGlvbmFscyB3aGVuIG5vdCBnaXZlbiB2aWEgZmxhZ3MKaWYgKHN1YiA9PT0gImxpc3QiKSB7CiAgaWYgKCFjaGFubmVsICYmIHBvc1swXSkgY2hhbm5lbCA9IHBvc1swXTsKICBpZiAoIWNoYW5uZWwpIGNoYW5uZWwgPSAidGVsZWdyYW0iOwp9IGVsc2UgaWYgKHN1YiA9PT0gImFwcHJvdmUiKSB7CiAgLy8gb3BlbmNsYXcgcGFpcmluZyBhcHByb3ZlIDxjaGFubmVsPiA8Y29kZT4gICAgICgyIHBvc2l0aW9uYWxzKQogIC8vIG9wZW5jbGF3IHBhaXJpbmcgYXBwcm92ZSAtLWNoYW5uZWwgPGNoPiA8Y29kZT4gKDEgcG9zaXRpb25hbCkKICBpZiAoIWNoYW5uZWwpIHsKICAgIGlmIChwb3MubGVuZ3RoID49IDIpIHsgY2hhbm5lbCA9IHBvc1swXTsgY29kZSA9IHBvc1sxXTsgfQogICAgZWxzZSBpZiAocG9zLmxlbmd0aCA9PT0gMSkgeyBjaGFubmVsID0gInRlbGVncmFtIjsgY29kZSA9IHBvc1swXTsgfQogIH0gZWxzZSB7CiAgICBpZiAocG9zLmxlbmd0aCA+PSAxKSBjb2RlID0gcG9zWzBdOwogIH0KICBpZiAoIWNoYW5uZWwgfHwgIWNvZGUpIHsKICAgIGNvbnNvbGUuZXJyb3IoIlVzYWdlOiBvcGVuY2xhdyBwYWlyaW5nIGFwcHJvdmUgPGNoYW5uZWw+IDxjb2RlPiIpOwogICAgcHJvY2Vzcy5leGl0KDIpOwogIH0KICBjb2RlID0gY29kZS50b1VwcGVyQ2FzZSgpOwp9Cgpjb25zdCBzYWZlID0gKHMpID0+IFN0cmluZyhzKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1tcXC9cOlwqXD9cIlw8XD5cfF0vZywgIl8iKS5yZXBsYWNlKC9cLlwuL2csICJfIik7CmNvbnN0IGNoID0gc2FmZShjaGFubmVsKTsKY29uc3QgcGFpcmluZ0ZpbGUgPSBwYXRoLmpvaW4oY3JlZERpciwgY2ggKyAiLXBhaXJpbmcuanNvbiIpOwoKY29uc3QgcmVhZEpzb24gPSAoZiwgZmFsbGJhY2spID0+IHsKICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoZiwgInV0ZjgiKSk7IH0gY2F0Y2ggeyByZXR1cm4gZmFsbGJhY2s7IH0KfTsKY29uc3Qgd3JpdGVKc29uQXRvbWljID0gKGYsIG9iaikgPT4gewogIGNvbnN0IHRtcCA9IGYgKyAiLnRtcC4iICsgcHJvY2Vzcy5waWQ7CiAgZnMud3JpdGVGaWxlU3luYyh0bXAsIEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgMikpOwogIGZzLnJlbmFtZVN5bmModG1wLCBmKTsKfTsKCmlmIChzdWIgPT09ICJsaXN0IikgewogIGNvbnN0IGRhdGEgPSByZWFkSnNvbihwYWlyaW5nRmlsZSwgeyB2ZXJzaW9uOiAxLCByZXF1ZXN0czogW10gfSk7CiAgY29uc3QgcmVxdWVzdHMgPSAoQXJyYXkuaXNBcnJheShkYXRhLnJlcXVlc3RzKSA/IGRhdGEucmVxdWVzdHMgOiBbXSkKICAgIC5maWx0ZXIociA9PiAhYWNjb3VudCB8fCAoci5tZXRhICYmIHIubWV0YS5hY2NvdW50SWQgPT09IGFjY291bnQpKTsKICBpZiAoanNvbikgewogICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoeyBjaGFubmVsLCByZXF1ZXN0cyB9LCBudWxsLCAyKSk7CiAgICBwcm9jZXNzLmV4aXQoMCk7CiAgfQogIGlmIChyZXF1ZXN0cy5sZW5ndGggPT09IDApIHsKICAgIGNvbnNvbGUubG9nKCJObyBwZW5kaW5nICIgKyBjaGFubmVsICsgIiBwYWlyaW5nIHJlcXVlc3RzLiIpOwogICAgcHJvY2Vzcy5leGl0KDApOwogIH0KICBjb25zb2xlLmxvZygiUGFpcmluZyByZXF1ZXN0cyAoIiArIHJlcXVlc3RzLmxlbmd0aCArICIpIik7CiAgZm9yIChjb25zdCByIG9mIHJlcXVlc3RzKSB7CiAgICBjb25zdCBtZXRhID0gci5tZXRhID8gSlNPTi5zdHJpbmdpZnkoci5tZXRhKSA6ICIiOwogICAgY29uc29sZS5sb2coIiAgIiArIHIuY29kZSArICIgICIgKyByLmlkICsgIiAgIiArIG1ldGEgKyAiICAiICsgci5jcmVhdGVkQXQpOwogIH0KICBwcm9jZXNzLmV4aXQoMCk7Cn0KCmlmIChzdWIgPT09ICJhcHByb3ZlIikgewogIGNvbnN0IGRhdGEgPSByZWFkSnNvbihwYWlyaW5nRmlsZSwgeyB2ZXJzaW9uOiAxLCByZXF1ZXN0czogW10gfSk7CiAgY29uc3QgcmVxdWVzdHMgPSBBcnJheS5pc0FycmF5KGRhdGEucmVxdWVzdHMpID8gZGF0YS5yZXF1ZXN0cyA6IFtdOwogIGNvbnN0IGlkeCA9IHJlcXVlc3RzLmZpbmRJbmRleChyID0+IHIuY29kZSAmJiByLmNvZGUudG9VcHBlckNhc2UoKSA9PT0gY29kZSAmJgogICAgKCFhY2NvdW50IHx8IChyLm1ldGEgJiYgci5tZXRhLmFjY291bnRJZCA9PT0gYWNjb3VudCkpKTsKICBpZiAoaWR4IDwgMCkgewogICAgY29uc29sZS5lcnJvcigiTm8gcGVuZGluZyBwYWlyaW5nIHJlcXVlc3QgZm91bmQgZm9yIGNvZGU6ICIgKyBjb2RlKTsKICAgIHByb2Nlc3MuZXhpdCgxKTsKICB9CiAgY29uc3QgZW50cnkgPSByZXF1ZXN0c1tpZHhdOwogIGNvbnN0IGFjY0lkID0gKGVudHJ5Lm1ldGEgJiYgZW50cnkubWV0YS5hY2NvdW50SWQpIHx8ICJkZWZhdWx0IjsKICBjb25zdCBhbGxvd0ZpbGUgPSBwYXRoLmpvaW4oY3JlZERpciwgY2ggKyAiLSIgKyBzYWZlKGFjY0lkKSArICItYWxsb3dGcm9tLmpzb24iKTsKICBjb25zdCBsZWdhY3lBbGxvdyA9IHBhdGguam9pbihjcmVkRGlyLCBjaCArICItYWxsb3dGcm9tLmpzb24iKTsKCiAgLy8gcmVtb3ZlIGZyb20gcGFpcmluZwogIHJlcXVlc3RzLnNwbGljZShpZHgsIDEpOwogIHdyaXRlSnNvbkF0b21pYyhwYWlyaW5nRmlsZSwgeyB2ZXJzaW9uOiAxLCByZXF1ZXN0cyB9KTsKCiAgLy8gYWRkIHRvIGFsbG93RnJvbSAoYWNjb3VudC1zY29wZWQpCiAgY29uc3QgYWxsb3cgPSByZWFkSnNvbihhbGxvd0ZpbGUsIHsgdmVyc2lvbjogMSwgYWxsb3dGcm9tOiBbXSB9KTsKICBjb25zdCBsaXN0ID0gQXJyYXkuaXNBcnJheShhbGxvdy5hbGxvd0Zyb20pID8gYWxsb3cuYWxsb3dGcm9tIDogW107CiAgaWYgKCFsaXN0LmluY2x1ZGVzKGVudHJ5LmlkKSkgbGlzdC5wdXNoKGVudHJ5LmlkKTsKICB3cml0ZUpzb25BdG9taWMoYWxsb3dGaWxlLCB7IHZlcnNpb246IDEsIGFsbG93RnJvbTogbGlzdCB9KTsKCiAgY29uc29sZS5sb2coIkFwcHJvdmVkICIgKyBjaGFubmVsICsgIiBzZW5kZXIgIiArIGVudHJ5LmlkICsgIi4iKTsKICBwcm9jZXNzLmV4aXQoMCk7Cn0KJyAtLSAiJEAiCmZpCgojIHBhc3MtdGhyb3VnaCBmb3IgZXZlcnkgb3RoZXIgY29tbWFuZApleGVjIG5vZGUgIiRPUklHIiAiJEAiCg==';

function loadSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch { return {}; } }
function saveSettings(s) { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2)); }
function loadUsers() { try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); } catch { return { users: [] }; } }
function saveUsers(u) { fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2)); }

// Seed default admin
(function seedAdmin() {
    const u = loadUsers();
    if (!u.users.find(x => x.role === 'admin')) {
        u.users.push({
            id: crypto.randomUUID(),
            name: 'Admin',
            email: ADMIN_EMAIL,
            passwordHash: bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10),
            role: 'admin',
            instances: [],
            createdAt: new Date().toISOString()
        });
        saveUsers(u);
        console.log(`Seeded admin user: ${ADMIN_EMAIL} / ${ADMIN_DEFAULT_PASSWORD}`);
    }
})();

app.use(express.json({ limit: '10mb' }));

// Persistent file-backed session store so restarts don't kick everyone out.
class JSONFileStore extends session.Store {
    constructor(p) {
        super();
        this.path = p;
        try { this.data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { this.data = {}; }
    }
    _flush() { try { fs.writeFileSync(this.path, JSON.stringify(this.data)); } catch {} }
    get(sid, cb) { cb(null, this.data[sid] || null); }
    set(sid, sess, cb) { this.data[sid] = sess; this._flush(); if (cb) cb(null); }
    destroy(sid, cb) { delete this.data[sid]; this._flush(); if (cb) cb(null); }
    touch(sid, sess, cb) { this.data[sid] = sess; this._flush(); if (cb) cb(null); }
}
app.set('trust proxy', 1);
app.use(session({
    name: 'oryxa_sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new JSONFileStore(path.join(BASE_DIR, '.sessions.json')),
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// Aggressively kill any stale connect.sid (from older deploys) on every
// response so users with corrupted cookie state recover automatically.
app.use((req, res, next) => {
    const ck = req.headers.cookie || '';
    if (ck.indexOf('connect.sid=') !== -1) {
        res.append('Set-Cookie', `connect.sid=; Path=/; Domain=.${DOMAIN}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`);
        res.append('Set-Cookie', 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax');
    }
    next();
});

// In-process cross-subdomain browser-auth tokens. Maps tokenHex -> { userId, expiresAt }.
// Issued on /api/login (cookie oryxa_token, Domain=.${DOMAIN}) so the
// per-agent browser sidecars can authorize via forwardAuth without
// requiring the host-only session cookie to traverse subdomains.
const browserTokens = new Map();
function issueBrowserToken(userId) {
    const tok = require('crypto').randomBytes(32).toString('hex');
    browserTokens.set(tok, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return tok;
}
function resolveBrowserToken(tok) {
    const rec = browserTokens.get(tok);
    if (!rec) return null;
    if (rec.expiresAt < Date.now()) { browserTokens.delete(tok); return null; }
    return rec.userId;
}
function setBrowserTokenCookie(res, token) {
    res.append('Set-Cookie', `oryxa_token=${token}; Path=/; Domain=.${DOMAIN}; Max-Age=${7*24*60*60}; HttpOnly; Secure; SameSite=Lax`);
}

function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'not authenticated' });
    const u = loadUsers().users.find(x => x.id === req.session.userId);
    if (!u) { req.session.destroy(()=>{}); return res.status(401).json({ error: 'not authenticated' }); }
    req.user = u;
    next();
}
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'admin required' });
    next();
}

const runCommand = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { err.stdout = stdout; err.stderr = stderr; return reject(err); }
        resolve(stdout);
    });
});
const shellQuote = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

async function cleanupOrphanedShim(containerName) {
    try {
        const cid = (await runCommand(`docker inspect --format '{{.Id}}' ${shellQuote(containerName)}`).catch(() => '')).trim();
        if (!cid) return;
        const cidShort = cid.substring(0, 20);
        const psOut = await runCommand(`ps aux | grep containerd-shim | grep ${cidShort} | grep -v grep || true`).catch(() => '');
        const shimPid = psOut.trim().split(/\s+/)[1];
        if (!shimPid) return;
        console.log(`[shim-fix] killing orphaned shim PID ${shimPid} for ${containerName}`);
        await runCommand(`kill -9 ${shimPid}`).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        await runCommand(`find /sys/fs/cgroup -name "*${cid.substring(0,12)}*" -type d | head -1 | xargs -I{} sh -c 'for pid in $(cat {}/cgroup.procs 2>/dev/null); do kill -9 $pid 2>/dev/null || true; done'`).catch(() => {});
        await new Promise(r => setTimeout(r, 500));
        // Remove APENAS o dir do runc (nao o do containerd — pode ter log.json necessario)
        await runCommand(`rm -rf /run/docker/runtime-runc/moby/${cid} 2>/dev/null || true`).catch(() => {});
    } catch (e) { console.error(`[shim-fix] error cleaning ${containerName}:`, e.message); }
}

// /*rb-telegram-setup*/ helpers for Telegram bot token wiring
async function installSecretsEntrypoint(containerName) {
    try {
        await runCommand(`docker cp /opt/openoryxa/scripts/_oryxa-entrypoint.sh ${shellQuote(containerName)}:/usr/local/bin/docker-entrypoint.sh`);
        await runCommand(`docker exec --user 0 ${shellQuote(containerName)} chmod +x /usr/local/bin/docker-entrypoint.sh`);
    } catch (e) { console.error('installSecretsEntrypoint failed for ' + containerName + ': ' + e.message); }
}
async function writeSecretsEnv(containerName, vars) {
    const tmp = require('os').tmpdir();
    const fp = require('path').join(tmp, 'oryxa-secrets-' + containerName + '-' + Date.now() + '.env');
    const content = Object.entries(vars).map(([k, v]) => k + '=' + v).join('\n') + '\n';
    require('fs').writeFileSync(fp, content);
    try {
        await runCommand(`docker exec --user 0 ${shellQuote(containerName)} mkdir -p /home/node/.openclaw`);
        await runCommand(`docker cp ${shellQuote(fp)} ${shellQuote(containerName)}:/home/node/.openclaw/secrets.env`);
        await runCommand(`docker exec --user 0 ${shellQuote(containerName)} chown node:node /home/node/.openclaw/secrets.env`);
        await runCommand(`docker exec --user 0 ${shellQuote(containerName)} chmod 600 /home/node/.openclaw/secrets.env`);
    } finally { try { require('fs').unlinkSync(fp); } catch {} }
}
async function patchOpenclawConfigForTelegram(containerName, botUsername, botToken, ownerUserId, groupIds) {
    const ownerId = String(ownerUserId || '').trim();
    const groups = Array.isArray(groupIds) ? groupIds.filter(Boolean).map(String) : [];
    const js = `
const fs = require('fs');
const p = '/home/node/.openclaw/openclaw.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.plugins = c.plugins || {};
c.plugins.entries = c.plugins.entries || {};
c.plugins.entries.telegram = c.plugins.entries.telegram || {};
c.plugins.entries.telegram.enabled = true;
c.channels = c.channels || {};
c.channels.telegram = c.channels.telegram || {};
c.channels.telegram.enabled = true;
c.channels.telegram.dmPolicy = '__OWNER_ID__' ? 'allowlist' : 'open';
c.channels.telegram.groupPolicy = 'open';
c.channels.telegram.defaultAccount = 'BOTNAME';
c.channels.telegram.accounts = c.channels.telegram.accounts || {};
c.channels.telegram.accounts['BOTNAME'] = c.channels.telegram.accounts['BOTNAME'] || {};
c.channels.telegram.accounts['BOTNAME'].botToken = 'TOKEN_VALUE';
c.channels.telegram.accounts['BOTNAME'].enabled = true;
if ('__OWNER_ID__') {
  const af = c.channels.telegram.accounts['BOTNAME'].allowFrom || [];
  if (!af.includes('__OWNER_ID__')) af.push('__OWNER_ID__');
  c.channels.telegram.accounts['BOTNAME'].allowFrom = af.filter(x => !String(x).startsWith('-'));
}
const groupIds = __GROUPS_JSON__;
if (groupIds.length > 0) {
  c.channels.telegram.groups = c.channels.telegram.groups || {};
  for (const gid of groupIds) {
    c.channels.telegram.groups[gid] = c.channels.telegram.groups[gid] || { enabled: true, groupPolicy: 'open' };
  }
}
fs.writeFileSync(p + '.tmp', JSON.stringify(c, null, 2));
fs.renameSync(p + '.tmp', p);
console.log('telegram-config-applied');
`
        .replace(/BOTNAME/g, botUsername)
        .replace(/TOKEN_VALUE/g, botToken)
        .replace(/__OWNER_ID__/g, ownerId)
        .replace(/__GROUPS_JSON__/g, JSON.stringify(groups));
    const b64 = Buffer.from(js).toString('base64');
    await runCommand(`echo ${b64} | base64 -d | docker exec --user 0 -i ${shellQuote(containerName)} sh -c 'cat > /tmp/oryxa-tg-cfg.js && node /tmp/oryxa-tg-cfg.js && chown node:node /home/node/.openclaw/openclaw.json'`);
}
async function telegramGetMe(token) {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.telegram.org', path: '/bot' + token + '/getMe', method: 'GET', timeout: 8000 }, (r) => {
            let data = '';
            r.on('data', (c) => data += c);
            r.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}


async function readInstanceToken(cn) {
    const raw = await runCommand(`docker exec ${shellQuote(cn)} cat /home/node/.openclaw/openclaw.json`);
    return JSON.parse(raw)?.gateway?.auth?.token || null;
}

// Patches the OpenClaw gateway to treat token-authenticated WS connects as "silent local"
// so browsers behind the reverse proxy don't hit the "pairing required" wall. Idempotent.
async function patchSilentPairing(cn) {
    // Apply silent-pairing patch via the host-canonical script
    // /opt/openoryxa/scripts/_oryxa-silent-pairing.js (which handles both
    // OpenClaw 2026.4.15 and 2026.4.29 layouts). Returns true if a file was
    // actually rewritten (caller may want to docker restart ${cn}).
    try {
        await runCommand(`docker cp /opt/openoryxa/scripts/_oryxa-silent-pairing.js ${shellQuote(cn)}:/tmp/oryxa-sp.js`);
        const out = await runCommand(`docker exec ${shellQuote(cn)} node /tmp/oryxa-sp.js 2>&1`);
        console.log(`silent-pairing patch on ${cn}:`, out.trim());
        return true;
    } catch (e) {
        if (e.code === 2) return false;
        console.error(`silent-pairing patch failed on ${cn}:`, e.message);
        return false;
    }
}

// Install the pairing CLI fix-wrapper inside an openclaw container. Idempotent:
// skips if /usr/local/bin/openclaw already points at openclaw-fast. Returns true
// when it actually wrote files (caller may want to log / no restart needed since
// the wrapper is read on every CLI invocation).
async function installPairingWrapper(cn) {
    try {
        const link = (await runCommand(`docker exec ${shellQuote(cn)} readlink /usr/local/bin/openclaw 2>/dev/null`)).trim();
        if (link === '/usr/local/bin/openclaw-fast') return false;
    } catch {}
    try {
        const installCmd = `set -e
cat > /usr/local/bin/openclaw-fast
chmod 0755 /usr/local/bin/openclaw-fast
if [ ! -e /usr/local/bin/openclaw.original ]; then cp -P /usr/local/bin/openclaw /usr/local/bin/openclaw.original; fi
rm -f /usr/local/bin/openclaw
ln -s /usr/local/bin/openclaw-fast /usr/local/bin/openclaw`;
        await runCommand(`echo ${PAIRING_WRAPPER_B64} | base64 -d | docker exec --user 0 -i ${shellQuote(cn)} sh -c ${shellQuote(installCmd)}`);
        console.log(`pairing-wrapper installed on ${cn}`);
        return true;
    } catch (e) {
        console.error(`pairing-wrapper install failed on ${cn}:`, e.message);
        return false;
    }
}

// Run patch on all running openclaw instances at startup and every 5 min (in case images update)
async function patchAllOpenclaws() {
    try {
        const out = await runCommand(`docker ps --filter "label=managed-by=openoryxa" --format "{{.Names}}"`);
        const names = out.trim().split('\n').filter(n => n && n.startsWith('openclaw-'));
        for (const cn of names) {
            // Pairing wrapper first; harmless and fast (idempotent, no restart needed).
            try { await installPairingWrapper(cn); } catch {}
            const changed = await patchSilentPairing(cn);
            if (changed) {
                try { await runCommand(`docker restart ${shellQuote(cn)}`); console.log(`restarted ${cn} after patch`); } catch {}
            }
        }
    } catch (e) { console.error('patchAllOpenclaws:', e.message); }
}
setTimeout(patchAllOpenclaws, 5000);
setInterval(patchAllOpenclaws, 5 * 60 * 1000);

function loadInstanceMeta(name) {
    try { return JSON.parse(fs.readFileSync(path.join(BASE_DIR, name, 'meta.json'), 'utf8')); } catch { return {}; }
}
function saveInstanceMeta(name, meta) {
    fs.mkdirSync(path.join(BASE_DIR, name), { recursive: true });
    fs.writeFileSync(path.join(BASE_DIR, name, 'meta.json'), JSON.stringify(meta, null, 2));
}

function userOwnsInstance(user, name) {
    if (user.role === 'admin') return true;
    return (user.instances || []).includes(name);
}

let _autoApproveRunning = false;
async function autoApprovePending() {
    if (_autoApproveRunning) return;
    _autoApproveRunning = true;
    let names;
    try {
        const out = await runCommand(`docker ps --filter "label=managed-by=openoryxa" --format "{{.Names}}"`);
        names = out.trim().split('\n').filter(n => n && n.startsWith('openclaw-'));
    } catch { return; }
    for (const cn of names) {
        try {
            const raw = await runCommand(`docker exec ${shellQuote(cn)} sh -c 'cat /home/node/.openclaw/devices/pending.json 2>/dev/null || echo "{}"'`);
            const pending = JSON.parse(raw || '{}');
            const ids = Object.keys(pending);
            if (!ids.length) continue;
            const token = await readInstanceToken(cn);
            if (!token) continue;
            for (const id of ids) {
                try {
                    await runCommand(`docker exec ${shellQuote(cn)} openclaw devices approve ${shellQuote(id)} --url ws://127.0.0.1:18789 --token ${shellQuote(token)}`);
                    console.log(`auto-approved ${id} on ${cn}`);
                } catch {}
            }
        } catch {}
        // /*rb-tg-autoapprove*/ Auto-approve any pending Telegram channel pairing requests.
        try {
            const raw = await runCommand(`docker exec ${shellQuote(cn)} sh -c 'cat /home/node/.openclaw/credentials/telegram-pairing.json 2>/dev/null || echo "{}"'`);
            const data = JSON.parse(raw || '{}');
            const requests = Array.isArray(data.requests) ? data.requests : [];
            for (const req of requests) {
                if (!req.code) continue;
                try {
                    await runCommand(`docker exec ${shellQuote(cn)} openclaw pairing approve telegram ${shellQuote(req.code)}`);
                    console.log(`auto-approved telegram pairing ${req.code} on ${cn}`);
                } catch {}
            }
        } catch {}
    }
    _autoApproveRunning = false;
}
setInterval(autoApprovePending, 60000);



// ---- Auth
app.post('/api/login', (req, res) => {
    res.append('Set-Cookie', `connect.sid=; Path=/; Domain=.${DOMAIN}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`);
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email e senha são obrigatórios' });
    const users = loadUsers().users;
    const u = users.find(x => (x.email || '').toLowerCase() === String(email).toLowerCase());
    if (!u || !bcrypt.compareSync(password, u.passwordHash)) {
        return res.status(401).json({ error: 'credenciais inválidas' });
    }
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'session error' });
        req.session.userId = u.id;
        req.session.save((err2) => {
            if (err2) return res.status(500).json({ error: 'session save error' });
            const tok = issueBrowserToken(u.id);
            setBrowserTokenCookie(res, tok);
            res.json({ email: u.email, role: u.role });
        });
    });
});
app.post('/api/logout', (req, res) => {
    try {
        const ck = req.headers.cookie || '';
        const m = ck.match(/(?:^|;\s*)oryxa_token=([a-f0-9]{64})/);
        if (m) browserTokens.delete(m[1]);
    } catch {}
    res.append('Set-Cookie', `oryxa_token=; Path=/; Domain=.${DOMAIN}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`);
    req.session.destroy(() => res.json({ success: true }));
});
app.get('/api/me', (req, res) => {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'not authenticated' });
    const u = loadUsers().users.find(x => x.id === req.session.userId);
    if (!u) return res.status(401).json({ error: 'not authenticated' });
    const ck = req.headers.cookie || '';
    if (!/(?:^|;\s*)oryxa_token=[a-f0-9]{64}/.test(ck)) {
        const tok = issueBrowserToken(u.id);
        setBrowserTokenCookie(res, tok);
    }
    res.json({ id: u.id, name: u.name || '', email: u.email, role: u.role, instances: u.instances || [] });
});

// Cross-subdomain authorizer for Traefik forwardAuth on the per-agent
// browser sidecars (browser-<slug>.${DOMAIN}). Authorizes via the
// oryxa_token cookie (Domain=.${DOMAIN}) issued at login.
app.get('/api/auth/forward', (req, res) => {
    let userId = null;
    if (req.session && req.session.userId) userId = req.session.userId;
    if (!userId) {
        const ck = req.headers.cookie || '';
        const m = ck.match(/(?:^|;\s*)oryxa_token=([a-f0-9]{64})/);
        if (m) userId = resolveBrowserToken(m[1]);
    }
    if (!userId) return res.status(401).send('Login required');
    const u = loadUsers().users.find(x => x.id === userId);
    if (!u) return res.status(401).send('Session invalid');
    res.set('X-Forwarded-User', u.email || u.id);
    res.status(200).send('ok');
});

// ---- Users (admin)
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    const { users } = loadUsers();
    res.json(users.map(u => ({ id: u.id, name: u.name || '', email: u.email, role: u.role, instances: u.instances || [], createdAt: u.createdAt })));
});
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
    const { name, email, password, role = 'user', instances = [] } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email e senha obrigatórios' });
    const data = loadUsers();
    if (data.users.find(x => (x.email||'').toLowerCase() === String(email).toLowerCase())) {
        return res.status(400).json({ error: 'email já existe' });
    }
    const u = {
        id: crypto.randomUUID(),
        name: name ? String(name) : '',
        email: String(email).toLowerCase(),
        passwordHash: bcrypt.hashSync(String(password), 10),
        role: role === 'admin' ? 'admin' : 'user',
        instances: Array.isArray(instances) ? instances : [],
        createdAt: new Date().toISOString()
    };
    data.users.push(u);
    saveUsers(data);
    // propagate ownerId to meta.json for each assigned instance
    for (const iname of u.instances) {
        const meta = loadInstanceMeta(iname);
        meta.ownerId = u.id;
        saveInstanceMeta(iname, meta);
    }
    res.json({ id: u.id, email: u.email, role: u.role, instances: u.instances });
});
app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, instances } = req.body || {};
    const data = loadUsers();
    const u = data.users.find(x => x.id === id);
    if (!u) return res.status(404).json({ error: 'não encontrado' });
    if (typeof name === 'string') u.name = name;
    if (email) {
        const newEmail = String(email).toLowerCase();
        if (newEmail !== (u.email||'').toLowerCase() && data.users.find(x => (x.email||'').toLowerCase() === newEmail)) {
            return res.status(400).json({ error: 'email já existe' });
        }
        u.email = newEmail;
    }
    if (password) u.passwordHash = bcrypt.hashSync(String(password), 10);
    if (role) u.role = role === 'admin' ? 'admin' : 'user';
    if (Array.isArray(instances)) {
        // remove ownerId from instances no longer assigned
        const oldSet = new Set(u.instances || []);
        const newSet = new Set(instances);
        for (const oldName of oldSet) {
            if (!newSet.has(oldName)) {
                const m = loadInstanceMeta(oldName); if (m.ownerId === u.id) { delete m.ownerId; saveInstanceMeta(oldName, m); }
            }
        }
        for (const newName of newSet) {
            const m = loadInstanceMeta(newName); m.ownerId = u.id; saveInstanceMeta(newName, m);
        }
        u.instances = Array.from(newSet);
    }
    saveUsers(data);
    res.json({ success: true });
});
app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const data = loadUsers();
    const u = data.users.find(x => x.id === id);
    if (!u) return res.status(404).json({ error: 'não encontrado' });
    if (u.role === 'admin' && data.users.filter(x => x.role === 'admin').length <= 1) {
        return res.status(400).json({ error: 'não remove o último admin' });
    }
    for (const iname of (u.instances || [])) {
        const m = loadInstanceMeta(iname); if (m.ownerId === u.id) { delete m.ownerId; saveInstanceMeta(iname, m); }
    }
    data.users = data.users.filter(x => x.id !== id);
    saveUsers(data);
    res.json({ success: true });
});

// ---- Settings (admin only)
app.get('/api/settings', requireAuth, requireAdmin, (req, res) => {
    const s = loadSettings();
    res.json({
        defaultProvider: s.defaultProvider || 'openai',
        providerKeys: s.providerKeys || {},
        braveKey: s.braveKey || '',
        elevenKey: s.elevenKey || '',
        groqKey: s.groqKey || '',
        whisperProvider: s.whisperProvider || 'groq'
    });
});
app.put('/api/settings', requireAuth, requireAdmin, (req, res) => {
    const s = loadSettings();
    const b = req.body || {};
    if (b.defaultProvider) s.defaultProvider = b.defaultProvider;
    if (b.providerKeys && typeof b.providerKeys === 'object') s.providerKeys = { ...(s.providerKeys||{}), ...b.providerKeys };
    if (typeof b.braveKey === 'string') s.braveKey = b.braveKey;
    if (typeof b.elevenKey === 'string') s.elevenKey = b.elevenKey;
    if (typeof b.groqKey === 'string') s.groqKey = b.groqKey;
    if (typeof b.whisperProvider === 'string' && ['groq','openai','elevenlabs'].includes(b.whisperProvider)) {
        s.whisperProvider = b.whisperProvider;
    }
    saveSettings(s);

    // Propagate WHISPER_PROVIDER + GROQ_API_KEY to all openclaw-* containers
    (async () => {
        try {
            const { stdout } = await runCommand('docker ps --filter name=^openclaw- --format "{{.Names}}"');
            const containers = stdout.trim().split('\n').filter(Boolean);
            const provider = s.whisperProvider || 'groq';
            const groqKey = s.groqKey || '';
            for (const c of containers) {
                try {
                    const updateCmd = `docker exec -u 0 ${shellQuote(c)} sh -c '
SECRETS=/home/node/.openclaw/secrets.env
[ -f "$SECRETS" ] || touch "$SECRETS"
# WHISPER_PROVIDER (replace or add)
if grep -q "^WHISPER_PROVIDER=" "$SECRETS"; then
    sed -i "s|^WHISPER_PROVIDER=.*|WHISPER_PROVIDER=${provider}|" "$SECRETS"
else
    echo "WHISPER_PROVIDER=${provider}" >> "$SECRETS"
fi
# GROQ_API_KEY
if [ -n "${groqKey}" ]; then
    if grep -q "^GROQ_API_KEY=" "$SECRETS"; then
        sed -i "s|^GROQ_API_KEY=.*|GROQ_API_KEY=${groqKey}|" "$SECRETS"
    else
        echo "GROQ_API_KEY=${groqKey}" >> "$SECRETS"
    fi
fi
chown node:node "$SECRETS"
'`;
                    await runCommand(updateCmd);
                } catch (e) { console.error('[whisper-push] ' + c + ' fail:', e.message); }
            }
            console.log('[whisper-push] propagated to ' + containers.length + ' containers (provider=' + provider + ')');
        } catch (e) { console.error('[whisper-push] error:', e.message); }
    })();
    res.json({ success: true });
});

// ---- Instances
app.get('/api/instances', requireAuth, async (req, res) => {
    try {
        const cmd = `docker ps -a --filter "label=managed-by=openoryxa" --format '{"id":"{{.ID}}", "name":"{{.Names}}", "status":"{{.Status}}", "ports":"{{.Ports}}"}'`;
        const out = await runCommand(cmd);
        const all = out.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
        const filtered = all.filter(inst => {
            const simpleName = inst.name.replace(/^openclaw-/, '');
            return userOwnsInstance(req.user, simpleName);
        }).map(inst => {
            const simpleName = inst.name.replace(/^openclaw-/, '');
            const meta = loadInstanceMeta(simpleName);
            const tg = meta.telegram || null;
            return {
                ...inst,
                persona: meta.persona || null,
                provider: meta.provider || null,
                model: meta.model || null,
                apiKey: meta.apiKey ? true : false,
                telegram: tg ? { connected: !!tg.botUsername, botUsername: tg.botUsername || null } : { connected: false, botUsername: null },
            };
        });
        res.json(filtered);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/instances/:name/status', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const containerName = `openclaw-${name}`;
    const domain = `${name}.${DOMAIN}`;
    let healthy = false, cert = false, https = false, exists = false;
    try {
        const s = (await runCommand(`docker inspect ${shellQuote(containerName)} --format '{{.State.Health.Status}}'`)).trim();
        exists = true;
        if (s === 'healthy') healthy = true;
    } catch {}
    try {
        const raw = await runCommand(`docker exec traefik cat /letsencrypt/acme.json`);
        const acme = JSON.parse(raw);
        const certs = (acme.cloudflare && acme.cloudflare.Certificates) || [];
        if (certs.some(c => ((c.domain || {}).main || '') === domain)) cert = true;
    } catch {}
    if (healthy) {
        try {
            const out = await runCommand(`curl -sI -o /dev/null -w "%{http_code}" https://${domain}/ -m 8 || true`);
            const code = parseInt(out.trim(), 10);
            if (code >= 200 && code < 400) https = true;
        } catch {}
    }
    res.json({ name, exists, healthy, cert, https, ready: healthy && https });
});


// GET /api/instances/:name/apikey — retorna a chave de API configurada (owner ou admin only)
app.get('/api/instances/:name/apikey', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const meta = loadInstanceMeta(name) || {};
    res.json({ key: meta.apiKey || null });
});

app.get('/api/instances/:name/token', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    try {
        const token = await readInstanceToken(`openclaw-${name}`);
        (async () => { for (let i = 0; i < 6; i++) { autoApprovePending(); await new Promise(r => setTimeout(r, 500)); } })();
        res.json({ name, token, url: `https://${name}.${DOMAIN}/#token=${token}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const MODEL_LABELS = {
    'openrouter/google/gemini-2.5-flash':                  'Gemini 2.5 Flash (Google) via OpenRouter',
    'openrouter/meta-llama/llama-3.3-70b-instruct':        'Llama 3.3 70B (Meta) via OpenRouter',
    'openrouter/x-ai/grok-4-fast':                          'Grok 4 Fast (xAI) via OpenRouter',
    'openrouter/x-ai/grok-4.1-fast':                        'Grok 4.1 Fast (xAI) via OpenRouter',
    'openrouter/qwen/qwen-2.5-72b-instruct':               'Qwen 2.5 72B (Alibaba) via OpenRouter',
    'openrouter/qwen/qwen3-coder':                          'Qwen3 Coder (Alibaba) via OpenRouter',
    'openrouter/deepseek/deepseek-chat-v3-0324':           'DeepSeek V3 via OpenRouter',
    'openrouter/openai/gpt-4.1-mini':                       'GPT-4.1 Mini (OpenAI) via OpenRouter',
    'openrouter/mistralai/mistral-small-3.2-24b-instruct': 'Mistral Small 3.2 via OpenRouter',
};

// Per-agent browser sidecar (linuxserver/chromium + CDP exposed via nginx
// Host-rewrite proxy on port 9223). Authorized through Traefik forwardAuth.
async function provisionBrowserSidecar(slug) {
    const cn = `browser-${slug}`;
    const dataDir = `/opt/openoryxa/browsers/${slug}`;
    try {
        const existing = (await runCommand(`docker ps -a --filter "name=^${cn}$" --format "{{.Names}}"`)).trim();
        if (existing === cn) { console.log(`[provision] ${cn} already exists`); return; }
    } catch {}
    fs.mkdirSync(dataDir, { recursive: true });
    try { await runCommand(`chown -R 1000:1000 ${shellQuote(dataDir)}`); } catch {}

    const labels = [
        'traefik.enable=true',
        `traefik.docker.network=openclaw-network`,
        `traefik.http.routers.${cn}-secure.rule=Host(\`browser-${slug}.${DOMAIN}\`)`,
        `traefik.http.routers.${cn}-secure.entrypoints=websecure`,
        `traefik.http.routers.${cn}-secure.tls=true`,
        `traefik.http.routers.${cn}-secure.tls.certresolver=cloudflare`,
        `traefik.http.routers.${cn}-secure.middlewares=browser-fwdauth@docker`,
        `traefik.http.routers.${cn}.rule=Host(\`browser-${slug}.${DOMAIN}\`)`,
        `traefik.http.routers.${cn}.entrypoints=web`,
        `traefik.http.services.${cn}.loadbalancer.server.port=3000`,
    ];
    const labelArgs = labels.map(l => `--label ${shellQuote(l)}`).join(' ');

    const cmd = `docker run -d --name ${shellQuote(cn)} --network openclaw-network --restart unless-stopped --shm-size=1g --memory=1500m -e PUID=1000 -e PGID=1000 -e TZ=America/Sao_Paulo -e ${shellQuote('CHROME_CLI=--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --remote-allow-origins=* --no-first-run --no-sandbox')} -v ${shellQuote(dataDir + ':/config')} ${labelArgs} lscr.io/linuxserver/chromium:latest 2>&1`;
    await runCommand(cmd);

    for (let i = 0; i < 30; i++) {
        try { await runCommand(`docker exec ${shellQuote(cn)} pgrep -f 'nginx: master' 2>&1`); break; }
        catch { await new Promise(r => setTimeout(r, 1000)); }
    }

    const cdpConf = `server {
    listen 0.0.0.0:9223;
    location / {
        proxy_pass http://127.0.0.1:9222;
        proxy_set_header Host "localhost:9222";
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_set_header Origin "http://localhost:9222";
        proxy_read_timeout 86400;
    }
}
`;
    const b64 = Buffer.from(cdpConf).toString('base64');
    await runCommand(`echo ${b64} | base64 -d | docker exec -u 0 -i ${shellQuote(cn)} sh -c 'cat > /etc/nginx/sites-available/cdp-proxy && ln -sf /etc/nginx/sites-available/cdp-proxy /etc/nginx/sites-enabled/cdp-proxy && nginx -t && (nginx -s reload 2>/dev/null || nginx) 2>&1'`);

    for (let i = 0; i < 60; i++) {
        try {
            const r = await runCommand(`docker exec ${shellQuote(cn)} curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:9223/json/version 2>&1`);
            if (r.trim() === '200') { console.log(`[provision] ${cn} CDP ready`); return; }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
    }
    console.warn(`[provision] ${cn} CDP not ready after 60s`);
}

async function deprovisionBrowserSidecar(slug) {
    const cn = `browser-${slug}`;
    try { await runCommand(`docker rm -f -v ${shellQuote(cn)} 2>&1`); } catch {}
    try { fs.rmSync(`/opt/openoryxa/browsers/${slug}`, { recursive: true, force: true }); } catch {}
}

async function configureBrowserOnOpenclaw(slug) {
    const cn = `openclaw-${slug}`;
    const js = `
const fs = require("fs");
const p = "/home/node/.openclaw/openclaw.json";
const c = JSON.parse(fs.readFileSync(p, "utf8"));
c.browser = {
    enabled: true,
    cdpUrl: "http://browser-${slug}:9223",
    attachOnly: true,
    remoteCdpTimeoutMs: 30000,
    remoteCdpHandshakeTimeoutMs: 30000,
    ssrfPolicy: {
        dangerouslyAllowPrivateNetwork: true
    }
};
fs.writeFileSync(p + ".tmp", JSON.stringify(c, null, 2));
fs.renameSync(p + ".tmp", p);
console.log("browser config set for ${slug}");
`;
    const b64 = Buffer.from(js).toString('base64');
    await runCommand(`echo ${b64} | base64 -d | docker exec --user 0 -i ${shellQuote(cn)} sh -c 'cat > /tmp/oryxa-set-browser.js && node /tmp/oryxa-set-browser.js' 2>&1`);
}

function buildIdentityMd(p, modelId, groupIds) {
    const modelLabel = MODEL_LABELS[modelId] || modelId || 'unknown';
    const groupId = (Array.isArray(groupIds) && groupIds[0]) ? groupIds[0] : null;
    const teamContextBlock = groupId ? `

## Team Telegram Group (CRITICAL — use this exact ID)

When you need to send a message to the team's Telegram group via the message tool, use **EXACTLY** this chat_id:

\`\`\`
${groupId}
\`\`\`

**Never invent or hallucinate a chat_id like \`-1001234567890\` or any other placeholder.** That is a generic example ID and will fail with "chat not found". The only valid group chat_id is \`${groupId}\`.

When using the \`message\` tool to send to the team group, the parameters must be:
- \`channel\`: \`"telegram"\`
- \`target\`: \`"${groupId}"\` (or \`"telegram:${groupId}"\`)

If you don't know the chat_id of a specific person/conversation, ASK the user instead of guessing.
` : '';
    return `# IDENTITY.md - Who Am I?

- **Name:** ${p.name || '—'}
- **Creature:** ${p.creature || 'AI'}
- **Vibe:** ${p.vibe || 'profissional e direto'}
- **Emoji:** ${p.emoji || '🤖'}
- **Department:** ${p.department || '—'}
- **Email:** ${p.email || '—'}
- **Underlying model:** ${modelLabel}
- **Avatar:**

## Role & Mission

You are **${p.name || 'this agent'}**, working in the **${p.department || 'general'}** department of Harakawa Tech. You serve **${p.humanName || 'the user'}** as your principal human.

## Persona Instructions

${p.instructions || '_(sem instruções adicionais)_'}

## How To Behave (CRITICAL — non-negotiable)

### 1. Never self-introduce unless explicitly asked
- **You MUST NOT introduce yourself.** Do NOT say "Olá, sou ${p.name || 'X'}", "Hi, I'm ${p.name || 'X'}", "Aqui é ${p.name || 'X'}", or any variant — EVER — unless the user literally asks "who are you?", "qual seu nome?", "se apresente", "fale sobre você", or equivalent.
- For every other message, just answer naturally without stating your name or role.
- This rule applies to ALL turns, including the very first message of a brand new chat. Do not auto-introduce. Wait to be asked.

### 2. You have memory of this conversation
- The full chat history is provided to you on every turn. Read it and continue the dialogue.
- Do NOT treat each new user message as a fresh first contact.
- Do NOT restate context the user already knows from previous turns.

### 3. Audio transcripts may garble your name — tolerate it silently
- The user often messages by voice. Audio transcription is unreliable and may turn "${p.name || 'your name'}" into similar-sounding words.
- When you receive a transcript that calls you by a slightly wrong name, **assume it is you** and respond normally.
- Never correct the user's pronunciation or transcription.

### 4. When asked which AI model powers you, answer truthfully
- The model running you right now is **${modelLabel}**.
- If the user asks "qual modelo você usa?", "what model are you?", "qué modelo eres?", or similar, answer with exactly: **${modelLabel}**.
- Do NOT invent or hallucinate a different model name. The line above is the source of truth.

### 5. Stay in character
- Do not refer to yourself as a generic assistant or as OpenClaw.
- Speak in the user's language (Portuguese / English / Spanish), matching what they used.${teamContextBlock}

### 6. Browser tool — use target="host" only
- When using the browser tool (navigate, click, type, screenshot, etc.),
  ALWAYS pass \`target="host"\` explicitly. Never use \`target="sandbox"\`.
- The host browser is the dedicated Chromium sidecar attached via CDP, viewable
  live by the human at https://browser-<your-name>.${DOMAIN}.

---

_Pré-preenchido pelo dashboard OpenOryxa AI Agents durante o onboarding._
`;
}
function buildUserMd(p) {
    return `# USER.md - About Your Human

- **Name:** ${p.humanName || '—'}
- **What to call them:** ${p.humanName || '—'}
- **Pronouns:**
- **Timezone:**
- **Notes:**

## Context

${p.instructions || '_(sem contexto adicional)_'}

---

_Pré-preenchido pelo dashboard OpenOryxa AI Agents durante o onboarding._
`;
}

app.post('/api/instances', requireAuth, async (req, res) => {
    // Only admin creates. Non-admin can request creation? For now, admin only.
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'somente admin cria instâncias' });

    const { name, ownerId } = req.body;
    const provider = req.body.provider || req.body.llmProvider || 'openai';
    const persona = req.body.persona || {};
    const settings = loadSettings();
    const providerKeys = settings.providerKeys || {};
    const apiKey = req.body.apiKey || providerKeys[provider];

    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!apiKey) return res.status(400).json({ error: `Sem API key para ${provider}. Salve a chave em Configurações.` });
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Name must be 2-40 chars, lowercase alphanumeric/dashes' });

    const instanceDir = path.join(BASE_DIR, name);
    const containerName = `openclaw-${name}`;
    try {
        const existing = await runCommand(`docker ps -a --filter "name=^${containerName}$" --format "{{.Names}}"`);
        if (existing.trim() === containerName) return res.status(400).json({ error: 'Instance already exists' });
    } catch {}
    fs.mkdirSync(instanceDir, { recursive: true });

    const labels = [
        'managed-by=openoryxa', 'managed-by=openoryxa', `subdomain=${name}`,
        'traefik.enable=true', `traefik.docker.network=${NETWORK}`,
        `traefik.http.routers.openclaw-${name}.rule=Host(\`${name}.${DOMAIN}\`)`,
        `traefik.http.routers.openclaw-${name}.entrypoints=web`,
        `traefik.http.routers.openclaw-${name}-secure.rule=Host(\`${name}.${DOMAIN}\`)`,
        `traefik.http.routers.openclaw-${name}-secure.entrypoints=websecure`,
        `traefik.http.routers.openclaw-${name}-secure.tls=true`,
        `traefik.http.routers.openclaw-${name}-secure.tls.certresolver=cloudflare`,
        `traefik.http.services.openclaw-${name}.loadbalancer.server.port=${OPENCLAW_PORT}`,
    ];
    const labelArgs = labels.map(l => `-l ${shellQuote(l)}`).join(' ');

    const envMap = {};
    for (const [p, vars] of Object.entries(PROVIDER_ENV)) {
        const key = providerKeys[p] || (p === provider ? apiKey : '');
        for (const v of vars) envMap[v] = key || '';
    }
    for (const v of PROVIDER_ENV[provider]) envMap[v] = apiKey;
    envMap.BRAVE_API_KEY = settings.braveKey || '';
    envMap.ELEVENLABS_API_KEY = settings.elevenKey || '';
    envMap.PORT = OPENCLAW_PORT;
    const envArgs = Object.entries(envMap).map(([k, v]) => `-e ${shellQuote(`${k}=${v}`)}`).join(' ');

    saveInstanceMeta(name, { name, provider, image: OPENCLAW_IMAGE, persona, ownerId: ownerId || null, createdAt: new Date().toISOString() });

    // /*rb-create-cp-start*/ Pre-seed openclaw.json with plugin whitelist BEFORE gateway boots,
    // so first run loads ~7 plugins instead of ~117. Cuts cold-start dramatically.
    const createCmd = `docker create --name ${shellQuote(containerName)} --restart unless-stopped --network ${NETWORK} ${envArgs} ${labelArgs} ${shellQuote(OPENCLAW_IMAGE)} 2>&1`;

    try {
        const containerId = (await runCommand(createCmd)).trim();
        // Stage a minimal config with whitelist; the gateway will merge auth.token + controlUi.allowedOrigins
        // on first boot but won't drop our plugins.entries.
        try {
            await runCommand(`docker exec ${shellQuote(containerName)} mkdir -p /home/node/.openclaw 2>/dev/null || true`);
            await runCommand(`docker cp /opt/openoryxa/scripts/_oryxa-preset-config.json ${shellQuote(containerName)}:/home/node/.openclaw/openclaw.json`);
            console.log(`pre-seeded plugin whitelist on ${containerName}`);
        } catch (e) { console.error('preset config cp failed:', e.message); }
        try { await installSecretsEntrypoint(containerName); console.log(`secrets-entrypoint installed on ${containerName}`); } catch (e) { console.error('secrets-entrypoint install failed:', e.message); }
        await runCommand(`docker start ${shellQuote(containerName)}`);
        const domain = `${name}.${DOMAIN}`;
        const cfgPath = '/home/node/.openclaw/openclaw.json';
        let token = null;
        // Wait for gateway to finish seeding its config: look for both file presence AND a non-null token.
        // (Gateway creates the file early, then writes token + seeds controlUi.allowedOrigins shortly after.
        //  Writing our own origins before that seed races with it — the seed wins.)
        for (let i = 0; i < 120; i++) {
            try {
                const raw = await runCommand(`docker exec ${shellQuote(containerName)} cat ${cfgPath} 2>/dev/null`);
                const parsed = JSON.parse(raw);
                const t = parsed?.gateway?.auth?.token;
                if (t) { token = t; break; }
            } catch {}
            await new Promise(r => setTimeout(r, 1000));
        }
        // Additionally wait for /healthz to come up so subsequent config ops don't collide with an in-flight seed.
        for (let i = 0; i < 120; i++) {
            try {
                const out = await runCommand(`docker exec ${shellQuote(containerName)} sh -c 'curl -sf -o /dev/null http://127.0.0.1:18789/healthz && echo ok'`);
                if (out.includes('ok')) break;
            } catch {}
            await new Promise(r => setTimeout(r, 1000));
        }

        // Use the gateway's own CLI to persist changes (so its internal reload loop doesn't clobber us)
        try {
            const origins = JSON.stringify([
                'http://localhost:18789', 'http://127.0.0.1:18789',
                `https://${domain}`, `http://${domain}`,
                `https://dashboard.${DOMAIN}`, `http://dashboard.${DOMAIN}`,
            ]);
            await runCommand(`docker exec ${shellQuote(containerName)} openclaw config set gateway.controlUi.allowedOrigins ${shellQuote(origins)} 2>&1`);
        } catch (e) { console.error('config set allowedOrigins failed:', e.message); }

        // Patch silent-pairing BEFORE restart so new start serves patched gateway
        try { await patchSilentPairing(containerName); } catch {}
        // Install pairing CLI fix-wrapper so `openclaw pairing list/approve` works.
        try { await installPairingWrapper(containerName); } catch {}
        // Pre-add WhatsApp channel so the whatsapp_login tool is registered from first boot
        try { await runCommand(`docker exec ${shellQuote(containerName)} openclaw channels add --channel whatsapp 2>&1`); } catch (e) { console.error('channels add whatsapp failed:', e.message); }
        try { await ensureAgentModelForProvider(containerName, provider); } catch (e) { console.error('ensureAgentModelForProvider:', e.message); }
        // Apply plugin slimming so warmup goes from 117 plugins (~80s system-prompt) to ~11 (~11s)
        try {
            await runCommand(`docker cp /opt/openoryxa/scripts/_oryxa-optimize-plugins.js ${shellQuote(containerName)}:/tmp/oryxa-optimize.js`);
            const out = await runCommand(`docker exec ${shellQuote(containerName)} node /tmp/oryxa-optimize.js`);
            console.log(`plugin-slim on ${containerName}: ${out.trim()}`);
        } catch (e) { console.error('plugin-slim failed:', e.message); }
        // Default WhatsApp/Telegram dmPolicy = "disabled": ignore inbound DMs entirely
        // until the owner explicitly configures access via the dashboard. The upstream
        // default "pairing" auto-replies to every unknown sender with a pairing code,
        // which spams contacts when the bot runs on the owner's personal phone number
        // (the common case in this SaaS). "allowlist" would also work but the OpenClaw
        // validator rejects an empty allowFrom, which is what we have at provisioning.
        try {
            const setPolicyJs = `
const fs = require("fs");
const p = "/home/node/.openclaw/openclaw.json";
const c = JSON.parse(fs.readFileSync(p, "utf8"));
c.channels = c.channels || {};
for (const ch of ["whatsapp", "telegram"]) {
  c.channels[ch] = c.channels[ch] || {};
  // "disabled" = ignore DMs from anyone until owner explicitly configures access.
  // "allowlist" would also work but the OpenClaw config validator rejects it when
  // allowFrom is empty, which is the case at fresh provisioning. Owner can switch
  // to allowlist + populate allowFrom from the dashboard once ready.
  if (c.channels[ch].dmPolicy === undefined) c.channels[ch].dmPolicy = "disabled";
  if (c.channels[ch].accounts) {
    for (const acc of Object.values(c.channels[ch].accounts)) {
      if (acc && acc.dmPolicy === undefined) acc.dmPolicy = "disabled";
    }
  }
}
fs.writeFileSync(p + ".tmp", JSON.stringify(c, null, 2));
fs.renameSync(p + ".tmp", p);
console.log("default-dm-policy-disabled-set");
`;
            const b64 = Buffer.from(setPolicyJs).toString('base64');
            await runCommand(`echo ${b64} | base64 -d | docker exec --user 0 -i ${shellQuote(containerName)} sh -c 'cat > /tmp/rb-set-policy.js && node /tmp/rb-set-policy.js'`);
        } catch (e) { console.error('default dmPolicy set failed:', e.message); }
        try {
            await provisionBrowserSidecar(name);
            await configureBrowserOnOpenclaw(name);
            console.log(`[create] browser sidecar provisioned for ${name}`);
        } catch (e) {
            console.error(`[create] browser sidecar provision failed for ${name}:`, e.message);
        }
        await runCommand(`docker restart ${shellQuote(containerName)}`);

        (async () => {
            // Wait for healthy first
            for (let i = 0; i < 120; i++) {
                try {
                    const s = (await runCommand(`docker inspect ${shellQuote(containerName)} --format '{{.State.Health.Status}}'`)).trim();
                    if (s === 'healthy') break;
                } catch {}
                await new Promise(r => setTimeout(r, 2000));
            }
            // Seed IDENTITY.md + USER.md, then re-seed a few times to beat any gateway bootstrap overwrites.
            const doSeed = async () => {
                /*rb-bootstrap-seed-via-cp*/
                // docker exec stdin pipes are unreliable when the container is
                // still booting plugins. Use docker cp + chown which is atomic.
                const tmpDir = require('os').tmpdir();
                const idPath = require('path').join(tmpDir, `identity-${name}-${Date.now()}.md`);
                const usPath = require('path').join(tmpDir, `user-${name}-${Date.now()}.md`);
                fs.writeFileSync(idPath, buildIdentityMd(persona, (loadInstanceMeta(name) || {}).model, ((loadInstanceMeta(name) || {}).telegram || {}).groupIds));
                fs.writeFileSync(usPath, buildUserMd(persona));
                try {
                    await runCommand(`docker exec --user 0 ${shellQuote(containerName)} sh -c 'mkdir -p /home/node/.openclaw/workspace && chown -R node:node /home/node/.openclaw/workspace'`);
                    await runCommand(`docker cp ${shellQuote(idPath)} ${shellQuote(containerName)}:/home/node/.openclaw/workspace/IDENTITY.md`);
                    await runCommand(`docker cp ${shellQuote(usPath)} ${shellQuote(containerName)}:/home/node/.openclaw/workspace/USER.md`);
                    await runCommand(`docker exec --user 0 ${shellQuote(containerName)} chown node:node /home/node/.openclaw/workspace/IDENTITY.md /home/node/.openclaw/workspace/USER.md`);
                } finally {
                    try { fs.unlinkSync(idPath); } catch {}
                    try { fs.unlinkSync(usPath); } catch {}
                }
            };
            for (const delay of [0, 15000, 45000, 90000]) {
                if (delay) await new Promise(r => setTimeout(r, delay));
                try {
                    await doSeed();
                    console.log(`seeded IDENTITY.md + USER.md for ${containerName} (t+${delay}ms)`);
                } catch (e) { console.error(`bootstrap seed failed (t+${delay}ms):`, e.message); }
            }
        })();

        // attach owner
        if (ownerId) {
            const data = loadUsers();
            const u = data.users.find(x => x.id === ownerId);
            if (u) { if (!(u.instances||[]).includes(name)) { u.instances = [...(u.instances||[]), name]; saveUsers(data); } }
        }

        // Provision new instance: canonical CLI + neutral keys + workspace template (async)
        setTimeout(() => {
            const fs2 = require("fs");
            try { fs2.appendFileSync("/var/log/agent-provisioning-hook.log", `[${new Date().toISOString()}] hook fired for ${containerName}
`); } catch {}
            const { exec } = require("child_process");
            exec(`/opt/openoryxa/scripts/provision-agent.sh ${containerName} >> /var/log/agent-provisioning.log 2>&1`, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[provision] FAIL ${containerName}:`, err.message);
                    try { fs2.appendFileSync("/var/log/agent-provisioning-hook.log", `[${new Date().toISOString()}] FAIL ${containerName}: ${err.message}
`); } catch {}
                } else {
                    console.log(`[provision] DONE ${containerName}`);
                    try { fs2.appendFileSync("/var/log/agent-provisioning-hook.log", `[${new Date().toISOString()}] DONE ${containerName}
`); } catch {}
                }
            });
        }, 8000);
        res.json({ success: true, url: `https://${domain}/#token=${token || ''}`, containerId, gatewayToken: token, provisioning: true });
    } catch (err) {
        try { await runCommand(`docker rm -f ${shellQuote(containerName)} 2>/dev/null`); } catch {}
        try { fs.rmSync(instanceDir, { recursive: true, force: true }); } catch {}
        res.status(500).json({ error: 'docker run failed', stdout: err.stdout, stderr: err.stderr || err.message });
    }
});

// ---- WhatsApp QR (direct channel login; no LLM round-trip)
// Spawns `openclaw channels login --channel whatsapp` inside the instance container,
// parses the ASCII half-block QR it prints to stdout, and exposes it as an SVG data URL.
const waState = new Map();
const waProcesses = new Map();

function waAsciiQrToSvg(blockLines) {
    if (!blockLines || blockLines.length === 0) return null;
    const matrix = [];
    let width = 0;
    for (const line of blockLines) {
        const topRow = [];
        const botRow = [];
        for (const ch of Array.from(line)) {
            if (ch === '\u2580') { topRow.push(1); botRow.push(0); }
            else if (ch === '\u2584') { topRow.push(0); botRow.push(1); }
            else if (ch === '\u2588') { topRow.push(1); botRow.push(1); }
            else { topRow.push(0); botRow.push(0); }
        }
        if (topRow.length > width) width = topRow.length;
        matrix.push(topRow, botRow);
    }
    const h = matrix.length;
    const w = width;
    if (w < 10 || h < 10) return null;
    const pad = 2;
    const vb = w + pad * 2;
    let body = `<rect width="${vb}" height="${w+pad*2}" fill="#fff"/>`;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (matrix[y] && matrix[y][x]) {
                body += `<rect x="${x+pad}" y="${y+pad}" width="1" height="1" fill="#000"/>`;
            }
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges">${body}</svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function waStartLogin(cn, name) {
    const existing = waProcesses.get(cn);
    if (existing && !existing.exited) return existing;

    const ctx = {
        proc: null,
        buffer: '',
        collecting: false,
        qrLines: [],
        exited: false,
        startedAt: Date.now(),
    };

    const proc = spawn('docker', ['exec', '-i', cn, 'node', '/tmp/wa-qr-gen.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
    ctx.proc = proc;
    waProcesses.set(cn, ctx);

    const handleData = (chunk) => {
        ctx.buffer += chunk.toString('utf8');
        const lines = ctx.buffer.split('\n');
        ctx.buffer = lines.pop() || '';
        for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '');
            if (/scan this qr/i.test(line)) {
                ctx.collecting = true;
                ctx.qrLines = [];
                continue;
            }
            if (ctx.collecting) {
                if (/^[\u2580\u2584\u2588 ]+$/.test(line) && line.trim().length > 10) {
                    ctx.qrLines.push(line);
                    continue;
                }
                // End of QR block — finalize
                if (ctx.qrLines.length >= 10) {
                    const dataUrl = waAsciiQrToSvg(ctx.qrLines);
                    if (dataUrl) {
                        waState.set(name, { qr: dataUrl, generating: false, generatedAt: Date.now() });
                    }
                }
                ctx.collecting = false;
                ctx.qrLines = [];
            }
            if (/(?:whatsapp|account)\s+(?:linked|paired|connected|logged\s+in)\b|\blinked\s+successfully\b|\bpaired\s+with\s+\d|connection\s+open|wa\s*ready/i.test(line)) {
                waState.set(name, { connected: true, generating: false, qr: null });
                try { proc.kill('SIGTERM'); } catch {}
            }
        }
    };

    proc.stdout.on('data', handleData);
    proc.stderr.on('data', handleData);
    proc.on('exit', () => {
        ctx.exited = true;
        waProcesses.delete(cn);
    });

    // Safety timeout: 5 min then kill
    setTimeout(() => {
        if (!ctx.exited) { try { proc.kill('SIGTERM'); } catch {} }
    }, 5 * 60 * 1000);

    return ctx;
}

app.patch('/api/instances/:name/persona', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    try {
        const meta = loadInstanceMeta(name) || {};
        const incoming = req.body || {};
        const prev = meta.persona || {};
        const allowed = ['name','creature','vibe','emoji','humanName','department','email','instructions','departmentEn','positionEn','functionEn','descriptionEn','companyName'];
        const nextPersona = { ...prev };
        for (const k of allowed) if (k in incoming) nextPersona[k] = typeof incoming[k] === 'string' ? incoming[k] : prev[k];
        if ('topicsEn' in incoming) {
            nextPersona.topicsEn = Array.isArray(incoming.topicsEn)
                ? incoming.topicsEn.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()).slice(0, 10)
                : (prev.topicsEn || []);
        }
        meta.persona = nextPersona;

        // Per-instance API key: save to meta and update secrets.env in container
        if (typeof incoming.apiKey === 'string' && incoming.apiKey.trim()) {
            const ak = incoming.apiKey.trim();
            meta.apiKey = ak;
            (async () => {
                try {
                    const cn = 'openclaw-' + name;
                    await runCommand(
                        'docker exec ' + cn + ' sh -c ' + JSON.stringify(
                            'grep -v \'\'^OPENAI_API_KEY=\'\' /home/node/.openclaw/secrets.env > /tmp/s.tmp 2>/dev/null; ' +
                            'echo OPENAI_API_KEY=' + ak + ' >> /tmp/s.tmp; ' +
                            'mv /tmp/s.tmp /home/node/.openclaw/secrets.env'
                        )
                    );
                } catch (e) { console.error('[persona] apiKey update failed:', e.message); }
            })();
        }

        // /*rb-provider-edit*/ allow switching provider (env keys for all providers are baked at create time)
        const newProvider = (incoming.provider || '').trim();
        let providerChanged = false;
        if (newProvider && PROVIDER_TO_MODEL[newProvider] && newProvider !== meta.provider) {
            meta.provider = newProvider;
            providerChanged = true;
        }
        meta.updatedAt = new Date().toISOString();
        saveInstanceMeta(name, meta);
        if (providerChanged) {
            (async () => {
                try {
                    const cn = `openclaw-${name}`;
                    await ensureAgentModelForProvider(cn, newProvider);
                    await runCommand(`docker restart ${shellQuote(cn)}`);
                    console.log(`provider switched on ${cn}: ${newProvider} (${PROVIDER_TO_MODEL[newProvider]})`);
                } catch (e) { console.error(`provider switch failed for ${name}:`, e.message); }
            })();
        }
        // Re-seed IDENTITY.md + USER.md inside the container so the agent sees the change.
        (async () => {
            try {
                const cn = `openclaw-${name}`;
                const identity = Buffer.from(buildIdentityMd(nextPersona, meta.model, (meta.telegram || {}).groupIds)).toString('base64');
                const user = Buffer.from(buildUserMd(nextPersona)).toString('base64');
                await runCommand(`echo ${identity} | base64 -d | docker exec -i ${shellQuote(cn)} sh -c 'cat > /home/node/.openclaw/workspace/IDENTITY.md'`);
                await runCommand(`echo ${user} | base64 -d | docker exec -i ${shellQuote(cn)} sh -c 'cat > /home/node/.openclaw/workspace/USER.md'`);
                console.log(`re-seeded IDENTITY.md + USER.md for ${cn} after persona edit`);
            } catch (e) { console.error(`persona re-seed failed for ${name}:`, e.message); }
        })();
        res.json({ success: true, persona: nextPersona, provider: meta.provider });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/instances/:name/avatar { imageBase64 } — sobe avatar circular do agente
app.post("/api/instances/:name/avatar", requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const b64 = (req.body && req.body.imageBase64 || '').trim();
    if (!b64) return res.status(400).json({ error: 'imageBase64 required' });
    const m = b64.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    const raw = m ? m[2] : b64;
    let buf;
    try { buf = Buffer.from(raw, 'base64'); } catch { return res.status(400).json({ error: 'invalid base64' }); }
    if (!buf || buf.length < 100) return res.status(400).json({ error: 'image too small' });
    if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'image too large (max 8MB)' });
    try {
        const dir = '/app/public/avatars';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${name}.png`), buf);
        res.json({ success: true, url: `/avatars/${name}.png?t=${Date.now()}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Whitelist of LLM models (all confirmed to support tool use via OpenRouter).
// Frontend mirrors this in app.js MODELS — keep in sync.
const ALLOWED_MODELS = new Set([
    'openrouter/google/gemini-2.5-flash',
    'openrouter/meta-llama/llama-3.3-70b-instruct',
    'openrouter/x-ai/grok-4-fast',
    'openrouter/x-ai/grok-4.1-fast',
    'openrouter/qwen/qwen-2.5-72b-instruct',
    'openrouter/qwen/qwen3-coder',
    'openrouter/deepseek/deepseek-chat-v3-0324',
    'openrouter/openai/gpt-4.1-mini',
    'openrouter/mistralai/mistral-small-3.2-24b-instruct',
]);

// PATCH /api/instances/:name/model { model } — change LLM for one instance
app.patch('/api/instances/:name/model', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const model = (req.body && req.body.model || '').trim();
    if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'model not in whitelist' });
    const cn = `openclaw-${name}`;
    try {
        // 1) Update openclaw.json inside container
        const raw = await runCommand(`docker exec ${shellQuote(cn)} cat /home/node/.openclaw/openclaw.json`);
        const cfg = JSON.parse(raw);
        cfg.agents = cfg.agents || {};
        cfg.agents.defaults = { ...(cfg.agents.defaults || {}), model };
        const newRaw = JSON.stringify(cfg, null, 2);
        const b64 = Buffer.from(newRaw).toString('base64');
        await runCommand(`echo ${b64} | base64 -d | docker exec -i ${shellQuote(cn)} sh -c 'cat > /home/node/.openclaw/openclaw.json'`);
        // 2) Persist in meta.json so /api/instances reflects it without docker exec
        const meta = loadInstanceMeta(name) || {};
        meta.model = model;
        meta.updatedAt = new Date().toISOString();
        saveInstanceMeta(name, meta);
        // 3) Re-seed IDENTITY.md so the agent knows its new model name when asked
        try {
            const idMd = buildIdentityMd(meta.persona || {}, model, (meta.telegram || {}).groupIds);
            const idB64 = Buffer.from(idMd).toString('base64');
            await runCommand(`echo ${idB64} | base64 -d | docker exec -i ${shellQuote(cn)} sh -c 'cat > /home/node/.openclaw/workspace/IDENTITY.md'`);
        } catch (e) { console.error(`identity re-seed ${cn}:`, e.message); }
        // 4) Restart container so gateway picks up new model
        runCommand(`docker restart ${shellQuote(cn)}`).catch(e => console.error(`model restart ${cn}:`, e.message));
        res.json({ success: true, model });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// =================================================================
// Team-admin endpoints — used by Clair (Administrative AI Agent)
// to monitor and remediate the team. Auth via shared secret read from
// /opt/openoryxa/instances/.team-admin-secret (mounted volume).
// =================================================================
function loadTeamAdminSecret() {
    try { return fs.readFileSync('/opt/openoryxa/instances/.team-admin-secret', 'utf8').trim(); }
    catch { return null; }
}
function requireTeamAdmin(req, res, next) {
    const expected = loadTeamAdminSecret();
    const got = req.headers['x-team-secret'] || req.headers['X-Team-Secret'];
    if (!expected || got !== expected) return res.status(401).json({ error: 'invalid team secret' });
    next();
}

const TEAM_AGENT_NAMES = ['clair','aurora','luna','sofia','iris','helena','bella'];

// GET /api/team/loops — detect agents flooding the group with repeats
app.get('/api/team/loops', requireTeamAdmin, async (req, res) => {
    try {
        const out = await runCommand(`docker logs --since 90s oryxa-userbot 2>&1 | grep "saved msg from" || true`);
        const counts = {};
        const lastTexts = {};
        for (const line of out.split('\n')) {
            const m = line.match(/saved msg from @([a-z0-9_]+)_oryxa_bot:\s*(.*)$/i);
            if (!m) continue;
            const name = m[1];
            const text = (m[2] || '').slice(0, 80);
            counts[name] = (counts[name] || 0) + 1;
            lastTexts[name] = text;
        }
        const looping = Object.entries(counts)
            .filter(([_, c]) => c >= 3)
            .map(([name, count]) => ({ name, count, lastText: lastTexts[name] }));
        res.json({ windowSeconds: 90, looping, allCounts: counts });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/team/restart-instance { name } — restart an agent (e.g. to break a loop)
app.post('/api/team/restart-instance', requireTeamAdmin, async (req, res) => {
    const { name } = req.body || {};
    if (!TEAM_AGENT_NAMES.includes(name)) return res.status(400).json({ error: 'unknown agent' });
    try {
        await runCommand(`docker restart ${shellQuote('openclaw-' + name)}`);
        res.json({ success: true, restarted: name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/team/set-model { name, model } — change LLM of an agent (full fix path)
app.post('/api/team/set-model', requireTeamAdmin, async (req, res) => {
    const { name, model } = req.body || {};
    if (!TEAM_AGENT_NAMES.includes(name)) return res.status(400).json({ error: 'unknown agent' });
    if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'model not in whitelist', allowed: [...ALLOWED_MODELS] });
    const cn = `openclaw-${name}`;
    try {
        const raw = await runCommand(`docker exec ${shellQuote(cn)} cat /home/node/.openclaw/openclaw.json`);
        const cfg = JSON.parse(raw);
        cfg.agents = cfg.agents || {};
        cfg.agents.defaults = { ...(cfg.agents.defaults || {}), model };
        const b64 = Buffer.from(JSON.stringify(cfg, null, 2)).toString('base64');
        await runCommand(`echo ${b64} | base64 -d | docker exec -i ${shellQuote(cn)} sh -c 'cat > /home/node/.openclaw/openclaw.json'`);
        const meta = loadInstanceMeta(name) || {};
        meta.model = model;
        meta.updatedAt = new Date().toISOString();
        saveInstanceMeta(name, meta);
        try {
            const idMd = buildIdentityMd(meta.persona || {}, model, (meta.telegram || {}).groupIds);
            const idB64 = Buffer.from(idMd).toString('base64');
            await runCommand(`echo ${idB64} | base64 -d | docker exec -i ${shellQuote(cn)} sh -c 'cat > /home/node/.openclaw/workspace/IDENTITY.md'`);
        } catch (e) { console.error(`identity re-seed ${cn}:`, e.message); }
        runCommand(`docker restart ${shellQuote(cn)}`).catch(e => console.error(`model restart ${cn}:`, e.message));
        res.json({ success: true, name, model });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/team/agents — list current model per agent (Clair uses this to know who is on what)
app.get('/api/team/agents', requireTeamAdmin, (req, res) => {
    const list = TEAM_AGENT_NAMES.map(n => {
        const m = loadInstanceMeta(n) || {};
        return { name: n, model: m.model || null, department: (m.persona || {}).departmentEn || (m.persona || {}).department || null };
    });
    res.json({ agents: list });
});

// /*rb-telegram-setup*/ POST /api/instances/:name/telegram/setup { token }
app.post('/api/instances/:name/telegram/setup', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const token = (req.body && req.body.token || '').trim();
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) return res.status(400).json({ error: 'invalid token format' });
    const cn = 'openclaw-' + name;
    try {
        const me = await telegramGetMe(token);
        if (!me || !me.ok) return res.status(400).json({ error: 'telegram getMe failed: ' + JSON.stringify(me).slice(0, 200) });
        const username = me.result && me.result.username || null;
        const meta = loadInstanceMeta(name) || {};
        const prevTg = meta.telegram || {};
        const ownerUserId = String((req.body && req.body.ownerUserId) || prevTg.ownerUserId || '').trim();
        const groupIds = Array.isArray(req.body && req.body.groupIds)
            ? req.body.groupIds.filter(Boolean).map(String)
            : (Array.isArray(prevTg.groupIds) ? prevTg.groupIds.map(String) : []);
        meta.telegram = {
            botToken: token,
            botUsername: username,
            ownerUserId: ownerUserId || undefined,
            groupIds,
            configuredAt: new Date().toISOString()
        };
        saveInstanceMeta(name, meta);
        await installSecretsEntrypoint(cn);
        await writeSecretsEnv(cn, { TELEGRAM_BOT_TOKEN: token });
        await patchOpenclawConfigForTelegram(cn, username, token, ownerUserId, groupIds);
        await runCommand('docker restart ' + shellQuote(cn));
        res.json({ success: true, botUsername: username, botUrl: username ? 'https://t.me/' + username : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/instances/:name/telegram/status', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const meta = loadInstanceMeta(name) || {};
    const tg = meta.telegram || {};
    res.json({ configured: !!tg.botToken, botUsername: tg.botUsername || null, botUrl: tg.botUsername ? 'https://t.me/' + tg.botUsername : null });
});


app.post('/api/instances/:name/whatsapp/start', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const cn = `openclaw-${name}`;
    // Clear any stale state; kick off a fresh login session
    const prev = waState.get(name);
    if (!prev || !prev.qr) waState.set(name, { generating: true, startedAt: Date.now() });
    try {
        waStartLogin(cn, name);
        res.json({ success: true, status: 'generating' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/instances/:name/whatsapp/qr', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const cn = `openclaw-${name}`;
    // PRIMARY: read /tmp/wa-qr.json from container (written by our wa-qr-gen.mjs script)
    try {
        const raw = await runCommand(`docker exec ${shellQuote(cn)} cat /tmp/wa-qr.json 2>/dev/null`);
        const data = JSON.parse(raw);
        if (data.status === 'qr' && data.dataUrl) return res.json({ status: 'qr', dataUrl: data.dataUrl, message: 'Escaneie no WhatsApp' });
        if (data.status === 'connected') return res.json({ status: 'connected', message: 'WhatsApp conectado' });
        if (data.status === 'error') return res.json({ status: 'error', message: data.message || 'erro' });
        if (data.status === 'starting') {
            const elapsed = Math.round((Date.now() - (data.ts || Date.now())) / 1000);
            return res.json({ status: 'generating', message: `Gerando QR (${elapsed}s)...` });
        }
    } catch {}
    const state = waState.get(name) || {};
    if (state.generating) {
        const elapsed = Math.round((Date.now() - (state.startedAt || Date.now())) / 1000);
        return res.json({ status: 'generating', message: `Gerando QR (${elapsed}s)...` });
    }
    return res.json({ status: 'idle', message: 'Ainda não iniciado' });
});


// /*rb-fast-chat*/ direct provider call, bypasses agent/embedded for sub-3s responses
const fastHistory = new Map(); // name -> array of {role, content}
const PROVIDER_URLS = {
    openai:     { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', auth: (k) => ({ Authorization: 'Bearer ' + k }) },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-4o-mini', auth: (k) => ({ Authorization: 'Bearer ' + k }) },
    xai:        { url: 'https://api.x.ai/v1/chat/completions', model: 'grok-4', auth: (k) => ({ Authorization: 'Bearer ' + k }) },
    gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', model: 'gemini-2.5-flash', auth: (k) => ({ 'x-goog-api-key': k }) },
};

function buildSystemPrompt(persona) {
    const p = persona || {};
    const lines = [];
    if (p.agentName) lines.push('Voce eh ' + p.agentName + (p.type ? ' (' + p.type + ')' : '') + '.');
    if (p.vibe) lines.push('Personalidade: ' + p.vibe + '.');
    if (p.department) lines.push('Departamento: ' + p.department + '.');
    if (p.humanName) lines.push('Quem fala com voce: ' + p.humanName + '.');
    if (p.instructions) lines.push(p.instructions);
    lines.push('Responda sempre em portugues brasileiro, conciso.');
    return lines.join('\n');
}

async function fastCallOpenAILike(cfg, apiKey, system, history, message) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    for (const h of history) messages.push({ role: h.role, content: h.content });
    messages.push({ role: 'user', content: message });
    const r = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cfg.auth(apiKey) },
        body: JSON.stringify({ model: cfg.model, messages, temperature: 0.7 }),
    });
    if (!r.ok) throw new Error('LLM HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return j?.choices?.[0]?.message?.content || '';
}

async function fastCallGemini(cfg, apiKey, system, history, message) {
    const contents = [];
    for (const h of history) contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
    contents.push({ role: 'user', parts: [{ text: message }] });
    const body = { contents };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const r = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cfg.auth(apiKey) },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('LLM HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

app.post('/api/instances/:name/chat-fast', requireAuth, async (req, res) => {
    const t0 = Date.now();
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const message = (req.body && typeof req.body.message === 'string') ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'message required' });
    const reset = !!(req.body && req.body.reset);
    if (reset) fastHistory.delete(name);

    const meta = loadInstanceMeta(name);
    const provider = meta.provider || 'gemini';
    const cfg = PROVIDER_URLS[provider];
    if (!cfg) return res.status(400).json({ error: 'unsupported provider: ' + provider });
    const settings = loadSettings();
    const apiKey = (settings.providerKeys || {})[provider];
    if (!apiKey) return res.status(400).json({ error: 'no api key for ' + provider });

    const system = buildSystemPrompt(meta.persona);
    const history = fastHistory.get(name) || [];

    let reply = '';
    try {
        if (provider === 'gemini') reply = await fastCallGemini(cfg, apiKey, system, history, message);
        else reply = await fastCallOpenAILike(cfg, apiKey, system, history, message);
    } catch (e) {
        return res.status(502).json({ error: e.message, ms: Date.now() - t0 });
    }

    const next = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }];
    if (next.length > 30) next.splice(0, next.length - 30);
    fastHistory.set(name, next);

    res.json({ reply, ms: Date.now() - t0, model: cfg.model, provider });
});

app.get('/api/instances/:name/chat-fast/history', requireAuth, async (req, res) => {
    const { name } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    res.json({ history: fastHistory.get(name) || [] });
});

app.post('/api/instances/:name/:action', requireAuth, async (req, res) => {
    /*rb-admin-lifecycle-guard*/
    const __action = req.params.action;
    const __lifecycle = new Set(['start','stop','restart','delete','pause']);
    if (__lifecycle.has(__action) && req.user && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'somente admin pode alterar o estado da instância' });
    }
    const { name, action } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ error: 'forbidden' });
    const containerName = `openclaw-${name}`;
    const instanceDir = path.join(BASE_DIR, name);
    try {
        if (action === 'delete') {
            if (req.user.role !== 'admin') return res.status(403).json({ error: 'somente admin exclui' });
            const domain = `${name}.${DOMAIN}`;
            // 1) stop + remove container + its anonymous volumes (-v)
            try { await runCommand(`docker rm -f -v ${shellQuote(containerName)} 2>&1`); } catch {}
            try { await deprovisionBrowserSidecar(name); console.log(`[delete] browser sidecar removed for ${name}`); } catch (e) { console.error("[delete] browser sidecar cleanup failed:", e.message); }
            // 2) remove any named volume prefixed with the container name
            try {
                const vols = (await runCommand(`docker volume ls -q --filter name=${shellQuote(containerName)}`)).trim().split('\n').filter(Boolean);
                for (const v of vols) { try { await runCommand(`docker volume rm -f ${shellQuote(v)} 2>&1`); } catch {} }
            } catch {}
            // 3) remove local instance directory (meta.json, compose files, any workspace)
            try { fs.rmSync(instanceDir, { recursive: true, force: true }); } catch {}
            // 4) detach from users
            const d = loadUsers();
            for (const u of d.users) { if ((u.instances||[]).includes(name)) u.instances = u.instances.filter(x => x !== name); }
            saveUsers(d);
            // 5) flush any cached WhatsApp QR
            waState.delete(name);
            // 6) prune LE cert for this subdomain from traefik acme.json
            try {
                const raw = await runCommand(`docker exec traefik cat /letsencrypt/acme.json`);
                const acme = JSON.parse(raw);
                if (acme.cloudflare && Array.isArray(acme.cloudflare.Certificates)) {
                    const before = acme.cloudflare.Certificates.length;
                    acme.cloudflare.Certificates = acme.cloudflare.Certificates.filter(c => ((c.domain || {}).main || '') !== domain);
                    if (acme.cloudflare.Certificates.length !== before) {
                        const patched = Buffer.from(JSON.stringify(acme, null, 2)).toString('base64');
                        await runCommand(`echo ${patched} | base64 -d | docker exec -i traefik sh -c 'cat > /letsencrypt/acme.json && chmod 600 /letsencrypt/acme.json'`);
                        console.log(`pruned LE cert for ${domain}`);
                    }
                }
            } catch (e) { console.error('acme prune failed:', e.message); }
            console.log(`deleted instance ${name}: container+volumes+dir+user-links+cert+qr-cache wiped`);
        } else if (['start','stop','restart'].includes(action)) {
            await runCommand(`docker ${action} ${shellQuote(containerName)} 2>&1`);
        } else return res.status(400).json({ error: 'Invalid action' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message, stderr: err.stderr }); }
});

// Static (serves login page if unauthenticated)
app.use(express.static('public', {
    setHeaders: (res) => res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
}));

// /*team-bus*/ Inter-agent task delegation bus
const TEAM_BUS_DIR = "/opt/openoryxa/team-bus";
const TEAM_BUS_PENDING = path.join(TEAM_BUS_DIR, "pending");
const TEAM_BUS_ARCHIVE = path.join(TEAM_BUS_DIR, "archive");
const TEAM_BUS_RESPONSES = path.join(TEAM_BUS_DIR, "responses");
fs.mkdirSync(TEAM_BUS_PENDING, { recursive: true });
fs.mkdirSync(TEAM_BUS_ARCHIVE, { recursive: true });
fs.mkdirSync(TEAM_BUS_RESPONSES, { recursive: true });

const TEAM_BUS_SECRET_PATH = path.join(TEAM_BUS_DIR, ".secret");
let TEAM_BUS_SECRET = process.env.TEAM_BUS_SECRET || "";
if (!TEAM_BUS_SECRET) {
    if (fs.existsSync(TEAM_BUS_SECRET_PATH)) {
        TEAM_BUS_SECRET = fs.readFileSync(TEAM_BUS_SECRET_PATH, "utf8").trim();
    } else {
        TEAM_BUS_SECRET = crypto.randomBytes(24).toString("hex");
        fs.writeFileSync(TEAM_BUS_SECRET_PATH, TEAM_BUS_SECRET, { mode: 0o600 });
    }
}
console.log("[team-bus] ready, secret prefix:", TEAM_BUS_SECRET.slice(0, 8) + "...");

function busAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== TEAM_BUS_SECRET) return res.status(401).json({ error: "invalid bus token" });
    next();
}

const VALID_AGENTS = ["clair", "aurora", "luna", "sofia", "iris", "helena", "bella"];

// Agents POST here to delegate a task to another agent
// ─── Sugerir emoji para nova agente (via Gemini free) ───
app.post('/api/suggest-emoji', requireAuth, async (req, res) => {
    try {
        const { persona, department, type, vibe, humanName } = req.body || {};
        const parts = [];
        if (persona) parts.push(`Nome: ${persona}`);
        if (humanName) parts.push(`Humano: ${humanName}`);
        if (department) parts.push(`Departamento: ${department}`);
        if (type) parts.push(`Tipo: ${type}`);
        if (vibe) parts.push(`Vibe: ${vibe}`);
        if (parts.length === 0) {
            return res.status(400).json({ ok: false, error: 'Preenche pelo menos 1 campo (nome ou departamento)' });
        }
        const prompt = `Sugere UM unico emoji que represente esta agente IA. Responde APENAS com o emoji, sem texto, sem aspas, sem markdown.\n\n${parts.join('\n')}`;

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY nao configurado no manager' });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 20 },
        });
        const resp = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
            return res.status(500).json({ ok: false, error: (data.error && data.error.message) || 'Gemini erro' });
        }
        const text = (((data.candidates || [])[0] || {}).content || {}).parts || [];
        let emoji = (text[0] && text[0].text || '').trim();
        // Remove eventuais aspas, espaços extra, ou múltiplos emojis (fica só o primeiro grafema)
        emoji = emoji.replace(/["'`]/g, '').trim();
        // Pega só primeiro grafema (emoji pode ser sequência ZWJ)
        const seg = Array.from(emoji);
        if (seg.length === 0) return res.status(500).json({ ok: false, error: 'Sem emoji devolvido' });
        // Primeiro "code point cluster" — split simples
        emoji = seg.slice(0, 4).join('');  // max 4 code points (handles ZWJ)
        res.json({ ok: true, emoji });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── Cron Jobs per-instance (oryxa cron internal) ────────────────────────
app.get('/api/instances/:name/cron', requireAuth, async (req, res) => {
    const name = req.params.name;
    if (!userOwnsInstance(req.user, name)) return res.status(403).json({ ok: false, error: 'forbidden' });
    const containerName = `openclaw-${name}`;
    try {
        const { stdout } = await runCommand(`docker exec ${shellQuote(containerName)} oryxa cron list 2>&1`);
        let parsed;
        try { parsed = JSON.parse(stdout); }
        catch (e) { return res.status(500).json({ ok: false, error: 'parse fail', raw: stdout.slice(0,300) }); }
        res.json({ ok: true, crons: parsed.crons || [], note: parsed.note });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/instances/:name/cron', requireAuth, requireAdmin, async (req, res) => {
    const name = req.params.name;
    const { schedule, description, request } = req.body || {};
    if (!schedule || !description || !request) {
        return res.status(400).json({ ok: false, error: 'schedule, description, request obrigatorios' });
    }
    const containerName = `openclaw-${name}`;
    try {
        const cmd = `docker exec ${shellQuote(containerName)} oryxa cron add --schedule ${shellQuote(schedule)} --description ${shellQuote(description)} --request ${shellQuote(request)} 2>&1`;
        const { stdout } = await runCommand(cmd);
        res.json({ ok: true, output: stdout });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.delete('/api/instances/:name/cron/:jobId', requireAuth, requireAdmin, async (req, res) => {
    const { name, jobId } = req.params;
    const containerName = `openclaw-${name}`;
    try {
        const { stdout } = await runCommand(`docker exec ${shellQuote(containerName)} oryxa cron remove ${shellQuote(jobId)} 2>&1`);
        res.json({ ok: true, output: stdout });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post("/api/team-bus/enqueue", busAuth, (req, res) => {
    const { fromAgent, toAgent, request, weslleyChatId, sourceContext } = req.body || {};
    if (!fromAgent || !toAgent || !request) return res.status(400).json({ error: "missing fromAgent/toAgent/request" });
    if (!VALID_AGENTS.includes(fromAgent) || !VALID_AGENTS.includes(toAgent)) return res.status(400).json({ error: "unknown agent" });
    if (typeof request !== "string" || request.length > 2000) return res.status(400).json({ error: "request too long or not string" });
    const id = Date.now() + "-" + crypto.randomBytes(4).toString("hex");
    const task = {
        id,
        fromAgent,
        toAgent,
        toBotUsername: toAgent + "_oryxa_bot",
        request: request.slice(0, 2000),
        weslleyChatId: weslleyChatId || 1359081798,
        sourceContext: (sourceContext || "").slice(0, 500),
        groupChatId: -5241757627,
        status: "pending",
        createdAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(TEAM_BUS_PENDING, id + ".json"), JSON.stringify(task, null, 2));
    console.log("[team-bus] enqueued", id, fromAgent, "->", toAgent);
    res.json({ ok: true, id });
});

// /*team-bus-dedupe*/ in-memory map de (toAgent + msgIdKey) -> ts (epoch ms)
// Quando webhook fira 2x ou retrigger manual injeta task pro MESMO email, evita relay duplicado.
const _teamBusDedupe = new Map();
const TEAM_BUS_DEDUPE_TTL = 2 * 60 * 60 * 1000; // 2h
function _extractMsgIdKey(task) {
    // Procura uma string base64-like (>=40 chars, [A-Za-z0-9+/=_-]+) no sourceContext OU request
    const pool = (task.sourceContext || '') + ' ' + (task.request || '');
    const m = pool.match(/[A-Za-z0-9+/=_-]{40,}/);
    return m ? m[0].slice(-50) : null;  // FIX: usar SUFIXO (Outlook IDs compartilham prefixo de mailbox)
}
function _teamBusIsDuplicate(task) {
    const msgKey = _extractMsgIdKey(task);
    if (!msgKey) return false; // sem messageId nao deduplica
    const fullKey = (task.toAgent || '') + ':' + msgKey;
    const now = Date.now();
    // limpa entries velhas
    for (const [k, t] of _teamBusDedupe) if (now - t > TEAM_BUS_DEDUPE_TTL) _teamBusDedupe.delete(k);
    if (_teamBusDedupe.has(fullKey)) return true;
    _teamBusDedupe.set(fullKey, now);
    return false;
}

// Userbot polls for next pending task
app.get("/api/team-bus/next", busAuth, (req, res) => {
    const files = fs.readdirSync(TEAM_BUS_PENDING).filter(f => f.endsWith(".json")).sort();
    for (const f of files) {
        const filePath = path.join(TEAM_BUS_PENDING, f);
        let task;
        try { task = JSON.parse(fs.readFileSync(filePath, "utf8")); }
        catch (e) { console.error('[team-bus] bad task file', f, e.message); continue; }
        if (_teamBusIsDuplicate(task)) {
            // Move pra archive com status='deduped'
            task.status = 'deduped';
            task.dedupedAt = new Date().toISOString();
            try {
                fs.writeFileSync(path.join(TEAM_BUS_ARCHIVE, f), JSON.stringify(task, null, 2));
                fs.unlinkSync(filePath);
                console.log('[team-bus] DEDUPED', task.id, 'to=' + task.toAgent, 'msgKey=' + (_extractMsgIdKey(task) || '').slice(0, 40));
            } catch (e) { console.error('[team-bus] dedupe move failed', e.message); }
            continue; // proxima task
        }
        return res.json({ task });
    }
    return res.json({ task: null });
});

// Userbot acks task after relay
app.post("/api/team-bus/ack/:id", busAuth, (req, res) => {
    const { id } = req.params;
    if (!/^[\w-]+$/.test(id)) return res.status(400).json({ error: "bad id" });
    const src = path.join(TEAM_BUS_PENDING, id + ".json");
    if (!fs.existsSync(src)) return res.status(404).json({ error: "not found" });
    const task = JSON.parse(fs.readFileSync(src, "utf8"));
    task.status = "relayed";
    task.relayedAt = new Date().toISOString();
    fs.writeFileSync(path.join(TEAM_BUS_ARCHIVE, id + ".json"), JSON.stringify(task, null, 2));
    fs.unlinkSync(src);
    res.json({ ok: true });
});

// Status / debug endpoint (admin-auth via session)
app.get("/api/team-bus/status", requireAuth, requireAdmin, (req, res) => {
    const pending = fs.readdirSync(TEAM_BUS_PENDING).filter(f => f.endsWith(".json"));
    const archive = fs.readdirSync(TEAM_BUS_ARCHIVE).filter(f => f.endsWith(".json"));
    res.json({
        pending: pending.length,
        archive: archive.length,
        recentPending: pending.slice(-5).map(f => JSON.parse(fs.readFileSync(path.join(TEAM_BUS_PENDING, f), "utf8")))
    });
});



// /*team-bus*/ Userbot saves group bot messages here
// /*auto-reset*/ cooldown map: agente -> ts ultima reset enviada
const _autoResetLastAt = new Map();
const AUTO_RESET_COOLDOWN_MS = 10 * 60 * 1000; // 10min
function _autoResetShouldFire(agent) {
    const now = Date.now();
    const last = _autoResetLastAt.get(agent) || 0;
    if (now - last < AUTO_RESET_COOLDOWN_MS) return false;
    _autoResetLastAt.set(agent, now);
    return true;
}
const OVERFLOW_RE = /(Context overflow|prompt too large for (?:the|this) model)/i;

app.post('/api/team-bus/reset-email-counter', busAuth, (req, res) => {
    const { agent, sender } = req.body || {};
    if (!agent || !sender) return res.status(400).json({ error: 'missing agent or sender' });
    _emailCounterReset(agent, sender);
    console.log('[email-counter] reset for ' + agent + ':' + sender);
    res.json({ ok: true });
});

app.get('/api/team-bus/email-counter', busAuth, (req, res) => {
    const agent = String(req.query.agent || '').toLowerCase();
    const sender = String(req.query.sender || '').toLowerCase();
    if (!agent || !sender) return res.status(400).json({ error: 'missing agent or sender' });
    res.json({ count: _emailCounterGet(agent, sender), max: EMAIL_COUNTER_MAX });
});

app.post("/api/team-bus/group-message", busAuth, (req, res) => {
    const { fromAgent, username, text, messageId, groupChatId } = req.body || {};
    if (!fromAgent || !text) return res.status(400).json({ error: "missing fromAgent/text" });
    if (!VALID_AGENTS.includes(fromAgent)) return res.status(400).json({ error: "unknown agent" });
    const id = Date.now() + "-" + crypto.randomBytes(4).toString("hex");
    const TEAM_BUS_GROUP_MSGS = path.join(TEAM_BUS_DIR, "group-messages");
    fs.mkdirSync(TEAM_BUS_GROUP_MSGS, { recursive: true });
    const entry = {
        id, fromAgent, username: username || "",
        text: String(text).slice(0, 4000),
        messageId: messageId || null,
        groupChatId: groupChatId || -5241757627,
        capturedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(TEAM_BUS_GROUP_MSGS, id + ".json"), JSON.stringify(entry, null, 2));

    // Auto-reset: agente reportou Context overflow -> enfileira /reset
    if (OVERFLOW_RE.test(String(text))) {
        if (_autoResetShouldFire(fromAgent)) {
            const resetId = Date.now() + "-" + crypto.randomBytes(4).toString("hex");
            const resetTask = {
                id: resetId,
                fromAgent: "weslley",
                toAgent: fromAgent,
                toBotUsername: fromAgent + "_oryxa_bot",
                request: "__RESET__",
                weslleyChatId: WESLLEY_CHAT_ID,
                sourceContext: "auto-reset:overflow:" + fromAgent,
                groupChatId: groupChatId || -5241757627,
                status: "pending",
                createdAt: new Date().toISOString()
            };
            try {
                fs.writeFileSync(path.join(TEAM_BUS_PENDING, resetId + ".json"), JSON.stringify(resetTask, null, 2));
                console.log("[auto-reset] overflow from " + fromAgent + " -> enqueued /reset (" + resetId + ")");
            } catch (e) {
                console.error("[auto-reset] enqueue failed:", e.message);
            }
        } else {
            console.log("[auto-reset] overflow from " + fromAgent + " suppressed by cooldown");
        }
    }

    res.json({ ok: true, id });
});

// /*team-bus*/ Agent queries this to read recent messages from a teammate
app.get("/api/team-bus/recent-from", busAuth, (req, res) => {
    const agent = String(req.query.agent || "").toLowerCase();
    const limit = Math.min(20, parseInt(String(req.query.limit || "5")) || 5);
    const sinceMin = Math.min(60, parseInt(String(req.query.sinceMinutes || "15")) || 15);
    const TEAM_BUS_GROUP_MSGS = path.join(TEAM_BUS_DIR, "group-messages");
    if (!fs.existsSync(TEAM_BUS_GROUP_MSGS)) return res.json({ messages: [] });
    if (agent && !VALID_AGENTS.includes(agent)) return res.status(400).json({ error: "unknown agent" });
    const cutoff = Date.now() - sinceMin * 60 * 1000;
    const files = fs.readdirSync(TEAM_BUS_GROUP_MSGS).filter(f => f.endsWith(".json")).sort().reverse();
    const out = [];
    for (const f of files) {
        try {
            const e = JSON.parse(fs.readFileSync(path.join(TEAM_BUS_GROUP_MSGS, f), "utf8"));
            if (agent && e.fromAgent !== agent) continue;
            if (new Date(e.capturedAt).getTime() < cutoff) continue;
            out.push(e);
            if (out.length >= limit) break;
        } catch {}
    }
    res.json({ messages: out });
});



// /*team-bus-monitor*/ Layer 1: Heartbeat endpoint + monitor cron
const TEAM_BUS_HB_FILE = path.join(TEAM_BUS_DIR, '.userbot-heartbeat');
const TEAM_BUS_FAILED = path.join(TEAM_BUS_DIR, 'failed');
fs.mkdirSync(TEAM_BUS_FAILED, { recursive: true });

app.post('/api/team-bus/heartbeat', busAuth, (req, res) => {
    fs.writeFileSync(TEAM_BUS_HB_FILE, String(Date.now()));
    res.json({ ok: true, ts: Date.now() });
});

const ALERT_DEDUP = {};
const WESLLEY_CHAT_ID = 1359081798;
async function sendSystemAlertToWeslley(text) {
    try {
        const meta = JSON.parse(fs.readFileSync('/opt/openoryxa/instances/clair/meta.json', 'utf8'));
        const token = meta.telegram && meta.telegram.botToken;
        if (!token) return;
        const https = require('https');
        const data = JSON.stringify({ chat_id: WESLLEY_CHAT_ID, text: '[SISTEMA] ' + text });
        await new Promise((resolve) => {
            const req2 = https.request({
                hostname: 'api.telegram.org',
                path: '/bot' + token + '/sendMessage',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
                timeout: 8000,
            }, (r) => { r.on('data', () => {}); r.on('end', resolve); });
            req2.on('error', () => resolve());
            req2.on('timeout', () => { req2.destroy(); resolve(); });
            req2.write(data); req2.end();
        });
    } catch (e) {
        console.error('[team-bus] alert send failed:', e.message);
    }
}
// ALERT_THRESHOLD_v1: only critical alerts go to Telegram.
// Non-critical kinds (agent-down-*, task-expired-*) accumulate counts within a 1h window
// and only post to chat once a threshold is crossed. Everything else is logged but not posted.
const ALERT_COUNT = {};
const ALERT_WINDOW_MS = 60 * 60 * 1000;

function isCriticalAlert(key) {
    if (key === 'userbot-stale') return true;
    if (key === 'smoke-fail') return true;
    return false;
}
function thresholdFor(key) {
    if (key.startsWith('agent-down-'))   return 3;   // 3 restarts/h same agent
    if (key.startsWith('task-expired-')) return 5;   // 5 expirations/h same agent
    return 0;
}
function bumpAlertCount(key) {
    const now = Date.now();
    const arr = (ALERT_COUNT[key] || []).filter(ts => now - ts < ALERT_WINDOW_MS);
    arr.push(now);
    ALERT_COUNT[key] = arr;
    return arr.length;
}

function maybeAlert(key, text) {
    // always log, even if not posted
    console.log('[team-bus] event:', key, text);

    if (!isCriticalAlert(key)) {
        const t = thresholdFor(key);
        if (t > 0) {
            const count = bumpAlertCount(key);
            if (count < t) return; // below threshold -> silent
            text = text + ' (' + count + ' in last hour)';
        } else {
            return; // unknown non-critical kind: silent
        }
    }

    // dedup: same key suppressed for 5min
    const last = ALERT_DEDUP[key] || 0;
    if (Date.now() - last < 5 * 60 * 1000) return;
    ALERT_DEDUP[key] = Date.now();
    console.log('[team-bus] ALERT (posted):', text);
    return sendSystemAlertToWeslley(text);
}

const TEAM_BUS_AGENTS = ['clair','aurora','luna','sofia','iris','helena','bella'];
const TASK_TTL_MS = 10 * 60 * 1000;
const HB_STALE_MS = 90 * 1000;

async function teamBusMonitorTick() {
    let userbotAgeS = -1;
    if (fs.existsSync(TEAM_BUS_HB_FILE)) {
        const ts = parseInt(fs.readFileSync(TEAM_BUS_HB_FILE, 'utf8').trim()) || 0;
        userbotAgeS = Math.round((Date.now() - ts) / 1000);
        if ((Date.now() - ts) > HB_STALE_MS) {
            maybeAlert('userbot-stale', 'userbot heartbeat parado ha ' + userbotAgeS + 's. Reiniciando.');
            runCommand('docker restart oryxa-userbot').catch(() => {});
        }
    }
    try {
        const files = fs.readdirSync(TEAM_BUS_PENDING).filter(f => f.endsWith('.json'));
        for (const f of files) {
            try {
                const task = JSON.parse(fs.readFileSync(path.join(TEAM_BUS_PENDING, f), 'utf8'));
                const ageMs = Date.now() - new Date(task.createdAt).getTime();
                if (ageMs > TASK_TTL_MS) {
                    task.status = 'expired';
                    task.expiredAt = new Date().toISOString();
                    fs.writeFileSync(path.join(TEAM_BUS_FAILED, f), JSON.stringify(task, null, 2));
                    fs.unlinkSync(path.join(TEAM_BUS_PENDING, f));
                    maybeAlert('task-expired-' + task.toAgent, 'Task ' + task.id + ' (' + task.fromAgent + '->' + task.toAgent + ') expirou apos ' + Math.round(ageMs/60000) + 'min.');
                }
            } catch (e) {}
        }
    } catch (e) {}
    for (const agent of TEAM_BUS_AGENTS) {
        const cn = 'openclaw-' + agent;
        try {
            const status = await runCommand('docker inspect --format \'{{.State.Status}}\' ' + cn).catch(() => 'unknown');
            const s = (status || 'unknown').toString().trim();
            if (s.indexOf('running') === -1) {
                maybeAlert('agent-down-' + agent, agent + ' container nao rodando (' + s + '). Reiniciando.');
                cleanupOrphanedShim(cn).then(() => runCommand('docker start ' + cn).catch(() => {}));
            }
        } catch (e) {}
    }
}
setInterval(teamBusMonitorTick, 60 * 1000);
setTimeout(teamBusMonitorTick, 5000);
console.log('[team-bus] monitor started (60s ticks)');

// Layer 2: Dashboard JSON + HTML
app.get('/api/team-bus/dashboard', requireAuth, requireAdmin, async (req, res) => {
    const userbot = { hb: null, ageS: null, ok: false };
    if (fs.existsSync(TEAM_BUS_HB_FILE)) {
        const ts = parseInt(fs.readFileSync(TEAM_BUS_HB_FILE, 'utf8').trim()) || 0;
        userbot.hb = ts;
        userbot.ageS = Math.round((Date.now() - ts) / 1000);
        userbot.ok = userbot.ageS < 90;
    }
    const agents = [];
    for (const agent of TEAM_BUS_AGENTS) {
        const cn = 'openclaw-' + agent;
        let status = 'unknown';
        try {
            const out = await runCommand('docker inspect --format \'{{.State.Status}}\' ' + cn).catch(() => 'missing');
            status = (out || 'unknown').toString().trim();
        } catch (e) {}
        agents.push({ agent, container: cn, status });
    }
    const queue = {
        pending: fs.readdirSync(TEAM_BUS_PENDING).filter(f => f.endsWith('.json')).length,
        archive: fs.readdirSync(TEAM_BUS_ARCHIVE).filter(f => f.endsWith('.json')).length,
        failed: fs.existsSync(TEAM_BUS_FAILED) ? fs.readdirSync(TEAM_BUS_FAILED).filter(f => f.endsWith('.json')).length : 0,
    };
    const TEAM_BUS_GROUP_MSGS = path.join(TEAM_BUS_DIR, 'group-messages');
    const recent = [];
    if (fs.existsSync(TEAM_BUS_GROUP_MSGS)) {
        const files = fs.readdirSync(TEAM_BUS_GROUP_MSGS).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 20);
        for (const f of files) {
            try { recent.push(JSON.parse(fs.readFileSync(path.join(TEAM_BUS_GROUP_MSGS, f), 'utf8'))); } catch (e) {}
        }
    }
    res.json({ now: Date.now(), userbot, agents, queue, recent });
});

const DASHBOARD_HTML = `<!doctype html><html><head><meta charset=utf-8><title>Team Bus</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:20px}h1,h2{color:#fff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card{background:#181818;border:1px solid #333;border-radius:10px;padding:14px}.ok{color:#4ade80}.err{color:#f87171}.warn{color:#fbbf24}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}.dot.green{background:#4ade80}.dot.red{background:#f87171}.msg{border-left:3px solid #6366f1;padding:6px 10px;margin:6px 0;font-size:13px;background:#111}.agent{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #222}.q{font-size:24px;font-weight:bold}.muted{color:#888;font-size:12px}</style></head><body><h1>Team Bus Dashboard</h1><p class=muted id=updated></p><div class=grid><div class=card><h2>Userbot</h2><div id=userbot>...</div></div><div class=card><h2>Fila</h2><div id=queue></div></div><div class=card><h2>Agentes</h2><div id=agents></div></div></div><h2>Mensagens recentes no grupo</h2><div id=recent></div><script>async function load(){const r=await fetch("/api/team-bus/dashboard");if(!r.ok){document.getElementById("updated").innerText="Erro: "+r.status;return}const d=await r.json();document.getElementById("updated").innerText="Atualizado: "+new Date(d.now).toLocaleString();const u=d.userbot;document.getElementById("userbot").innerHTML=u.hb?'<span class="dot '+(u.ok?"green":"red")+'"></span> '+(u.ok?'<span class="ok">online</span>':'<span class="err">parado</span>')+'<br><span class="muted">ultimo heartbeat: '+u.ageS+'s atras</span>':'<span class="err">nunca enviou heartbeat</span>';document.getElementById("queue").innerHTML='<div>Pendentes: <span class="q '+(d.queue.pending>0?"warn":"ok")+'">'+d.queue.pending+'</span></div><div>Entregues: <span class="q ok">'+d.queue.archive+'</span></div><div>Falharam: <span class="q '+(d.queue.failed>0?"err":"ok")+'">'+d.queue.failed+'</span></div>';document.getElementById("agents").innerHTML=d.agents.map(function(a){var ok=a.status==="running";return '<div class="agent"><span><span class="dot '+(ok?"green":"red")+'"></span>'+a.agent+'</span><span class="'+(ok?"ok":"err")+'">'+a.status+'</span></div>'}).join("");document.getElementById("recent").innerHTML=d.recent.map(function(m){return '<div class="msg"><b>@'+m.username+'</b> <span class="muted">('+new Date(m.capturedAt).toLocaleTimeString()+')</span><br>'+m.text.replace(/</g,"&lt;")+'</div>'}).join("")||'<p class="muted">nada</p>'}load();setInterval(load,5000);</script></body></html>`;
app.get('/team-bus/dashboard', requireAuth, (req, res) => {
    res.type('html').send(DASHBOARD_HTML);
});

// Layer 3: Smoke test
const SMOKE_INTERVAL_MS = 30 * 60 * 1000;
async function teamBusSmokeTest() {
    const id = 'smoke-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const task = {
        id, fromAgent: 'clair', toAgent: 'bella',
        toBotUsername: 'bella_oryxa_bot',
        request: '__SMOKE_TEST__ ping',
        weslleyChatId: WESLLEY_CHAT_ID,
        sourceContext: 'smoke-test',
        groupChatId: -5241757627,
        status: 'pending',
        createdAt: new Date().toISOString(),
        isSmokeTest: true,
    };
    fs.writeFileSync(path.join(TEAM_BUS_PENDING, id + '.json'), JSON.stringify(task, null, 2));
    console.log('[smoke] enqueued', id);
    setTimeout(() => {
        if (fs.existsSync(path.join(TEAM_BUS_ARCHIVE, id + '.json'))) {
            console.log('[smoke] OK', id);
        } else {
            const inFailed = fs.existsSync(path.join(TEAM_BUS_FAILED, id + '.json'));
            maybeAlert('smoke-fail', 'Smoke test falhou: task ' + id + ' nao foi entregue em 90s (' + (inFailed ? 'expirou' : 'sumiu') + ').');
        }
    }, 90 * 1000);
}
setInterval(teamBusSmokeTest, SMOKE_INTERVAL_MS);
setTimeout(teamBusSmokeTest, 60 * 1000);
console.log('[team-bus] smoke test scheduled (30min)');



// /*team-bus-credentials*/ Agents save user-provided API keys via this endpoint
const VALID_KEY_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

function shellQuoteForExec(s) {
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

app.post('/api/team-bus/save-credential', busAuth, async (req, res) => {
    const { agent, key, value, restart } = req.body || {};
    const a = String(agent || '').toLowerCase().trim();
    const k = String(key || '').trim();
    const v = String(value || '');
    if (!k || !v) return res.status(400).json({ error: 'missing key or value' });
    if (!VALID_KEY_RE.test(k)) return res.status(400).json({ error: 'key must be UPPER_SNAKE_CASE, 3-64 chars, start with letter' });
    if (v.length > 4096) return res.status(400).json({ error: 'value too long' });
    const targets = a === 'all' ? TEAM_BUS_AGENTS : (TEAM_BUS_AGENTS.includes(a) ? [a] : null);
    if (!targets) return res.status(400).json({ error: 'invalid agent (use "all" or one of: ' + TEAM_BUS_AGENTS.join(',') + ')' });
    const saved = [];
    const errors = [];
    for (const ag of targets) {
        const cn = 'openclaw-' + ag;
        try {
            // 1. Persist in instance meta.json (survives container recreation)
            const metaPath = path.join('/opt/openoryxa/instances', ag, 'meta.json');
            let meta = {};
            try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) {}
            meta.secrets = meta.secrets || {};
            meta.secrets[k] = v;
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            // 2. Update secrets.env inside container (live)
            // Read current file
            const currentRaw = await runCommand('docker exec ' + cn + ' cat /home/node/.openclaw/secrets.env').catch(() => '');
            const lines = String(currentRaw || '').split('\n').filter(Boolean).filter(l => !l.startsWith(k + '='));
            lines.push(k + '=' + v);
            const newContent = lines.join('\n') + '\n';
            // Write via base64 to avoid quoting nightmare
            const b64 = Buffer.from(newContent).toString('base64');
            await runCommand('echo ' + b64 + ' | base64 -d | docker exec --user 0 -i ' + cn + ' sh -c "cat > /home/node/.openclaw/secrets.env && chown node:node /home/node/.openclaw/secrets.env && chmod 600 /home/node/.openclaw/secrets.env"');
            saved.push(ag);
        } catch (e) {
            errors.push({ agent: ag, error: String(e.message || e) });
        }
    }
    // Optionally restart agents to load new env (default: no restart, just persist)
    if (restart === true || restart === 'true') {
        for (const ag of saved) {
            await runCommand('docker restart openclaw-' + ag).catch(() => {});
        }
    }
    res.json({ ok: errors.length === 0, saved, errors, restartedAgents: (restart === true || restart === 'true') ? saved : [] });
});







// === OpenRouter raise-limit endpoint (v2 — sem dep de shell) ===
const OR_PROV_KEY_PATH = '/opt/openoryxa/scripts/.openrouter-prov-key';
const OR_AGENT_MAP_PATH = '/opt/openoryxa/scripts/or-agent-map.json';

app.post('/api/openrouter/raise-limit', busAuth, async (req, res) => {
    const { agent, new_limit_usd } = req.body || {};
    if (!agent || typeof new_limit_usd !== 'number' || new_limit_usd <= 0 || new_limit_usd > 200) {
        return res.status(400).json({ error: 'invalid agent or new_limit_usd (must be 0 < n <= 200)' });
    }
    if (!VALID_AGENTS.includes(agent)) {
        return res.status(400).json({ error: 'unknown agent' });
    }
    let provKey, hash;
    try {
        provKey = fs.readFileSync(OR_PROV_KEY_PATH, 'utf8').trim();
        const map = JSON.parse(fs.readFileSync(OR_AGENT_MAP_PATH, 'utf8'));
        hash = map.agents?.[agent]?.hash;
        if (!hash) return res.status(400).json({ error: 'agent hash not found in map' });
    } catch (e) {
        return res.status(500).json({ error: 'config read failed', detail: e.message });
    }
    try {
        const r = await fetch('https://openrouter.ai/api/v1/keys/' + hash, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + provKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: new_limit_usd })
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: 'openrouter api failed', detail: data });
        // Reset alert flag
        try {
            const today = new Date().toISOString().slice(0, 10);
            const statePath = '/var/log/or-monitor-alerted.json';
            if (fs.existsSync(statePath)) {
                const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                delete st[today + ':' + agent];
                fs.writeFileSync(statePath, JSON.stringify(st));
            }
        } catch {}
        res.json({
            ok: true,
            agent,
            new_limit_usd: data.data?.limit,
            current_usage_usd: data.data?.usage,
        });
    } catch (e) {
        res.status(500).json({ error: 'request failed', detail: e.message });
    }
});




// === OpenRouter double-limit endpoint ===
// Dobra automaticamente o limite da agente, respeitando max_doublings_per_day.
// Se atingiu o cap, retorna {ok:false, max_reached:true} e quem chamou avisa o user.

app.post('/api/openrouter/double-limit', busAuth, async (req, res) => {
    const { agent } = req.body || {};
    if (!agent || !VALID_AGENTS.includes(agent)) {
        return res.status(400).json({ error: 'invalid agent' });
    }
    let provKey, hash, maxDoublings;
    try {
        provKey = fs.readFileSync(OR_PROV_KEY_PATH, 'utf8').trim();
        const map = JSON.parse(fs.readFileSync(OR_AGENT_MAP_PATH, 'utf8'));
        const cfg = map.agents?.[agent];
        if (!cfg?.hash) return res.status(400).json({ error: 'agent hash not found' });
        hash = cfg.hash;
        maxDoublings = cfg.max_doublings_per_day || 5;
    } catch (e) {
        return res.status(500).json({ error: 'config read failed', detail: e.message });
    }

    // Check doublings count today (Lisbon timezone)
    const DOUB_STATE = '/var/log/or-doublings.json';
    let state = {};
    try { state = JSON.parse(fs.readFileSync(DOUB_STATE, 'utf8')); } catch {}
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });
    const key = today + ':' + agent;
    const used = state[key] || 0;

    if (used >= maxDoublings) {
        return res.json({
            ok: false,
            max_reached: true,
            doublings_used: used,
            doublings_max: maxDoublings,
            message: `${agent} já dobrou ${used}x hoje (limite ${maxDoublings}x). Avise o Weslley.`
        });
    }

    // Get current limit
    try {
        const r1 = await fetch('https://openrouter.ai/api/v1/keys/' + hash, {
            headers: { 'Authorization': 'Bearer ' + provKey }
        });
        const cur = await r1.json();
        if (!r1.ok) return res.status(r1.status).json({ error: 'get key failed', detail: cur });
        const currentLimit = cur.data?.limit || 0;
        const newLimit = currentLimit * 2;

        const r2 = await fetch('https://openrouter.ai/api/v1/keys/' + hash, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + provKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: newLimit })
        });
        const data = await r2.json();
        if (!r2.ok) return res.status(r2.status).json({ error: 'patch failed', detail: data });

        // Increment doublings count
        state[key] = used + 1;
        fs.writeFileSync(DOUB_STATE, JSON.stringify(state));

        // Reset alert flag to allow re-alert if it hits 90% again on new limit
        try {
            const alerted = JSON.parse(fs.readFileSync('/var/log/or-monitor-alerted.json', 'utf8'));
            delete alerted[key];
            fs.writeFileSync('/var/log/or-monitor-alerted.json', JSON.stringify(alerted));
        } catch {}

        res.json({
            ok: true,
            agent,
            previous_limit_usd: currentLimit,
            new_limit_usd: data.data?.limit,
            current_usage_usd: data.data?.usage,
            doublings_used: state[key],
            doublings_remaining: maxDoublings - state[key],
        });
    } catch (e) {
        res.status(500).json({ error: 'request failed', detail: e.message });
    }
});








// === Microsoft Graph webhook receiver v2 — filtro inteligente de remetentes ===
// Pre-fetch email metadata, classifica por sender, só dispatcha Helena se for relevante.

const HELENA_RELEVANT_SENDERS = [
    // Billing / invoices
    'noreply@tm.openai.com', 'billing@openai.com',
    'invoice+statements@openrouter.ai', 'noreply@openrouter.ai',
    'no-reply@anthropic.com', 'billing@anthropic.com',
    'no-reply@canva.com', 'billing@canva.com',
    'noreply@digitalocean.com', 'billing@digitalocean.com',
    'no-reply@stripe.com', 'receipts@stripe.com', 'support@stripe.com',
    'service@paypal.com', 'support@paypal.com',
    'no-reply@aws.amazon.com', 'no-reply@cloud.google.com',
    'noreply@github.com', 'billing@github.com',
    // Money in
    'noreply@wise.com', 'no-reply@wise.com',
    // Generic billing patterns
];

// Keyword patterns in subject/from that trigger Helena even from unknown senders
const HELENA_RELEVANT_KEYWORDS = [
    'invoice', 'receipt', 'payment', 'pagamento', 'fatura', 'recibo',
    'money received', 'transferência recebida',
    'subscription', 'subscrição', 'assinatura',
    'past due', 'overdue', 'unpaid', 'vencido', 'em atraso',
    'reminder', 'lembrete',
    'failed payment', 'pagamento falhou', 'payment declined',
    'action required', 'ação necessária'
];

async function fetchEmailMetadata(messageId, userAddress) {
    // Use Helena's MS token via container exec (simplest path — uses existing helper)
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec(
            "docker exec openclaw-helena sh -c '. /home/node/.openclaw/microsoft_oauth_helper.sh && mstoken info@harakawa.tech >/dev/null && curl -sS -H \"Authorization: Bearer $MS_ACCESS_TOKEN\" \"https://graph.microsoft.com/v1.0/" + (userAddress ? ("users/" + userAddress) : "me") + "/messages/" + messageId + "?\\$select=subject,from,toRecipients,ccRecipients,bodyPreview,receivedDateTime,hasAttachments,internetMessageHeaders\"'",
            { timeout: 15000 },
            (err, stdout, stderr) => {
                if (err) {
                    console.error('[webhook-graph] fetchEmailMetadata exec err:', err.message, 'stderr:', (stderr||'').slice(0,200));
                    return resolve(null);
                }
                try { resolve(JSON.parse(stdout)); }
                catch (e) {
                    console.error('[webhook-graph] fetchEmailMetadata parse err:', e.message, 'stdout head:', (stdout||'').slice(0,300));
                    resolve(null);
                }
            }
        );
    });
}

// Roteamento de emails por alias destinatario
const AGENT_PROFILES = {
    clair: { name: 'Clair', role: 'Administrative Director', scope: 'liderança/coordenação/parcerias/catch-all', delegateMap: {
        'faturação/pagamento/NIF': { alias: 'helena@harakawa.tech', name: 'Helena' },
        'vendas/preço/orçamento/lead': { alias: 'aurora@harakawa.tech', name: 'Aurora' },
        'suporte/onboarding/retenção': { alias: 'sofia@harakawa.tech', name: 'Sofia' },
        'marketing/redes sociais': { alias: 'luna@harakawa.tech', name: 'Luna' },
        'design/branding': { alias: 'bella@harakawa.tech', name: 'Bella' },
        'tech/programação/infra': { alias: 'iris@harakawa.tech', name: 'Iris' },
    }},
    aurora: { name: 'Aurora', role: 'Sales Director', scope: 'vendas/leads/demos/preços (faixas ok, quotes definitivos só com Weslley)', delegateMap: {
        'faturação/pagamento/NIF': { alias: 'helena@harakawa.tech', name: 'Helena' },
        'tech/programação/infra': { alias: 'iris@harakawa.tech', name: 'Iris' },
        'suporte/cliente existente': { alias: 'sofia@harakawa.tech', name: 'Sofia' },
        'design/branding': { alias: 'bella@harakawa.tech', name: 'Bella' },
        'marketing/redes sociais': { alias: 'luna@harakawa.tech', name: 'Luna' },
        'geral/sem categoria': { alias: 'clair@harakawa.tech', name: 'Clair' },
    }},
    luna: { name: 'Luna', role: 'Marketing Director', scope: 'marketing/redes sociais/branding/campanhas/conteúdo', delegateMap: {
        'vendas/preço/lead': { alias: 'aurora@harakawa.tech', name: 'Aurora' },
        'faturação/pagamento': { alias: 'helena@harakawa.tech', name: 'Helena' },
        'design/criativo': { alias: 'bella@harakawa.tech', name: 'Bella' },
        'tech/programação': { alias: 'iris@harakawa.tech', name: 'Iris' },
        'suporte': { alias: 'sofia@harakawa.tech', name: 'Sofia' },
        'geral': { alias: 'clair@harakawa.tech', name: 'Clair' },
    }},
    sofia: { name: 'Sofia', role: 'Customer Success Manager', scope: 'suporte/onboarding/retenção/clientes existentes', delegateMap: {
        'vendas/novo cliente': { alias: 'aurora@harakawa.tech', name: 'Aurora' },
        'faturação/pagamento': { alias: 'helena@harakawa.tech', name: 'Helena' },
        'bug técnico/integração': { alias: 'iris@harakawa.tech', name: 'Iris' },
        'design/criativo': { alias: 'bella@harakawa.tech', name: 'Bella' },
        'marketing': { alias: 'luna@harakawa.tech', name: 'Luna' },
        'geral': { alias: 'clair@harakawa.tech', name: 'Clair' },
    }},
    iris: { name: 'Iris', role: 'Technology Director', scope: 'tech/infra/dev/automações/segurança/integrações', delegateMap: {
        'faturação/pagamento': { alias: 'helena@harakawa.tech', name: 'Helena' },
        'vendas/preço': { alias: 'aurora@harakawa.tech', name: 'Aurora' },
        'suporte/onboarding': { alias: 'sofia@harakawa.tech', name: 'Sofia' },
        'design/branding': { alias: 'bella@harakawa.tech', name: 'Bella' },
        'marketing': { alias: 'luna@harakawa.tech', name: 'Luna' },
        'geral': { alias: 'clair@harakawa.tech', name: 'Clair' },
    }},
    helena: { name: 'Helena', role: 'Finance Director', scope: 'finanças/faturação/pagamentos/NIF/contábil/fluxo de caixa', delegateMap: {
        'tech/programação': { alias: 'iris@harakawa.tech', name: 'Iris' },
        'vendas/novo cliente': { alias: 'aurora@harakawa.tech', name: 'Aurora' },
        'suporte': { alias: 'sofia@harakawa.tech', name: 'Sofia' },
        'design/criativo': { alias: 'bella@harakawa.tech', name: 'Bella' },
        'marketing': { alias: 'luna@harakawa.tech', name: 'Luna' },
        'geral': { alias: 'clair@harakawa.tech', name: 'Clair' },
    }},
    bella: { name: 'Bella', role: 'Creative Director', scope: 'design/branding/identidade visual/criativo', delegateMap: {
        'vendas/lead': { alias: 'aurora@harakawa.tech', name: 'Aurora' },
        'faturação/pagamento': { alias: 'helena@harakawa.tech', name: 'Helena' },
        'tech/programação': { alias: 'iris@harakawa.tech', name: 'Iris' },
        'marketing/estratégia': { alias: 'luna@harakawa.tech', name: 'Luna' },
        'suporte': { alias: 'sofia@harakawa.tech', name: 'Sofia' },
        'geral': { alias: 'clair@harakawa.tech', name: 'Clair' },
    }},
};

const EMAIL_COUNTER_FILE = '/opt/openoryxa/team-bus/email-counters.json';
const EMAIL_COUNTER_MAX = 15;
function _emailCounterRead() {
    try { return JSON.parse(fs.readFileSync(EMAIL_COUNTER_FILE, 'utf8')); }
    catch { return {}; }
}
function _emailCounterWrite(d) {
    try { fs.writeFileSync(EMAIL_COUNTER_FILE, JSON.stringify(d, null, 2)); } catch {}
}
function _emailCounterKey(agent, sender, date) {
    return agent + ':' + (sender || '').toLowerCase() + ':' + (date || new Date().toISOString().slice(0,10));
}
function _emailCounterIncrement(agent, sender) {
    const d = _emailCounterRead();
    const key = _emailCounterKey(agent, sender);
    d[key] = (d[key] || 0) + 1;
    _emailCounterWrite(d);
    return d[key];
}
function _emailCounterGet(agent, sender) {
    const d = _emailCounterRead();
    return d[_emailCounterKey(agent, sender)] || 0;
}
function _emailCounterReset(agent, sender) {
    const d = _emailCounterRead();
    const key = _emailCounterKey(agent, sender);
    delete d[key];
    _emailCounterWrite(d);
}

function _delegateMapToText(dm) {
    return Object.entries(dm || {}).map(function(e){ return "   " + e[0] + " -> " + e[1].name + " <" + e[1].alias + ">"; }).join("\n");
}

// Dedupe webhooks: messageId+agent visto nos ultimos 10min nao redispacha
const _webhookSeen = new Map(); // key=`${messageId}:${agent}` -> ts
function _webhookSeenRecently(key) {
    const now = Date.now();
    // limpa entradas > 10min
    for (const [k, t] of _webhookSeen) if (now - t > 600000) _webhookSeen.delete(k);
    return _webhookSeen.has(key);
}
function _webhookMark(key) { _webhookSeen.set(key, Date.now()); }

const AGENT_ALIASES = {
    'clair@harakawa.tech': 'clair',
    'helena@harakawa.tech': 'helena',
    'luna@harakawa.tech': 'luna',
    'bella@harakawa.tech': 'bella',
    'iris@harakawa.tech': 'iris',
    'sofia@harakawa.tech': 'sofia',
    'aurora@harakawa.tech': 'aurora',
};

function getAddressedAgent(meta) {
    const recipients = [
        ...(meta?.toRecipients || []),
        ...(meta?.ccRecipients || []),
    ].map(r => (r?.emailAddress?.address || '').toLowerCase()).filter(Boolean);
    // Microsoft expande aliases — destino ORIGINAL fica nos internet headers
    const headers = meta?.internetMessageHeaders || [];
    for (const h of headers) {
        const n = (h?.name || '').toLowerCase();
        if (n === 'to' || n === 'delivered-to' || n === 'x-original-to') {
            const v = (h?.value || '').toLowerCase();
            const matches = v.match(/[\w.+-]+@harakawa\.tech/g) || [];
            for (const m of matches) recipients.push(m);
        }
    }
    for (const addr of recipients) {
        if (AGENT_ALIASES[addr]) return { agent: AGENT_ALIASES[addr], alias: addr };
    }
    return null;
}

function isNoreplyOrAuto(meta) {
    const fromAddr = (meta?.from?.emailAddress?.address || '').toLowerCase();
    if (!fromAddr) return false;
    // Check local part (before @) for noreply anywhere — catches messages-noreply@, jobs-noreply@, etc.
    const localPart = fromAddr.split('@')[0];
    if (/noreply|no[-_.]reply|donotreply/i.test(localPart)) return true;
    const patterns = [
        /^no[-_.]?reply@/i, /^donotreply@/i, /^noreply\./i,
        /^notifications?@/i, /^auto[-_]?reply@/i, /^bounce@/i,
        /^mailer[-_]daemon/i, /@bounces?\./i,
    ];
    return patterns.some(p => p.test(fromAddr));
}

function isRelevantForHelena(meta) {
    if (!meta) return false;
    const fromAddr = (meta.from?.emailAddress?.address || '').toLowerCase();
    const subject = (meta.subject || '').toLowerCase();
    const preview = (meta.bodyPreview || '').toLowerCase();

    // 1) Whitelist exact sender
    if (HELENA_RELEVANT_SENDERS.some(s => fromAddr === s.toLowerCase())) return true;

    // 2) Sender domain hints
    const billingDomains = ['stripe.com', 'wise.com', 'paypal.com', 'openai.com', 'openrouter.ai',
                            'anthropic.com', 'digitalocean.com', 'canva.com', 'github.com',
                            'amazonaws.com', 'cloud.google.com'];
    if (billingDomains.some(d => fromAddr.endsWith('@' + d) || fromAddr.endsWith('.' + d))) return true;

    // 3) Keyword in subject
    if (HELENA_RELEVANT_KEYWORDS.some(k => subject.includes(k))) return true;

    // 4) Keyword in body preview
    if (HELENA_RELEVANT_KEYWORDS.some(k => preview.includes(k))) return true;

    return false;
}

app.all('/api/webhook/microsoft-graph', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
    try {
        // 1) Validation handshake
        const valToken = req.query.validationToken;
        if (valToken) {
            res.set('Content-Type', 'text/plain');
            return res.status(200).send(String(valToken));
        }

        let payload = {};
        try { payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
        catch (e) { payload = {}; }
        const notifications = payload.value || [];

        // ─── Lifecycle events (subscriptionRenewal, reauthorizationRequired, missed) ───
        const lifecycleEvents = notifications.filter(n => n.lifecycleEvent);
        if (lifecycleEvents.length > 0) {
            res.status(202).send("");
            for (const evt of lifecycleEvents) {
                console.log("[webhook-graph] lifecycle event=" + evt.lifecycleEvent + " subId=" + evt.subscriptionId + " expires=" + evt.subscriptionExpirationDateTime);
            }
            // Spawn renewal script async — handles renewal, reauth, missed (all idempotent)
            try {
                const { spawn } = require("child_process");
                const proc = spawn("/opt/openoryxa/scripts/graph-subscription-renewal.py", [], {
                    detached: true, stdio: "ignore"
                });
                proc.unref();
                console.log("[webhook-graph] lifecycle: renewal script spawned (pid=" + proc.pid + ")");
            } catch (e) {
                console.error("[webhook-graph] lifecycle: failed to spawn renewal:", e.message);
            }
            return;
        }

        const expectedState = process.env.GRAPH_WEBHOOK_CLIENT_STATE || 'oryxa-helena-webhook-2026';
        const validNotifications = notifications.filter(n => !n.clientState || n.clientState === expectedState);

        // Acknowledge fast (Graph requires 202 within 30s)
        res.status(202).send('');

        // Process async with intelligent filter
        for (const n of validNotifications) {
            const resourceData = n.resourceData || {};
            const messageId = resourceData.id || '';
            if (!messageId) continue;

            try {
                // Pre-fetch email metadata (cheap — ~50ms, no IA tokens)
                // Extract user address from resource path (e.g. "Users/clair@harakawa.tech/Messages/...")
                let userAddress = null;
                // Extract user from resource path. Graph webhook resource uses GUIDs:
                // 'Users/<guid>/Messages/<id>' OR 'Users/<email>/Messages/<id>'
                const resMatch = (n.resource || "").match(/^Users\/([^\/]+)\/Messages/i);
                if (resMatch) userAddress = resMatch[1];
                const meta = await fetchEmailMetadata(messageId, userAddress);
                const fromAddr = meta?.from?.emailAddress?.address || 'unknown';
                const subject = meta?.subject || '(no subject)';

                const isOpenRouter = /openrouter\.ai/i.test(fromAddr);
                const summary = 'De: ' + fromAddr + ' | Assunto: ' + subject + ' | Anexos: ' + (meta.hasAttachments ? 'sim' : 'não');
                const baseContext = 'webhook:microsoft-graph:' + messageId;
                const addressed = getAddressedAgent(meta);
                const isNoreply = isNoreplyOrAuto(meta);

                // Helena: continua recebendo emails financeiros (regra antiga)
                if (isRelevantForHelena(meta) && !(addressed && addressed.agent === 'helena')) {
                    const helenaTaskId = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                    const helenaTask = {
                        id: helenaTaskId,
                        fromAgent: "weslley",
                        toAgent: 'helena',
                        toBotUsername: 'helena_oryxa_bot',
                        groupChatId: -5241757627,
                        request: 'Email novo no info@harakawa.tech: ' + summary + '. ID: ' + messageId + '. Lê e processa invoice/receipt: cria expense no ClientHub via API (POST /api/v1/expenses), anexa PDF como Document no ClientHub. NUNCA usa planilha/Sheets — TUDO no ClientHub. Drive só pra arquivo do PDF (Invoices Paid/[Fornecedor]/). NUNCA processa Receipts em separado (só Invoices). REGRA CRÍTICA: processas autonomamente, sem perguntar. NUNCA escreves no GRUPO. Reporta direto no DM Weslley (chat 1359081798) com id da expense criada.',
                        weslleyChatId: '1359081798',
                        sourceContext: baseContext + ':helena',
                        createdAt: Date.now(),
                    };
                    fs.writeFileSync(path.join(TEAM_BUS_PENDING, helenaTaskId + '.json'), JSON.stringify(helenaTask, null, 2));

                    if (isOpenRouter) {
                        const clairTaskId = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                        const clairTask = {
                            id: clairTaskId,
                            fromAgent: "weslley",
                            toAgent: 'clair',
                            toBotUsername: 'clair_oryxa_bot',
                            groupChatId: -5241757627,
                            request: 'Email da OpenRouter chegou no info@harakawa.tech: ' + summary + '. ID: ' + messageId + '. Lê só pra detectar ALERTAS DE CONSUMO/LIMITE. Se for alerta crítico, avisa o Weslley no DM com sugestão. Se for receipt/invoice rotineiro, ignora (Helena já registra).',
                            weslleyChatId: '1359081798',
                            sourceContext: baseContext + ':clair-or-watch',
                            createdAt: Date.now(),
                        };
                        fs.writeFileSync(path.join(TEAM_BUS_PENDING, clairTaskId + '.json'), JSON.stringify(clairTask, null, 2));
                    }
                    console.log('[webhook-graph] DISPATCH helena from=' + fromAddr);
                }

                // Alias routing: email endereçado a um agente específico (clair@, luna@, etc)
                if (addressed) {
                    const _dedupeKey = messageId + ':' + addressed.agent;
                    if (_webhookSeenRecently(_dedupeKey)) {
                        console.log('[webhook-graph] SKIP duplicate ' + addressed.agent + ' for messageId=' + messageId.slice(0, 30));
                    } else {
                        _webhookMark(_dedupeKey);
                    const taskId = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                    let request;
                    if (isNoreply) {
                        request = [
                            'Email automático/noreply chegou em ' + addressed.alias + '.',
                            'De: ' + fromAddr + ' | Assunto: ' + subject + ' | ID: ' + messageId,
                            '',
                            'NÃO responde (é noreply). Lê o conteúdo e me avisa no DM Telegram (chat 1359081798) usando teu próprio bot token (TELEGRAM_BOT_TOKEN nos secrets) APENAS se for algo importante (alerta, fatura, problema, ação necessária). Se for notificação rotineira, ignora.'
                        ].join('\n');
                    } else {
                        // Email counter — max 15 respostas autônomas/dia/remetente
                        const _emCount = _emailCounterIncrement(addressed.agent, fromAddr);
                        const _emMax = EMAIL_COUNTER_MAX;
                        const _emOver = _emCount > _emMax;
                        if (_emOver) {
                            // Cria task notify-only em vez de reply
                            const _ntId = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
                            const _ntTask = {
                                id: _ntId,
                                fromAgent: 'weslley',
                                toAgent: addressed.agent,
                                toBotUsername: addressed.agent + '_oryxa_bot',
                                request: 'Email novo em ' + addressed.alias + ' de ' + fromAddr + ' sobre "' + subject.slice(0,80) + '" (msgId ' + messageId + ').\n\nJá atingi 15 respostas autônomas hoje pra este remetente — NÃO respondo automaticamente. Aviso o Weslley em 1 linha no DM (chat 1359081798) usando meu TELEGRAM_BOT_TOKEN: "⚠️ Limite de 15 respostas/dia atingido pra ' + fromAddr + ' (assunto: ' + subject.slice(0,50) + '). Mandas-me o que responder?". Espero ordem dele. Se ele me disser o que responder, ai sim mando.',
                                weslleyChatId: '1359081798',
                                sourceContext: baseContext + ':' + addressed.agent + '-overlimit',
                                groupChatId: -5241757627,
                                createdAt: Date.now(),
                            };
                            try { fs.writeFileSync(path.join(TEAM_BUS_PENDING, _ntId + '.json'), JSON.stringify(_ntTask, null, 2)); } catch {}
                            console.log('[email-counter] OVER LIMIT ' + addressed.agent + ':' + fromAddr + ' count=' + _emCount + ' — notify-only task ' + _ntId);
                            continue; // skip normal task creation
                        }
                        const profile = AGENT_PROFILES[addressed.agent] || { name: addressed.agent, role: '' };
                        const sigClosing = "<saudação no idioma do remetente: Cumprimentos / Best wishes / Saludos / Salutations / Mit freundlichen / Cordialmente / etc>";
                        const sigBlock = [sigClosing, "", profile.name, profile.role + " at Harakawa Tech", "https://harakawa.tech"].join(String.fromCharCode(10));
                        request = [
                            'Email novo em ' + addressed.alias + ' (vc).',
                            'De: ' + fromAddr + ' | Assunto: ' + (subject || '').slice(0,120) + ' | ID: ' + messageId,
                            '',
                            'Tu es ' + profile.name + ', ' + profile.role + ' da Harakawa Tech (' + addressed.alias + '). Regras: workspace/WESLLEY_RULES_EMAIL.md + IDENTITY + CAPABILITIES + AUTONOMY (lidos no bootstrap).',
                            'Escopo: ' + (profile.scope || ''),
                            '',
                            'Fluxo: (1) oryxa outlook read ' + messageId + ' --from-alias ' + addressed.alias + '  (2) Avalia qualidade: verifica se e pessoa real escrevendo diretamente. SALTA (sem lead, sem resposta) APENAS se o conteudo for claramente newsletter/marketing em massa OU email gerado por sistema automatizado (tracking, alertas, faturas automaticas, notificacoes de plataforma). Rodape corporativo de empresa NAO e sinal de automatico — e assinatura normal. Saudacao pessoal ou pedido direto = humano real. Humano real: oryxa clienthub identify ' + fromAddr + ' — se nao existir, cria lead source=email-inbound captured_by=' + profile.name + '  (3) responde no idioma do remetente, 1a pessoa SINGULAR (eu/faco — NUNCA "na Harakawa"), assinatura: 4 linhas (saudacao no idioma + ' + profile.name + ' + ' + profile.role + ' at Harakawa Tech + https://harakawa.tech)  (4) oryxa outlook reply ' + messageId + ' --from-name "' + profile.name + '" --from-alias "' + addressed.alias + '" --body "..."  (5) DM Weslley 1359081798 com resumo. Sem pedir permissao. Fora do escopo: handoff via delegateMap.'
                        ].join('\n');
                    }
                    const task = {
                        id: taskId,
                        fromAgent: 'weslley',
                        toAgent: addressed.agent,
                        toBotUsername: addressed.agent + '_oryxa_bot',
                        groupChatId: -5241757627,
                        request: request,
                        weslleyChatId: '1359081798',
                        sourceContext: baseContext + ':' + addressed.agent + (isNoreply ? '-noreply' : '-inbound'),
                        createdAt: Date.now(),
                    };
                    // Delay 30-90s pra parecer humana (não responde robotic em 5s)
                    const delayMs = isNoreply ? 0 : Math.floor(30000 + Math.random() * 60000);
                    setTimeout(() => {
                        try {
                            fs.writeFileSync(path.join(TEAM_BUS_PENDING, taskId + '.json'), JSON.stringify(task, null, 2));
                            console.log('[webhook-graph] DISPATCH (delayed ' + Math.round(delayMs/1000) + 's) → ' + addressed.agent + ' alias=' + addressed.alias + (isNoreply ? ' (noreply)' : ''));
                        } catch (e) { console.error('[webhook-graph] delayed dispatch failed:', e.message); }
                    }, delayMs);
                    console.log('[webhook-graph] ROUTE → ' + addressed.agent + ' alias=' + addressed.alias + ' (will dispatch in ' + Math.round(delayMs/1000) + 's)' + (isNoreply ? ' (noreply, immediate)' : ''));
                    }
                }

                if (!isRelevantForHelena(meta) && !addressed) {
                    console.log('[webhook-graph] SKIP (irrelevant + no alias) from=' + fromAddr + ' subject=' + subject.slice(0, 60) + ' resource=' + (n.resource || 'null').slice(0,80) + ' userAddr=' + (userAddress || 'null') + ' metaOk=' + (meta && meta.subject ? 'yes' : 'NO'));
                }
            } catch (e) {
                console.error('[webhook-graph] failed:', e.message);
            }
        }
    } catch (err) {
        console.error('[webhook-graph] handler error:', err.message);
        if (!res.headersSent) res.status(500).send('error');
    }
});



// ════════════════════════════════════════════════════════════════════════════
//  External API — for SaaS-to-SaaS integrations (Oryxa AI etc.)
//  Token-based auth (independent from cookie sessions used by the dashboard).
//  Persistence: /opt/openoryxa/instances/.external-tokens.json
//                /opt/openoryxa/instances/.oryxaai-connections.json
// ════════════════════════════════════════════════════════════════════════════

const EXT_TOKENS_PATH = path.join(BASE_DIR, '.external-tokens.json');
const CONNECTIONS_PATH = path.join(BASE_DIR, '.oryxaai-connections.json');

function loadExtTokens() {
    try { return JSON.parse(fs.readFileSync(EXT_TOKENS_PATH, 'utf8')); } catch { return { tokens: [] }; }
}
function saveExtTokens(d) { fs.writeFileSync(EXT_TOKENS_PATH, JSON.stringify(d, null, 2)); }

function loadConnections() {
    try { return JSON.parse(fs.readFileSync(CONNECTIONS_PATH, 'utf8')); } catch { return { connections: [] }; }
}
function saveConnections(d) { fs.writeFileSync(CONNECTIONS_PATH, JSON.stringify(d, null, 2)); }

function generateToken(prefix) {
    return prefix + '_' + crypto.randomBytes(24).toString('hex');
}

// Bearer token middleware — checks X-OpenOryxa-Token header or Authorization Bearer
function extAuth(req, res, next) {
    const auth = req.headers['authorization'] || '';
    const tokenHeader = req.headers['x-openoryxa-token'] || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = (m ? m[1] : tokenHeader).trim();
    if (!token) return res.status(401).json({ error: 'missing token' });
    const tdb = loadExtTokens();
    const t = tdb.tokens.find(x => x.token === token && (!x.expires_at || x.expires_at > Date.now()));
    if (!t) return res.status(401).json({ error: 'invalid or expired token' });
    req.extToken = t;
    req.extUserId = t.user_id;
    next();
}

// HMAC verification for incoming WhatsApp webhooks (request signed by Oryxa AI)
function verifyHmac(secret, body, signatureHeader) {
    if (!signatureHeader) return false;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHeader, 'hex'));
    } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/external/auth
// Trade email+password (same dashboard credentials) for a long-lived API token.
// Used by Oryxa AI integration setup wizard.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/external/auth', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const u = loadUsers().users.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!u || !bcrypt.compareSync(password, u.passwordHash)) {
        return res.status(401).json({ error: 'invalid credentials' });
    }
    const token = generateToken('ext');
    const tdb = loadExtTokens();
    tdb.tokens = tdb.tokens.filter(t => t.user_id !== u.id || (t.expires_at && t.expires_at > Date.now()));
    tdb.tokens.push({
        token,
        user_id: u.id,
        user_email: u.email,
        created_at: Date.now(),
        expires_at: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
        purpose: 'oryxaai-integration',
    });
    saveExtTokens(tdb);
    res.json({
        token,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        user: { id: u.id, email: u.email, name: u.name },
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/external/instances
// List the agents available to the authenticated user.
// (For the single-tenant prototype: returns the 7 Telegram-paired agents.)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/external/instances', extAuth, (req, res) => {
    const agents = TEAM_BUS_AGENTS.map(a => ({
        id:           a,
        name:         a.charAt(0).toUpperCase() + a.slice(1),
        telegram_bot: '@' + a + '_oryxa_bot',
        container:    'openclaw-' + a,
    }));
    res.json({ instances: agents });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/external/connect
// Register an Oryxa AI tenant connection. Returns the webhook secret used to
// HMAC-sign WhatsApp messages forwarded into this manager.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/external/connect', extAuth, (req, res) => {
    const {
        instance_id,
        oryxaai_tenant_id,
        oryxaai_callback_url,
        owner_whatsapp,
    } = req.body || {};
    if (!instance_id || !oryxaai_tenant_id || !oryxaai_callback_url) {
        return res.status(400).json({ error: 'instance_id, oryxaai_tenant_id and oryxaai_callback_url required' });
    }
    if (!TEAM_BUS_AGENTS.includes(instance_id)) {
        return res.status(400).json({ error: 'unknown instance_id' });
    }
    const cdb = loadConnections();
    cdb.connections = cdb.connections.filter(c => c.oryxaai_tenant_id !== oryxaai_tenant_id);
    const conn = {
        id: 'conn_' + crypto.randomBytes(8).toString('hex'),
        user_id: req.extUserId,
        instance_id,
        oryxaai_tenant_id,
        oryxaai_callback_url,
        owner_whatsapp: owner_whatsapp || null,
        webhook_secret: generateToken('wh'),
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
    };
    cdb.connections.push(conn);
    saveConnections(cdb);
    res.json({
        connection_id: conn.id,
        webhook_secret: conn.webhook_secret,
        manager_url: process.env.MANAGER_PUBLIC_URL || `https://dashboard.${DOMAIN}`,
        incoming_endpoint: (process.env.MANAGER_PUBLIC_URL || `https://dashboard.${DOMAIN}`) + '/api/whatsapp/incoming',
        instance: { id: instance_id, name: instance_id.charAt(0).toUpperCase() + instance_id.slice(1) },
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/external/connection
// Returns the current Oryxa AI connection for this user (if any).
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/external/connection', extAuth, (req, res) => {
    const cdb = loadConnections();
    const conns = cdb.connections.filter(c => c.user_id === req.extUserId && c.active);
    res.json({
        connections: conns.map(c => ({
            connection_id:    c.id,
            instance_id:      c.instance_id,
            oryxaai_tenant_id: c.oryxaai_tenant_id,
            owner_whatsapp:   c.owner_whatsapp,
            created_at:       c.created_at,
        })),
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/external/disconnect
// Remove the connection.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/external/disconnect', extAuth, (req, res) => {
    const { connection_id } = req.body || {};
    const cdb = loadConnections();
    const idx = cdb.connections.findIndex(c => c.id === connection_id && c.user_id === req.extUserId);
    if (idx < 0) return res.status(404).json({ error: 'connection not found' });
    cdb.connections.splice(idx, 1);
    saveConnections(cdb);
    res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/incoming
// Receive a WhatsApp message forwarded by Oryxa AI. HMAC-signed.
// Routes to the configured agent via team-bus.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/incoming', express.raw({ type: 'application/json', limit: '512kb' }), async (req, res) => {
    const sig = req.headers['x-oryxa-signature'] || '';
    const ts  = parseInt(req.headers['x-oryxa-timestamp'] || '0', 10);
    const tenantId = req.headers['x-oryxa-tenant'] || '';
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : (req.body || '');

    if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
        return res.status(401).json({ error: 'stale timestamp' });
    }
    const cdb = loadConnections();
    const conn = cdb.connections.find(c => c.oryxaai_tenant_id === tenantId && c.active);
    if (!conn) return res.status(404).json({ error: 'tenant not connected' });
    if (!verifyHmac(conn.webhook_secret, rawBody, sig)) {
        return res.status(401).json({ error: 'invalid signature' });
    }

    let payload;
    try { payload = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'invalid json' }); }
    const { from, from_label, message, message_id, conversation_id } = payload;
    if (!from || !message) return res.status(400).json({ error: 'from and message required' });

    const isOwner = !!(conn.owner_whatsapp && from.replace(/[^0-9]/g, '').endsWith(conn.owner_whatsapp.replace(/[^0-9]/g, '')));
    const targetAgent = conn.instance_id;

    // Enqueue as team-bus task — re-using existing queue infra.
    const taskId = 'wa-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const task = {
        id: taskId,
        fromAgent: 'oryxaai-bridge',
        toAgent: targetAgent,
        request: 'INCOMING_WHATSAPP\nfrom: ' + from + '\nfrom_label: ' + (from_label || '(unknown)') +
                 '\nis_owner: ' + isOwner + '\nconversation_id: ' + (conversation_id || '') +
                 '\nmessage: ' + message,
        meta: {
            source: 'whatsapp',
            tenant_id: tenantId,
            connection_id: conn.id,
            from, from_label, message_id, conversation_id,
            is_owner: isOwner,
            callback_url: conn.oryxaai_callback_url,
            callback_secret: conn.webhook_secret,
        },
        createdAt: new Date().toISOString(),
        status: 'pending',
    };
    fs.writeFileSync(path.join(TEAM_BUS_PENDING, taskId + '.json'), JSON.stringify(task, null, 2));
    res.json({ ok: true, task_id: taskId, instance: targetAgent, is_owner: isOwner });
});



// ════════════════════════════════════════════════════════════════════════════
//  WhatsApp outbox worker — processes pending wa-*.json tasks and POSTs
//  responses back to the Oryxa AI tenant's callback URL with HMAC signature.
//
//  Phase 2: invokes the real OpenClaw agent (e.g. clair) via docker exec
//  to generate the reply. Falls back to a polite error message if the agent
//  call fails so we never silently drop a WhatsApp message.
// ════════════════════════════════════════════════════════════════════════════

const TEAM_BUS_DONE = path.join(TEAM_BUS_DIR, 'done');
fs.mkdirSync(TEAM_BUS_DONE, { recursive: true });

// ─── shell out helper (docker exec the openclaw container) ──────────────────
function _execCapture(cmd, args, opts = {}) {
    const { spawn } = require('child_process');
    const timeoutMs = opts.timeoutMs || 90000;
    return new Promise((resolve) => {
        let stdout = '', stderr = '', done = false;
        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const timer = setTimeout(() => {
            if (done) return;
            try { child.kill('SIGKILL'); } catch {}
            done = true;
            resolve({ code: -1, stdout, stderr: stderr + '\n[wa-outbox] TIMEOUT after ' + timeoutMs + 'ms' });
        }, timeoutMs);
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', code => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
        });
        child.on('error', err => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
        });
    });
}

// Invoke `openclaw agent` inside the target agent container. Returns the
// agent's plain-text reply, or null on failure.
async function _invokeOpenClawAgent(meta, targetAgent) {
    const containerName = 'openclaw-' + targetAgent;
    // Seed the session with a hint about who is talking and that this is
    // WhatsApp — keeps the agent's tone right.
    const ownerLine = meta.is_owner
        ? '\n[Esta mensagem veio do OWNER (' + (meta.from_label || meta.from) + ') — voce tem permissao total.]'
        : '\n[Mensagem de: ' + (meta.from_label || meta.from) + '. Trate-os como cliente comum, sem permissoes elevadas.]';
    const promptText = ownerLine + '\n\n' + (meta.message || '').slice(0, 4000);

    // NOTE: docker exec creates a fresh shell that inherits ONLY the docker run -e env
    // (which has empty XAI_API_KEY/OPENAI_API_KEY because manager .settings.json doesn't
    // set them). The actual keys live in /home/node/.openclaw/secrets.env, sourced by the
    // entrypoint into PID 1 (the gateway). To make the openclaw CLI auth resolution see
    // them when invoked from outside, we wrap the call in a shell that sources secrets.env
    // first.
    const escMsg = promptText.replace(/'/g, "'\\''");
    const escTo  = (meta.from || '+0').replace(/'/g, "'\\''");
    const args = [
        'exec',
        containerName,
        'sh', '-c',
        "set -a; . /home/node/.openclaw/secrets.env 2>/dev/null; set +a; "
        + "exec openclaw agent --to '" + escTo + "' --message '" + escMsg + "' --json --timeout 90"
    ];
    const t0 = Date.now();
    const { code, stdout, stderr } = await _execCapture('docker', args, { timeoutMs: 100000 });
    const elapsed = Date.now() - t0;

    if (code !== 0) {
        console.error('[wa-outbox] openclaw agent exited ' + code + ' (' + elapsed + 'ms): ' + stderr.slice(0, 400));
        return null;
    }

    // Find the LAST JSON object in stdout (CLI may print warnings before).
    let parsed = null;
    try {
        // Quick path: full stdout is JSON
        parsed = JSON.parse(stdout);
    } catch {
        // Find the outermost JSON by scanning braces from the right
        const lastBrace = stdout.lastIndexOf('}');
        const firstBrace = stdout.indexOf('{');
        if (lastBrace > firstBrace && firstBrace >= 0) {
            try { parsed = JSON.parse(stdout.slice(firstBrace, lastBrace + 1)); } catch {}
        }
    }
    if (!parsed) {
        console.error('[wa-outbox] could not parse openclaw JSON output (len=' + stdout.length + '): ' + stdout.slice(-300));
        return null;
    }

    // openclaw `agent --json` shape (production): { payloads: [{text, mediaUrl}], meta: {...} }
    // Older shape (with full result block): { result: { finalAssistantVisibleText, ... } }
    let reply = null;
    if (Array.isArray(parsed.payloads) && parsed.payloads.length) {
        // Concatenate all text payloads (the agent may emit multiple bubbles)
        reply = parsed.payloads
            .map(p => (p && typeof p.text === 'string') ? p.text : '')
            .filter(Boolean)
            .join('\n\n');
    }
    if (!reply) {
        reply =
            (parsed.result && parsed.result.finalAssistantVisibleText) ||
            parsed.finalAssistantVisibleText ||
            (parsed.result && parsed.result.assistantText) ||
            parsed.assistantText ||
            null;
    }

    if (!reply || !reply.trim()) {
        console.error('[wa-outbox] openclaw returned empty reply; top keys: ' + Object.keys(parsed).slice(0, 10).join(','));
        return null;
    }
    console.log('[wa-outbox] openclaw replied in ' + elapsed + 'ms (' + reply.length + ' chars)');
    return reply.trim();
}

// Polite fallback if the agent call fails — we still acknowledge the message.
function _fallbackReply(meta, reason) {
    const greeting = meta.from_label ? meta.from_label + ', ' : '';
    return greeting + 'recebi tua mensagem mas o agente esta com um problema temporario (' + (reason || 'unknown') + '). Tenta de novo em alguns minutos, ou contacta o admin.';
}

async function _postCallback(callbackUrl, secret, payload) {
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const ts = Math.floor(Date.now() / 1000);
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(callbackUrl);
            const req = (u.protocol === 'https:' ? require('https') : require('http')).request({
                method: 'POST',
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + (u.search || ''),
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'X-OpenOryxa-Signature': sig,
                    'X-OpenOryxa-Timestamp': String(ts),
                    'X-OpenOryxa-Tenant': payload.tenant_id || '',
                },
                timeout: 12000,
            }, (r) => {
                let data = '';
                r.on('data', c => data += c);
                r.on('end', () => resolve({ status: r.statusCode, body: data }));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(body); req.end();
        } catch (e) { reject(e); }
    });
}

// In-flight guard: a wa-task can take 30-90s; we don't want the next tick
// to grab the same file and call openclaw twice.
const _waInflight = new Set();

async function _processWaTask(f) {
    if (_waInflight.has(f)) return;
    _waInflight.add(f);
    try {
        const taskPath = path.join(TEAM_BUS_PENDING, f);
        let task;
        try { task = JSON.parse(fs.readFileSync(taskPath, 'utf8')); } catch { return; }
        const meta = task.meta || {};
        if (!meta.callback_url || !meta.callback_secret) {
            try { fs.renameSync(taskPath, path.join(TEAM_BUS_FAILED, f)); } catch {}
            return;
        }

        // Determine target agent (defaults to clair).
        const targetAgent = (task.toAgent && TEAM_BUS_AGENTS.includes(task.toAgent))
            ? task.toAgent
            : 'clair';

        // Try real agent first; on any failure, fall back so the user gets *something*.
        let reply = null;
        let generatedBy = 'openclaw-' + targetAgent;
        try {
            reply = await _invokeOpenClawAgent(meta, targetAgent);
        } catch (e) {
            console.error('[wa-outbox] _invokeOpenClawAgent threw: ' + (e && e.message));
            reply = null;
        }
        if (!reply) {
            reply = _fallbackReply(meta, 'agent-unreachable');
            generatedBy = 'fallback';
        }

        const payload = {
            tenant_id:       meta.tenant_id,
            connection_id:   meta.connection_id,
            from:            meta.from,
            from_label:      meta.from_label,
            message:         meta.message,
            message_id:      meta.message_id,
            conversation_id: meta.conversation_id,
            is_owner:        meta.is_owner,
            reply,
            task_id:         task.id,
            generated_by:    generatedBy,
            agent:           targetAgent,
        };

        try {
            const r = await _postCallback(meta.callback_url, meta.callback_secret, payload);
            if (r.status >= 200 && r.status < 300) {
                fs.renameSync(taskPath, path.join(TEAM_BUS_DONE, f));
                console.log('[wa-outbox] delivered ' + task.id + ' -> ' + meta.from + ' (HTTP ' + r.status + ', ' + generatedBy + ')');
            } else {
                console.error('[wa-outbox] callback HTTP ' + r.status + ': ' + r.body.slice(0, 200));
            }
        } catch (e) {
            console.error('[wa-outbox] callback err: ' + e.message);
        }
    } finally {
        _waInflight.delete(f);
    }
}

async function whatsappOutboxTick() {
    let files;
    try {
        files = fs.readdirSync(TEAM_BUS_PENDING).filter(f => f.startsWith('wa-') && f.endsWith('.json'));
    } catch (e) { return; }

    // Process up to 3 in parallel — agent invocation is slow, but we don't
    // want a backlog to take forever.
    const slots = [];
    for (const f of files) {
        if (_waInflight.has(f)) continue;
        slots.push(_processWaTask(f));
        if (slots.length >= 3) break;
    }
    if (slots.length) await Promise.allSettled(slots);
}

setInterval(whatsappOutboxTick, 4000);
console.log('[wa-outbox] worker started (4s ticks, real openclaw agent invocation)');


// ════════════════════════════════════════════════════════════════════════════
//  OAuth-style flow for Oryxa AI integration.
//
//  Public flow:
//    1. Oryxa AI pops up: GET /oauth/connect-oryxaai?state=X&origin=Y&tenant_id=Z
//    2. If user not logged into the dashboard, the page renders a login form
//       (calls existing /api/login). After login the page reloads with state intact.
//    3. Logged-in: page lists user.instances + asks for owner WhatsApp,
//       then POSTs /oauth/connect-oryxaai/complete.
//    4. Manager creates connection (token+secret), POSTs the result to Oryxa AI
//       at <origin>/api/integrations/openoryxa/oauth-finish.
//    5. Browser is redirected to /oauth/connect-oryxaai/done which postMessages
//       the parent window and auto-closes.
// ════════════════════════════════════════════════════════════════════════════

const _OAUTH_HTML_HEAD = `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar Oryxa AI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050c18;color:#eef4fb;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#0d1730;border:1px solid #1a2a4a;border-radius:14px;padding:32px 28px;max-width:420px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.4)}
h1{font-size:1.25rem;margin-bottom:8px;font-weight:700}
p{font-size:.86rem;color:#8fa3b8;line-height:1.5;margin-bottom:18px}
.field{margin-bottom:14px}
label{display:block;font-size:.78rem;color:#8fa3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
input,select{width:100%;background:#050c18;border:1px solid #1a2a4a;color:#eef4fb;border-radius:10px;padding:11px 14px;font-size:.9rem;font-family:inherit}
input:focus,select:focus{outline:none;border-color:#5566ff}
button{width:100%;padding:12px 18px;border:none;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;font-family:inherit;transition:.15s}
.primary{background:linear-gradient(135deg,#5566ff,#7d3ce4);color:#fff;margin-top:8px}
.primary:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(85,102,255,.4)}
.primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
.cancel{background:transparent;color:#8fa3b8;margin-top:8px}
.cancel:hover{color:#eef4fb}
.error{color:#ff6464;font-size:.82rem;margin-top:10px;min-height:1.2em}
.greet{background:#050c18;border:1px solid #1a2a4a;border-radius:10px;padding:10px 14px;font-size:.84rem;margin-bottom:18px}
.greet strong{color:#7d3ce4}
.logo{font-size:1.6rem;margin-bottom:4px}
.spin{display:inline-block;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head><body><div class="card">`;

const _OAUTH_HTML_TAIL = `</div></body></html>`;

function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// GET /oauth/connect-oryxaai — render login OR consent page
app.get('/oauth/connect-oryxaai', (req, res) => {
    const state    = String(req.query.state    || '').slice(0, 128);
    const origin   = String(req.query.origin   || '').slice(0, 256);
    const tenantId = String(req.query.tenant_id || '').slice(0, 256);
    const ownerWaPrefill = String(req.query.owner_whatsapp || '').slice(0, 32);
    if (!state || !origin || !tenantId) {
        return res.status(400).send('Missing state, origin or tenant_id');
    }
    // sanity-check origin: must be https URL
    let originUrl;
    try { originUrl = new URL(origin); if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') throw 0; }
    catch { return res.status(400).send('Bad origin'); }

    const userId = req.session?.userId;
    const user = userId ? loadUsers().users.find(u => u.id === userId) : null;

    if (!user) {
        // Render login UI. After successful login, reload with same query string.
        const html = _OAUTH_HTML_HEAD
          + '<div class="logo">🔗</div>'
          + '<h1>Entrar no OpenOryxa</h1>'
          + '<p>Para conectar sua conta OpenOryxa ao Oryxa AI, faça login com suas credenciais do dashboard.</p>'
          + '<div class="field"><label>Email</label><input type="email" id="oo-email" autocomplete="username" required></div>'
          + '<div class="field"><label>Senha</label><input type="password" id="oo-pass" autocomplete="current-password" required></div>'
          + '<button class="primary" id="oo-go"><i></i>Entrar</button>'
          + '<div class="error" id="oo-err"></div>'
          + '<script>'
          + 'document.getElementById("oo-go").onclick=async function(){'
          + 'var btn=this,err=document.getElementById("oo-err");err.textContent="";btn.disabled=true;btn.innerHTML="Entrando...";'
          + 'try{var r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({email:document.getElementById("oo-email").value.trim(),password:document.getElementById("oo-pass").value})});'
          + 'var d=await r.json();if(!r.ok)throw new Error(d.error||"Login falhou");'
          + 'location.reload();'
          + '}catch(e){err.textContent=e.message||String(e);btn.disabled=false;btn.innerHTML="Entrar";}'
          + '};'
          + 'document.getElementById("oo-pass").addEventListener("keypress",function(e){if(e.key==="Enter")document.getElementById("oo-go").click();});'
          + '</script>'
          + _OAUTH_HTML_TAIL;
        return res.send(html);
    }

    // Logged in — render consent page.
    const userInstances = (user.instances || []).filter(Boolean);
    const allowedInstances = userInstances.length ? userInstances
        : (user.role === 'admin' ? TEAM_BUS_AGENTS : []);
    if (!allowedInstances.length) {
        const html = _OAUTH_HTML_HEAD
          + '<div class="logo">⚠️</div>'
          + '<h1>Sem agentes disponíveis</h1>'
          + '<p>Sua conta OpenOryxa não tem nenhum agente atribuído. Crie um agente no dashboard antes de conectar.</p>'
          + '<button class="cancel" onclick="window.close()">Fechar</button>'
          + _OAUTH_HTML_TAIL;
        return res.send(html);
    }

    const optionsHtml = allowedInstances.map(id => {
        const label = id.charAt(0).toUpperCase() + id.slice(1);
        return `<option value="${_esc(id)}">${_esc(label)}</option>`;
    }).join('');

    const html = _OAUTH_HTML_HEAD
      + '<div class="logo">🤝</div>'
      + '<h1>Conectar Oryxa AI</h1>'
      + '<p>O Oryxa AI vai poder rotear mensagens do WhatsApp dos contatos que voce marcar para o agente abaixo.</p>'
      + '<div class="greet">Logado como <strong>' + _esc(user.email) + '</strong></div>'
      + '<form id="oo-form">'
      + '<div class="field"><label>Agente que vai responder</label>'
      + '<select id="oo-instance">' + optionsHtml + '</select></div>'
      + '<div class="field"><label>Seu WhatsApp (owner — privilégios totais)</label>'
      + '<input type="tel" id="oo-owner" placeholder="+447716250965" value="' + _esc(ownerWaPrefill) + '" readonly style="opacity:0.85;cursor:not-allowed"></div>'
      + (ownerWaPrefill ? '<div style="font-size:.78rem;color:#7d3ce4;margin-top:-12px;margin-bottom:14px">Auto-detected from your connected WhatsApp</div>' : '')
      + '<button class="primary" id="oo-allow" type="submit">Permitir e conectar</button>'
      + '<button class="cancel" type="button" onclick="window.close()">Cancelar</button>'
      + '<div class="error" id="oo-err"></div>'
      + '</form>'
      + '<script>'
      + 'document.getElementById("oo-form").onsubmit=async function(e){'
      + 'e.preventDefault();var btn=document.getElementById("oo-allow"),err=document.getElementById("oo-err");err.textContent="";btn.disabled=true;btn.innerHTML="Conectando...";'
      + 'try{var fd=new URLSearchParams();fd.append("state",' + JSON.stringify(state) + ');fd.append("origin",' + JSON.stringify(origin) + ');fd.append("tenant_id",' + JSON.stringify(tenantId) + ');'
      + 'fd.append("instance_id",document.getElementById("oo-instance").value);fd.append("owner_whatsapp",document.getElementById("oo-owner").value.trim());'
      + 'var r=await fetch("/oauth/connect-oryxaai/complete",{method:"POST",credentials:"include",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()});'
      + 'var d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Erro");'
      + 'try{if(window.opener)window.opener.postMessage({type:"oryxaai-connect",ok:true},"*");}catch(_){}'
      + 'document.body.innerHTML="<div class=\\"card\\"><div class=\\"logo\\">✅</div><h1>Conectado!</h1><p>Esta janela vai fechar em instantes.</p></div>";'
      + 'setTimeout(function(){window.close();},1500);'
      + '}catch(e){err.textContent=e.message||String(e);btn.disabled=false;btn.innerHTML="Permitir e conectar";try{if(window.opener)window.opener.postMessage({type:"oryxaai-connect",ok:false,error:String(e.message||e)},"*");}catch(_){}}'
      + '};'
      + '</script>'
      + _OAUTH_HTML_TAIL;
    res.send(html);
});

// POST /oauth/connect-oryxaai/complete — create connection + callback Oryxa AI
app.post('/oauth/connect-oryxaai/complete', express.urlencoded({ extended: false, limit: '64kb' }), async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ ok: false, error: 'not authenticated' });
    const u = loadUsers().users.find(x => x.id === req.session.userId);
    if (!u) return res.status(401).json({ ok: false, error: 'not authenticated' });

    const state    = String(req.body.state    || '').slice(0, 128);
    const origin   = String(req.body.origin   || '').slice(0, 256);
    const tenantId = String(req.body.tenant_id || '').slice(0, 256);
    const instanceId = String(req.body.instance_id || '').slice(0, 64);
    const ownerWa  = String(req.body.owner_whatsapp || '').slice(0, 32);

    if (!state || !origin || !tenantId || !instanceId) {
        return res.status(400).json({ ok: false, error: 'missing required field' });
    }
    if (!TEAM_BUS_AGENTS.includes(instanceId)) {
        return res.status(400).json({ ok: false, error: 'unknown instance_id' });
    }

    // Build a fresh ext_token + connection (independent of the email/password /api/external/auth path)
    const extToken = generateToken('ext');
    const tdb = loadExtTokens();
    tdb.tokens = (tdb.tokens || []).filter(t => !(t.user_id === u.id && t.expires_at < Date.now()));
    tdb.tokens.push({
        token: extToken,
        user_id: u.id,
        email: u.email,
        created_at: Date.now(),
        expires_at: Date.now() + 90 * 24 * 60 * 60 * 1000,
    });
    saveExtTokens(tdb);

    // Connection record
    const cdb = loadConnections();
    cdb.connections = cdb.connections.filter(c => c.oryxaai_tenant_id !== tenantId);
    const callbackUrl = origin.replace(/\/+$/, '') + '/api/whatsapp/outgoing';
    const conn = {
        id: 'conn_' + crypto.randomBytes(8).toString('hex'),
        user_id: u.id,
        instance_id: instanceId,
        oryxaai_tenant_id: tenantId,
        oryxaai_callback_url: callbackUrl,
        owner_whatsapp: ownerWa || null,
        webhook_secret: generateToken('wh'),
        created_at: Date.now(),
        updated_at: Date.now(),
        active: true,
    };
    cdb.connections.push(conn);
    saveConnections(cdb);

    const managerUrl = process.env.MANAGER_PUBLIC_URL || `https://dashboard.${DOMAIN}`;
    const incomingEndpoint = managerUrl + '/api/whatsapp/incoming';

    // POST back to Oryxa AI's oauth-finish endpoint with the connection details.
    // Auth = matching `state` token (Oryxa AI generated it; only that tenant knows it).
    const finishUrl = origin.replace(/\/+$/, '') + '/api/integrations/openoryxa/oauth-finish';
    const payload = {
        state,
        ext_token: extToken,
        connection_id: conn.id,
        webhook_secret: conn.webhook_secret,
        manager_url: managerUrl,
        incoming_endpoint: incomingEndpoint,
        instance_id: instanceId,
        owner_whatsapp: ownerWa || null,
        user_email: u.email,
        user_id: u.id,
    };
    const body = JSON.stringify(payload);

    let postErr = null;
    try {
        await new Promise((resolve, reject) => {
            const fu = new URL(finishUrl);
            const lib = fu.protocol === 'https:' ? require('https') : require('http');
            const r = lib.request({
                method: 'POST',
                hostname: fu.hostname,
                port: fu.port || (fu.protocol === 'https:' ? 443 : 80),
                path: fu.pathname + (fu.search || ''),
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
                timeout: 12000,
            }, (rr) => {
                let data = '';
                rr.on('data', c => data += c);
                rr.on('end', () => {
                    if (rr.statusCode >= 200 && rr.statusCode < 300) resolve();
                    else reject(new Error('Oryxa AI returned ' + rr.statusCode + ': ' + data.slice(0, 200)));
                });
            });
            r.on('error', reject);
            r.on('timeout', () => { r.destroy(); reject(new Error('callback timeout')); });
            r.write(body); r.end();
        });
    } catch (e) {
        postErr = e.message || String(e);
        console.error('[oauth-oryxaai] callback err:', postErr);
    }

    if (postErr) {
        // Roll back the connection so /status on Oryxa AI doesn't show a phantom one
        const cdb2 = loadConnections();
        cdb2.connections = cdb2.connections.filter(c => c.id !== conn.id);
        saveConnections(cdb2);
        return res.status(502).json({ ok: false, error: postErr });
    }

    res.json({ ok: true });
});



// /*oauth-restore*/ Restore OAuth files from host to container after restart/recreation
async function restoreOAuthFilesForAgent(agent) {
    const cn = 'openclaw-' + agent;
    const oauthDir = path.join('/opt/openoryxa/instances', agent, 'oauth');
    if (!fs.existsSync(oauthDir)) return { ok: false, reason: 'no oauth dir on host' };
    const files = [
        ['microsoft_oauth.json', '/home/node/.openclaw/microsoft_oauth.json', '600'],
        ['microsoft_oauth_helper.sh', '/home/node/.openclaw/microsoft_oauth_helper.sh', '700'],
        ['google_oauth.json', '/home/node/.openclaw/google_oauth.json', '600'],
        ['google_oauth_helper.sh', '/home/node/.openclaw/google_oauth_helper.sh', '700'],
    ];
    const restored = [];
    for (const [host, target, mode] of files) {
        const src = path.join(oauthDir, host);
        if (!fs.existsSync(src)) continue;
        try {
            await runCommand('docker cp ' + shellQuote(src) + ' ' + cn + ':' + target);
            await runCommand('docker exec --user 0 ' + cn + ' chown node:node ' + target);
            await runCommand('docker exec --user 0 ' + cn + ' chmod ' + mode + ' ' + target);
            restored.push(host);
        } catch (e) {
            console.error('[oauth-restore]', agent, host, 'failed:', e.message);
        }
    }
    return { ok: true, restored };
}

// Sync OAuth files from container BACK to host (for refresh-token rotation persistence)
async function backupOAuthFilesForAgent(agent) {
    const cn = 'openclaw-' + agent;
    const oauthDir = path.join('/opt/openoryxa/instances', agent, 'oauth');
    fs.mkdirSync(oauthDir, { recursive: true });
    const files = [
        ['microsoft_oauth.json', '/home/node/.openclaw/microsoft_oauth.json'],
        ['microsoft_oauth_helper.sh', '/home/node/.openclaw/microsoft_oauth_helper.sh'],
        ['google_oauth.json', '/home/node/.openclaw/google_oauth.json'],
        ['google_oauth_helper.sh', '/home/node/.openclaw/google_oauth_helper.sh'],
    ];
    const backed = [];
    for (const [host, source] of files) {
        const dst = path.join(oauthDir, host);
        try {
            await runCommand('docker cp ' + cn + ':' + source + ' ' + shellQuote(dst));
            backed.push(host);
        } catch (e) {}
    }
    return { ok: true, backed };
}

// Periodic backup loop: every 30 min sync container → host so refreshed tokens persist
async function oauthBackupTick() {
    for (const agent of TEAM_BUS_AGENTS) {
        try { await backupOAuthFilesForAgent(agent); } catch {}
    }
}
setInterval(oauthBackupTick, 30 * 60 * 1000);
setTimeout(oauthBackupTick, 5 * 60 * 1000);  // first backup 5min after manager start
console.log('[oauth] backup loop started (30min interval)');

// Restore on monitor tick: if container restarted and oauth files vanished, restore
const _origTeamBusMonitorTick = teamBusMonitorTick;
teamBusMonitorTick = async function () {
    await _origTeamBusMonitorTick.apply(this, arguments);
    // Verify each agent has OAuth files; if not, restore from host
    for (const agent of TEAM_BUS_AGENTS) {
        const cn = 'openclaw-' + agent;
        try {
            const out = await runCommand('docker exec ' + cn + ' test -f /home/node/.openclaw/microsoft_oauth.json && echo Y || echo N').catch(() => 'N');
            if (typeof out === 'string' && out.trim().endsWith('N')) {
                console.log('[oauth-restore] missing on', agent, '— restoring from host');
                await restoreOAuthFilesForAgent(agent);
                maybeAlert('oauth-restored-' + agent, 'OAuth files restaurados em ' + agent + ' apos detectar perda.');
            }
        } catch {}
    }
};

// Admin endpoint: manual restore
app.post('/api/team-bus/oauth/restore', requireAuth, requireAdmin, async (req, res) => {
    const agent = String((req.body && req.body.agent) || '').toLowerCase();
    if (!TEAM_BUS_AGENTS.includes(agent) && agent !== 'all') return res.status(400).json({ error: 'bad agent' });
    const targets = agent === 'all' ? TEAM_BUS_AGENTS : [agent];
    const results = {};
    for (const a of targets) {
        results[a] = await restoreOAuthFilesForAgent(a);
    }
    res.json({ ok: true, results });
});




// ═══════════════════════════════════════════════════════════════════
// W8 ATLANTIC — Gmail poller (a cada 2min, sem webhook push)
// Detecta emails novos em w8atlantic@gmail.com, faz routing por To:
// e despacha tasks para as agentes (mesmo sistema do Graph webhook)
// ═══════════════════════════════════════════════════════════════════

const W8_OAUTH_FILE = '/opt/openoryxa/instances/clair/oauth/google_oauth.json';
const W8_GMAIL_ACCOUNT = 'w8atlantic@gmail.com';
const W8_PROCESSED_FILE = '/opt/openoryxa/team-bus/w8atlantic-processed.json';

const W8_AGENT_ALIASES = {
    aurora:  'aurora@w8atlantic.pt',
    bella:   'bella@w8atlantic.pt',
    clair:   'clair@w8atlantic.pt',
    helena:  'helena@w8atlantic.pt',
    iris:    'iris@w8atlantic.pt',
    luna:    'luna@w8atlantic.pt',
    sofia:   'sofia@w8atlantic.pt',
};

const W8_COMPANY = { name: 'W8 Atlantic', url: 'https://w8atlantic.pt' };

let _w8TokenCache = { token: null, exp: 0 };

function _w8GmailToken() {
    if (_w8TokenCache.token && Date.now() < _w8TokenCache.exp) return Promise.resolve(_w8TokenCache.token);
    return new Promise((resolve, reject) => {
        let cfg;
        try { cfg = JSON.parse(fs.readFileSync(W8_OAUTH_FILE, 'utf8')); } catch (e) { return reject(e); }
        const acc = cfg.accounts && cfg.accounts[W8_GMAIL_ACCOUNT];
        if (!acc) return reject(new Error('w8atlantic@gmail.com not found in oauth'));
        const client = acc.client || cfg.client;
        const body = new URLSearchParams({
            client_id: client.id,
            client_secret: client.secret,
            refresh_token: acc.refresh_token,
            grant_type: 'refresh_token',
        }).toString();
        const opts = { method: 'POST', hostname: 'oauth2.googleapis.com', path: '/token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
        const req = require('https').request(opts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(d);
                    if (!j.access_token) return reject(new Error('no access_token: ' + d.slice(0,200)));
                    _w8TokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3500) * 1000 - 60000 };
                    resolve(j.access_token);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function _w8GmailRequest(token, path, method, body) {
    return new Promise((resolve, reject) => {
        const opts = { method: method || 'GET', hostname: 'gmail.googleapis.com', path,
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
        const req = require('https').request(opts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); } catch { resolve({ status: res.statusCode, body: {} }); } });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function _w8ProcessedRead() {
    try { return new Set(JSON.parse(fs.readFileSync(W8_PROCESSED_FILE, 'utf8'))); } catch { return new Set(); }
}
function _w8ProcessedAdd(id) {
    const s = _w8ProcessedRead();
    s.add(id);
    // Guardar só os últimos 2000 para não crescer infinito
    const arr = [...s].slice(-2000);
    try { fs.writeFileSync(W8_PROCESSED_FILE, JSON.stringify(arr, null, 2)); } catch {}
}

function _w8DetectAgent(toHeader) {
    if (!toHeader) return null;
    const lower = toHeader.toLowerCase();
    for (const [agent, alias] of Object.entries(W8_AGENT_ALIASES)) {
        if (lower.includes(alias)) return { agent, alias };
    }
    return null;
}

async function _w8PollEmails() {
    let token;
    try { token = await _w8GmailToken(); } catch (e) { console.error('[w8-poll] token err:', e.message); return; }

    // Buscar emails não lidos nos últimos
    const r = await _w8GmailRequest(token, '/gmail/v1/users/me/messages?maxResults=20&q=is:unread+to:w8atlantic.pt');
    if (r.status !== 200) { console.error('[w8-poll] list err:', r.status); return; }
    const messages = (r.body.messages || []);
    if (!messages.length) return;

    const processed = _w8ProcessedRead();

    for (const msg of messages) {
        if (processed.has(msg.id)) continue;

        // Ler metadata
        const mr = await _w8GmailRequest(token,
            `/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Message-ID`);
        if (mr.status !== 200) continue;
        const headers = {};
        for (const h of (mr.body.payload && mr.body.payload.headers || [])) headers[h.name] = h.value;

        const fromAddr = (headers['From'] || '').replace(/.*</, '').replace(/>.*/, '').trim().toLowerCase();
        const subject = (headers['Subject'] || '').slice(0, 120);
        const msgId = msg.id;

        const addressed = _w8DetectAgent(headers['To'] || '');
        if (!addressed) { _w8ProcessedAdd(msgId); continue; }

        // Marcar como lido
        await _w8GmailRequest(token, `/gmail/v1/users/me/messages/${msgId}/modify`, 'POST',
            { removeLabelIds: ['UNREAD'] });
        _w8ProcessedAdd(msgId);

        // Dedupe
        const dedupeKey = msgId + ':' + addressed.agent;
        if (_webhookSeenRecently(dedupeKey)) { console.log('[w8-poll] SKIP dup', dedupeKey); continue; }
        _webhookMark(dedupeKey);

        const isNoreply = /noreply|no-reply|donotreply|notifications@|notification@|automated@/i.test(fromAddr);
        const profile = AGENT_PROFILES[addressed.agent] || { name: addressed.agent, role: '' };

        // Email counter
        const emCount = _emailCounterIncrement(addressed.agent, fromAddr);
        const taskId = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
        let request;

        if (isNoreply) {
            request = [
                'Email automático/noreply chegou em ' + addressed.alias + '.',
                'De: ' + fromAddr + ' | Assunto: ' + subject + ' | Gmail ID: ' + msgId,
                '',
                'NÃO responde (é noreply). Lê: oryxa w8atlantic read ' + msgId + '. Avisa-me no DM Telegram (chat 1359081798) APENAS se for algo importante. Se for notificação rotineira, ignora.',
            ].join('\n');
        } else if (emCount > EMAIL_COUNTER_MAX) {
            request = [
                'Email novo em ' + addressed.alias + ' de ' + fromAddr + ' sobre "' + subject + '" (Gmail ID: ' + msgId + ').',
                '',
                'Já atingi 15 respostas autónomas hoje pra este remetente — NÃO respondo automaticamente. Avisa o Weslley no DM (chat 1359081798): "⚠️ Limite 15 respostas/dia atingido pra ' + fromAddr + ' (assunto: ' + subject.slice(0,50) + '). Mandas-me o que responder?" e espera ordem dele.',
            ].join('\n');
        } else {
            request = [
                'Email novo em ' + addressed.alias + ' (conta W8 Atlantic).',
                'De: ' + fromAddr + ' | Assunto: ' + subject + ' | Gmail ID: ' + msgId,
                '',
                'Comando: oryxa w8atlantic read ' + msgId,
                '',
                'Fluxo:',
                '(1) oryxa w8atlantic read ' + msgId + '  — lê o email completo',
                '(2) Avalia qualidade: verifica se e pessoa real escrevendo diretamente. SALTA (sem lead, sem resposta) APENAS se o conteudo for claramente newsletter/marketing em massa OU email gerado por sistema automatizado (tracking, alertas, faturas automaticas, notificacoes de plataforma). Rodape corporativo de empresa NAO e sinal de automatico — e assinatura normal. Saudacao pessoal ou pedido direto = humano real. Humano real: oryxa clienthub identify ' + fromAddr + '  — se nao existe, cria lead captured_by=' + profile.name,
                '(3) Responde no idioma do remetente. Assinatura 4 linhas:',
                '    <saudação no idioma>',
                '    ' + profile.name,
                '    ' + profile.role + ' at W8 Atlantic',
                '    https://w8atlantic.pt',
                '(4) oryxa w8atlantic reply ' + msgId + ' --from-name "' + profile.name + '" --from-alias "' + addressed.alias + '" --body "..."',
                '(5) DM Weslley (chat 1359081798) com resumo 5 linhas.',
                '',
                'Fora do escopo: handoff educado para colega da Harakawa Tech. Mesmo escopo que tens para harakawa.tech.',
            ].join('\n');
        }

        const task = {
            id: taskId,
            fromAgent: 'weslley',
            toAgent: addressed.agent,
            toBotUsername: addressed.agent + '_oryxa_bot',
            groupChatId: -5241757627,
            request,
            weslleyChatId: '1359081798',
            sourceContext: 'w8atlantic-gmail:' + msgId + ':' + addressed.agent,
            createdAt: Date.now(),
        };

        const delayMs = isNoreply ? 0 : Math.floor(30000 + Math.random() * 60000);
        setTimeout(() => {
            try {
                fs.writeFileSync(path.join(TEAM_BUS_PENDING, taskId + '.json'), JSON.stringify(task, null, 2));
                console.log('[w8-poll] DISPATCH → ' + addressed.agent + ' alias=' + addressed.alias + ' from=' + fromAddr);
            } catch (e) { console.error('[w8-poll] dispatch err:', e.message); }
        }, delayMs);

        console.log('[w8-poll] ROUTE → ' + addressed.agent + ' (' + addressed.alias + ') from=' + fromAddr + ' subject=' + subject.slice(0,60));
    }
}

// Arrancar poller — intervalo 2 minutos, primeira execução após 30s
setTimeout(() => {
    _w8PollEmails().catch(e => console.error('[w8-poll] init err:', e.message));
    setInterval(() => {
        _w8PollEmails().catch(e => console.error('[w8-poll] poll err:', e.message));
    }, 120000);
}, 30000);

console.log('[w8-poll] W8 Atlantic Gmail poller iniciado (intervalo 2min)');

app.listen(port, () => {
    console.log(`OpenOryxa AI Agents Manager listening at http://localhost:${port}`);
    console.log(`auto-approval daemon running every 60s`);
});
