const POLL_INTERVAL = 2000;
const STORAGE_KEY = "jadibot-session";

const el = id => document.getElementById(id);
const nodes = {
    botName: el("botName"),
    setup: el("setup"),
    result: el("result"),
    numberField: el("numberField"),
    number: el("number"),
    codeField: el("codeField"),
    accessCode: el("accessCode"),
    startBtn: el("startBtn"),
    stopBtn: el("stopBtn"),
    copyBtn: el("copyBtn"),
    badge: el("statusBadge"),
    statusText: el("statusText"),
    pairingBox: el("pairingBox"),
    pairingCode: el("pairingCode"),
    qrBox: el("qrBox"),
    qrImage: el("qrImage"),
    doneBox: el("doneBox"),
    doneNumber: el("doneNumber"),
    message: el("message")
};

const state = { method: "pairing", session: null, timer: null, requiresCode: false };

const STATUS_LABELS = {
    starting: "Memulakan",
    waiting: "Menunggu pemautan",
    connected: "Bersambung",
    reconnecting: "Menyambung semula",
    stopped: "Dihentikan"
};

function showMessage(text) {
    nodes.message.textContent = text;
    nodes.message.classList.toggle("hidden", !text);
}

function show(node, visible) {
    node.classList.toggle("hidden", !visible);
}

async function api(path, { method = "GET", body, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-session-token"] = token;
    if (state.requiresCode) headers["x-access-code"] = nodes.accessCode.value;

    const response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({ ok: false, message: "Respons tidak sah." }));
    if (!response.ok || !data.ok) throw new Error(data.message || "Permintaan gagal.");
    return data;
}

function selectMethod(method) {
    state.method = method;
    document.querySelectorAll(".choice-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.method === method);
    });
    show(nodes.numberField, method === "pairing");
}

function render(session) {
    const connected = session.status === "connected";
    nodes.badge.textContent = STATUS_LABELS[session.status] ?? session.status;
    nodes.badge.classList.toggle("ok", connected);
    nodes.statusText.textContent = session.method === "qr" ? "Kaedah: QR" : "Kaedah: Pairing";

    show(nodes.pairingBox, !connected && Boolean(session.pairingCode));
    nodes.pairingCode.textContent = session.pairingCode || "";

    show(nodes.qrBox, !connected && Boolean(session.qr));
    if (session.qr) nodes.qrImage.src = session.qr;

    show(nodes.doneBox, connected);
    nodes.doneNumber.textContent = connected && session.number ? `Nombor: +${session.number}` : "";
}

function resetUi(message) {
    clearInterval(state.timer);
    state.timer = null;
    state.session = null;
    localStorage.removeItem(STORAGE_KEY);
    show(nodes.result, false);
    show(nodes.setup, true);
    nodes.startBtn.disabled = false;
    showMessage(message || "");
}

async function poll() {
    if (!state.session) return;
    try {
        const { session } = await api(`/api/jadibot/${state.session.id}`, { token: state.session.token });
        render(session);
        if (session.status === "stopped") resetUi("Sesi telah dihentikan.");
    } catch (error) {
        resetUi("Sesi tamat atau tidak dijumpai. Sila mulakan semula.");
    }
}

function beginPolling(session) {
    state.session = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    show(nodes.setup, false);
    show(nodes.result, true);
    clearInterval(state.timer);
    poll();
    state.timer = setInterval(poll, POLL_INTERVAL);
}

async function start() {
    showMessage("");
    nodes.startBtn.disabled = true;
    try {
        const body = { method: state.method, number: nodes.number.value.replace(/\D/g, "") };
        const data = await api("/api/jadibot/start", { method: "POST", body });
        beginPolling({ id: data.id, token: data.token });
    } catch (error) {
        nodes.startBtn.disabled = false;
        showMessage(error.message);
    }
}

async function stop() {
    if (!state.session) return;
    try {
        await api(`/api/jadibot/${state.session.id}/stop`, { method: "POST", token: state.session.token });
    } catch (error) {
        showMessage(error.message);
    }
    resetUi("Sesi dihentikan.");
}

async function copyCode() {
    try {
        await navigator.clipboard.writeText(nodes.pairingCode.textContent);
        nodes.copyBtn.textContent = "Disalin";
        setTimeout(() => (nodes.copyBtn.textContent = "Salin kod"), 1500);
    } catch {
        showMessage("Gagal menyalin. Salin kod secara manual.");
    }
}

async function init() {
    document.querySelectorAll(".choice-btn").forEach(button => {
        button.addEventListener("click", () => selectMethod(button.dataset.method));
    });
    nodes.startBtn.addEventListener("click", start);
    nodes.stopBtn.addEventListener("click", stop);
    nodes.copyBtn.addEventListener("click", copyCode);

    try {
        const config = await api("/api/config");
        nodes.botName.textContent = `${config.botName} · Jadibot`;
        state.requiresCode = config.requiresCode;
        show(nodes.codeField, config.requiresCode);
    } catch (error) {
        showMessage("Gagal memuatkan konfigurasi pelayan.");
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            beginPolling(JSON.parse(saved));
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

init();
