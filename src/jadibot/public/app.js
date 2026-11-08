const POLL_MS = 2000;
const LIVE_STATES = ["starting", "waiting", "reconnecting"];
const STATUS_LABEL = {
    starting: ["Memulakan", "warn"],
    waiting: ["Menunggu pemautan", "warn"],
    connected: ["Bersambung", "ok"],
    reconnecting: ["Menyambung semula", "warn"],
    offline: ["Luar talian", "off"],
    pending: ["Menunggu", "warn"],
    stopped: ["Dihentikan", "off"]
};

const state = { config: null, account: null, bots: [], poll: null, googleReady: false };
const view = document.getElementById("view");
const topbar = document.getElementById("topbar");
const toastBox = document.getElementById("toast");

function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (key === "value") node.value = value;
        else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

function toast(message, isError = false) {
    toastBox.textContent = message;
    toastBox.className = `toast${isError ? " error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastBox.classList.add("hidden"), 3800);
}

async function api(path, { method = "GET", body } = {}) {
    const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", "X-Requested-With": "jadibot-panel" },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({ ok: false, message: "Respons tidak sah." }));
    if (response.status === 401 && state.account) {
        state.account = null;
        renderAll();
    }
    if (!response.ok || !data.ok) throw new Error(data.message || "Permintaan gagal.");
    return data;
}

const run = async (button, task) => {
    if (button) button.disabled = true;
    try {
        await task();
    } catch (error) {
        toast(error.message, true);
    } finally {
        if (button) button.disabled = false;
    }
};

const formatTime = ms => (ms ? new Date(ms).toLocaleString("ms-MY") : "-");
const stopPolling = () => {
    clearInterval(state.poll);
    state.poll = null;
};

function badge(status) {
    const [label, tone] = STATUS_LABEL[status] ?? [status, ""];
    return h("span", { class: `badge ${tone}` }, label);
}

function field(label, input, hint) {
    return h("label", { class: "field" }, h("span", {}, label), input, hint ? h("small", { class: "muted" }, hint) : null);
}

function renderTopbar() {
    topbar.replaceChildren(
        h("a", { class: "brand", href: "/" }, h("span", { class: "brand-mark" }, "⚡"), h("span", {}, `${state.config?.botName ?? "Jadibot"} Panel`)),
        state.account
            ? h(
                  "nav",
                  { class: "nav" },
                  h("button", { class: "btn", onclick: () => navigate("dashboard") }, "Bot saya"),
                  h("button", { class: "btn", onclick: () => navigate("account") }, state.account.email),
                  h("button", { class: "btn", onclick: logout }, "Keluar")
              )
            : null
    );
}

async function logout() {
    await run(null, async () => {
        await api("/api/auth/logout", { method: "POST" });
        state.account = null;
        state.bots = [];
        stopPolling();
        renderAll();
    });
}

function navigate(name, params = {}) {
    stopPolling();
    const next = new URL(location.href);
    next.search = "";
    next.hash = name === "dashboard" ? "" : `#${name}${params.id ? `/${params.id}` : ""}`;
    history.pushState({}, "", next);
    renderAll();
}

function authView(mode = "login") {
    const card = h("div", { class: "card" });
    const tabs = h(
        "div",
        { class: "tabs" },
        h("button", { class: `tab${mode === "login" ? " active" : ""}`, onclick: () => card.replaceWith(authView("login")) }, "Log masuk"),
        h("button", { class: `tab${mode === "register" ? " active" : ""}`, onclick: () => card.replaceWith(authView("register")) }, "Daftar")
    );

    const email = h("input", { type: "email", placeholder: "nama@email.com", autocomplete: "email", required: true });
    const password = h("input", { type: "password", placeholder: `Minimum ${state.config.minPassword} aksara`, autocomplete: mode === "login" ? "current-password" : "new-password", required: true });
    const name = h("input", { type: "text", placeholder: "Nama anda (pilihan)", maxlength: 40 });
    const wa = h("input", { type: "tel", placeholder: "60123456789 (pilihan)", inputmode: "numeric" });
    const invite = h("input", { type: "password", placeholder: "Kod jemputan" });

    const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, mode === "login" ? "Log masuk" : "Cipta akaun");
    const form = h(
        "form",
        {
            onsubmit: event => {
                event.preventDefault();
                run(submit, async () => {
                    const body = { email: email.value, password: password.value };
                    if (mode === "register") Object.assign(body, { name: name.value, waNumber: wa.value, invite: invite.value });
                    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body });
                    state.account = data.account;
                    navigate("dashboard");
                });
            }
        },
        field("Email", email),
        field("Kata laluan", password),
        mode === "register" ? field("Nama", name) : null,
        mode === "register" ? field("Nombor WhatsApp", wa, "Digunakan untuk menerima pautan tetapan semula kata laluan.") : null,
        mode === "register" && state.config.requiresInvite ? field("Kod jemputan", invite) : null,
        submit,
        mode === "login" ? h("p", { class: "muted", style: "margin-top:12px" }, h("a", { onclick: () => card.replaceWith(forgotView()) }, "Lupa kata laluan?")) : null
    );

    card.append(tabs, form);
    if (state.config.googleClientId) {
        const slot = h("div", { id: "google-slot", class: "row", style: "margin-top:16px;justify-content:center" });
        card.append(h("p", { class: "muted", style: "text-align:center;margin-top:16px" }, "atau"), slot);
        mountGoogle(slot);
    }
    return card;
}

function forgotView() {
    const email = h("input", { type: "email", placeholder: "nama@email.com", required: true });
    const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Hantar pautan tetapan semula");
    const card = h(
        "div",
        { class: "card" },
        h("h2", {}, "Lupa kata laluan"),
        h("p", { class: "muted" }, "Pautan tetapan semula dihantar ke email anda dan/atau WhatsApp yang dipautkan."),
        h(
            "form",
            {
                onsubmit: event => {
                    event.preventDefault();
                    run(submit, async () => toast((await api("/api/auth/forgot", { method: "POST", body: { email: email.value } })).message));
                }
            },
            field("Email", email),
            submit
        ),
        h("p", { class: "muted", style: "margin-top:12px" }, h("a", { onclick: () => card.replaceWith(authView("login")) }, "← Kembali"))
    );
    return card;
}

function resetView(token) {
    const password = h("input", { type: "password", placeholder: `Minimum ${state.config.minPassword} aksara`, autocomplete: "new-password", required: true });
    const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Tetapkan kata laluan");
    return h(
        "div",
        { class: "card narrow" },
        h("h2", {}, "Kata laluan baharu"),
        h(
            "form",
            {
                onsubmit: event => {
                    event.preventDefault();
                    run(submit, async () => {
                        const data = await api("/api/auth/reset", { method: "POST", body: { token, password: password.value } });
                        state.account = data.account;
                        toast("Kata laluan dikemas kini.");
                        navigate("dashboard");
                    });
                }
            },
            field("Kata laluan baharu", password),
            submit
        )
    );
}

function mountGoogle(slot) {
    const init = () => {
        window.google.accounts.id.initialize({
            client_id: state.config.googleClientId,
            callback: response =>
                run(null, async () => {
                    const data = await api("/api/auth/google", { method: "POST", body: { credential: response.credential } });
                    state.account = data.account;
                    navigate("dashboard");
                })
        });
        window.google.accounts.id.renderButton(slot, { theme: "outline", size: "large", text: "continue_with", width: 280 });
    };
    if (window.google?.accounts) return init();
    if (state.googleReady) return;
    state.googleReady = true;
    const script = h("script", { src: "https://accounts.google.com/gsi/client", async: true, defer: true });
    script.addEventListener("load", () => {
        const target = document.getElementById("google-slot");
        if (target) init();
    });
    document.head.append(script);
}

function landing(authNode) {
    return h(
        "section",
        { class: "hero" },
        h(
            "div",
            {},
            h("h1", {}, "Jalankan ", h("span", { class: "accent" }, "bot WhatsApp"), " anda sendiri"),
            h("p", { class: "muted" }, "Pautkan nombor anda melalui kod pairing atau QR, tetapkan awalan, penjaga, had dan mesej bot, semuanya dari satu dashboard."),
            h(
                "ul",
                { class: "features" },
                h("li", {}, "🔗", h("span", {}, h("b", {}, "Pairing atau QR."), " Tanpa memasang apa-apa.")),
                h("li", {}, "⚙️", h("span", {}, h("b", {}, "Tetapan penuh."), " Awalan, penjaga, had harian dan templat mesej.")),
                h("li", {}, "💬", h("span", {}, h("b", {}, "Disegerakkan."), " Tukar dari WhatsApp atau web, kedua-duanya sama.")),
                h("li", {}, "🔒", h("span", {}, h("b", {}, "Selamat."), " Kata laluan dienkripsi, reset melalui email atau WhatsApp."))
            )
        ),
        authNode
    );
}

function botCard(bot) {
    return h(
        "div",
        { class: "card bot-card" },
        h("div", { class: "row spread" }, h("h3", {}, bot.name), badge(bot.status)),
        h(
            "dl",
            { class: "kv" },
            h("dt", {}, "Nombor"), h("dd", {}, bot.number ? `+${bot.number}` : bot.pairNumber ? `+${bot.pairNumber} (belum dipautkan)` : "belum dipautkan"),
            h("dt", {}, "Sesi"), h("dd", {}, bot.id),
            h("dt", {}, "Sumber"), h("dd", {}, bot.source === "web" ? "Web" : "WhatsApp")
        ),
        h("button", { class: "btn btn-block", onclick: () => navigate("bot", { id: bot.id }) }, "Urus bot")
    );
}

async function dashboardView() {
    const data = await api("/api/bots");
    state.bots = data.bots;
    const online = state.bots.filter(bot => bot.status === "connected").length;
    return h(
        "div",
        {},
        h("div", { class: "row spread" }, h("div", {}, h("h1", {}, "Bot saya"), h("p", { class: "muted" }, `Log masuk sebagai ${state.account.email}`)), h("button", { class: "btn btn-primary", onclick: () => navigate("new") }, "+ Bot baharu")),
        h(
            "div",
            { class: "stats" },
            h("div", { class: "stat" }, h("b", {}, state.bots.length), h("span", { class: "muted" }, "Jumlah bot")),
            h("div", { class: "stat" }, h("b", {}, online), h("span", { class: "muted" }, "Dalam talian")),
            h("div", { class: "stat" }, h("b", {}, `${state.bots.length}/${state.config.maxBots}`), h("span", { class: "muted" }, "Kuota bot"))
        ),
        state.bots.length ? h("div", { class: "grid" }, state.bots.map(botCard)) : h("div", { class: "card empty" }, "Anda belum mempunyai bot. Tekan “Bot baharu” untuk bermula.")
    );
}

function newBotView() {
    let method = "pairing";
    const name = h("input", { type: "text", placeholder: "cth. Bot Kedai Ali", minlength: 3, maxlength: 25, required: true });
    const number = h("input", { type: "tel", placeholder: "60123456789", inputmode: "numeric" });
    const numberField = field("Nombor WhatsApp untuk dijadikan bot", number, "Guna kod negara, tanpa +. Nombor ini dan anda akan menjaga bot.");
    const choice = h("div", { class: "tabs" });
    const select = value => {
        method = value;
        choice.replaceChildren(
            h("button", { type: "button", class: `tab${value === "pairing" ? " active" : ""}`, onclick: () => select("pairing") }, "Kod pairing"),
            h("button", { type: "button", class: `tab${value === "qr" ? " active" : ""}`, onclick: () => select("qr") }, "Kod QR")
        );
        numberField.classList.toggle("hidden", value === "qr");
    };
    select("pairing");
    const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Cipta bot");
    return h(
        "div",
        { class: "card narrow" },
        h("h2", {}, "Bot baharu"),
        h(
            "form",
            {
                onsubmit: event => {
                    event.preventDefault();
                    run(submit, async () => {
                        const data = await api("/api/bots", { method: "POST", body: { name: name.value, method, number: number.value } });
                        navigate("bot", { id: data.bot.id });
                    });
                }
            },
            field("Nama bot", name),
            h("span", { class: "muted" }, "Kaedah pemautan"),
            choice,
            numberField,
            submit
        ),
        h("p", { class: "muted", style: "margin-top:12px" }, h("a", { onclick: () => navigate("dashboard") }, "← Kembali"))
    );
}

function statusPanel(bot) {
    const nodes = [
        h(
            "dl",
            { class: "kv" },
            h("dt", {}, "Status"), h("dd", {}, badge(bot.status)),
            h("dt", {}, "Nombor"), h("dd", {}, bot.number ? `+${bot.number}` : "-"),
            h("dt", {}, "Nama sesi"), h("dd", {}, bot.id),
            h("dt", {}, "Dicipta"), h("dd", {}, formatTime(bot.createdAt)),
            h("dt", {}, "Terakhir aktif"), h("dd", {}, formatTime(bot.lastConnectedAt))
        )
    ];
    if (bot.pairingCode) {
        nodes.push(
            h("p", { class: "muted" }, "Masukkan kod ini pada WhatsApp:"),
            h("div", { class: "code" }, bot.pairingCode),
            h("button", { class: "btn", onclick: () => navigator.clipboard.writeText(bot.pairingCode).then(() => toast("Kod disalin")) }, "Salin kod"),
            h("ol", { class: "steps" }, h("li", {}, `Buka WhatsApp pada +${bot.pairNumber}.`), h("li", {}, "Peranti Dipautkan › Pautkan peranti."), h("li", {}, 'Pilih "Pautkan dengan nombor telefon".'), h("li", {}, "Masukkan kod di atas."))
        );
    }
    if (bot.qr) nodes.push(h("p", { class: "muted" }, "Imbas kod QR ini melalui Peranti Dipautkan:"), h("img", { class: "qr", src: bot.qr, alt: "Kod QR WhatsApp" }));
    if (bot.status === "connected") nodes.push(h("p", { class: "muted" }, "Bot aktif. Taip .menu dalam chat bot untuk mencuba."));
    return nodes;
}

function settingsPanel(bot) {
    const s = bot.settings;
    const name = h("input", { type: "text", value: bot.name, minlength: 3, maxlength: 25 });
    const prefix = h("input", { type: "text", value: s.prefix.join(" ") });
    const mode = h("select", {}, h("option", { value: "public" }, "Public (semua pengguna)"), h("option", { value: "self" }, "Self (penjaga sahaja)"));
    mode.value = s.mode;
    const daily = h("input", { type: "number", min: 0, max: 100000, value: s.limit.daily });
    let focused = null;
    const areas = {};
    for (const [key, fallback] of Object.entries(state.config.messageKeys)) {
        areas[key] = h("textarea", { placeholder: fallback ? `Lalai: ${fallback}` : "Guna mesej lalai", maxlength: 600 });
        areas[key].value = s.messages[key] ?? "";
        areas[key].addEventListener("focus", () => (focused = areas[key]));
    }
    const chips = h(
        "div",
        { class: "chips" },
        state.config.placeholders.map(item =>
            h("button", {
                type: "button",
                class: "chip",
                onclick: () => {
                    const target = focused ?? Object.values(areas)[0];
                    const start = target.selectionStart ?? target.value.length;
                    target.setRangeText(`{${item}}`, start, target.selectionEnd ?? start, "end");
                    target.focus();
                }
            }, `{${item}}`)
        )
    );
    const submit = h("button", { class: "btn btn-primary", type: "submit" }, "Simpan tetapan");
    return h(
        "form",
        {
            onsubmit: event => {
                event.preventDefault();
                run(submit, async () => {
                    const messages = Object.fromEntries(Object.entries(areas).map(([key, area]) => [key, area.value]));
                    await api(`/api/bots/${bot.id}/settings`, {
                        method: "PATCH",
                        body: { name: name.value, prefix: prefix.value.split(/[\s,]+/).filter(Boolean), mode: mode.value, limit: { daily: Number(daily.value) }, messages }
                    });
                    toast("Tetapan disimpan. Berkuat kuasa serta-merta.");
                });
            }
        },
        h("h3", {}, "Umum"),
        field("Nama bot", name),
        field("Awalan perintah", prefix, "Pisahkan dengan ruang, cth: . ! /"),
        field("Mod", mode),
        field("Had harian setiap pengguna", daily, "0 = tanpa had. Penjaga dan premium dikecualikan."),
        h("h3", { style: "margin-top:20px" }, "Mesej bot"),
        h("p", { class: "muted" }, "Kosongkan untuk guna mesej lalai. Klik pemegang tempat untuk memasukkannya ke dalam kotak yang dipilih."),
        chips,
        Object.entries(areas).map(([key, area]) => field(key, area)),
        submit
    );
}

function ownersPanel(bot) {
    const number = h("input", { type: "tel", placeholder: "60123456789", inputmode: "numeric" });
    const protectedParts = new Set([bot.number, bot.pairNumber].filter(Boolean));
    const send = (action, value, button) =>
        run(button, async () => {
            await api(`/api/bots/${bot.id}/owners`, { method: "POST", body: { action, number: value } });
            toast(action === "add" ? "Penjaga ditambah." : "Penjaga dibuang.");
            navigate("bot", { id: bot.id });
        });
    return h(
        "div",
        {},
        h("p", { class: "muted" }, "Penjaga boleh menggunakan perintah tetapan dalam chat bot dan tidak terkena had harian."),
        bot.owners.length
            ? h("ul", { class: "list" }, bot.owners.map(owner => h("li", {}, `+${owner}`, protectedParts.has(owner) ? h("span", { class: "muted" }, "nombor bot") : h("button", { class: "btn btn-danger", onclick: event => send("del", owner, event.currentTarget) }, "Buang"))))
            : h("p", { class: "muted" }, "Tiada penjaga."),
        h("div", { class: "row" }, number, h("button", { class: "btn btn-primary", onclick: event => send("add", number.value, event.currentTarget) }, "Tambah"))
    );
}

function dangerPanel(bot) {
    const confirm = h("input", { type: "text", placeholder: `Taip "${bot.name}" untuk mengesahkan` });
    return h(
        "div",
        {},
        h("h3", {}, "Mulakan semula"),
        h("p", { class: "muted" }, "Menyambung semula bot menggunakan sesi sedia ada."),
        h("button", { class: "btn", onclick: event => run(event.currentTarget, async () => { await api(`/api/bots/${bot.id}/restart`, { method: "POST" }); toast("Bot dimulakan semula."); navigate("bot", { id: bot.id }); }) }, "🔄 Restart"),
        h("h3", { style: "margin-top:24px" }, "Padam bot"),
        h("p", { class: "muted" }, "Sesi dipadam dan peranti dinyahpautkan. Tindakan ini tidak boleh dibatalkan."),
        field("Pengesahan", confirm),
        h("button", { class: "btn btn-danger", onclick: event => run(event.currentTarget, async () => {
            if (confirm.value !== bot.name) throw new Error("Nama bot tidak sepadan.");
            await api(`/api/bots/${bot.id}`, { method: "DELETE" });
            toast("Bot dipadam.");
            navigate("dashboard");
        }) }, "🗑️ Padam bot")
    );
}

async function botView(id) {
    const { bot } = await api(`/api/bots/${id}`);
    const statusBox = h("div", {}, statusPanel(bot));
    const body = h("div", {});
    const panels = {
        status: () => statusBox,
        settings: () => settingsPanel(bot),
        owners: () => ownersPanel(bot),
        danger: () => dangerPanel(bot)
    };
    const labels = { status: "Status", settings: "Tetapan", owners: "Penjaga", danger: "Lanjutan" };
    const tabs = h("div", { class: "tabs" });
    const show = key => {
        tabs.replaceChildren(...Object.entries(labels).map(([name, label]) => h("button", { class: `tab${name === key ? " active" : ""}`, onclick: () => show(name) }, label)));
        body.replaceChildren(panels[key]());
    };
    show("status");

    stopPolling();
    state.poll = setInterval(async () => {
        try {
            const fresh = await api(`/api/bots/${id}`);
            statusBox.replaceChildren(...statusPanel(fresh.bot));
        } catch {
            stopPolling();
        }
    }, POLL_MS);

    return h(
        "div",
        {},
        h("p", { class: "muted" }, h("a", { onclick: () => navigate("dashboard") }, "← Semua bot")),
        h("div", { class: "row spread" }, h("h1", {}, bot.name), badge(bot.status)),
        h("div", { class: "card" }, tabs, body)
    );
}

function accountView() {
    const a = state.account;
    const name = h("input", { type: "text", value: a.name ?? "", maxlength: 40 });
    const wa = h("input", { type: "tel", value: a.waNumber ?? "", inputmode: "numeric" });
    const saveBtn = h("button", { class: "btn btn-primary", type: "submit" }, "Simpan profil");
    const current = h("input", { type: "password", autocomplete: "current-password" });
    const next = h("input", { type: "password", autocomplete: "new-password", placeholder: `Minimum ${state.config.minPassword} aksara` });
    const passBtn = h("button", { class: "btn btn-primary", type: "submit" }, "Tukar kata laluan");
    const confirm = h("input", { type: "email", placeholder: a.email });
    const delPass = h("input", { type: "password" });
    return h(
        "div",
        { class: "narrow" },
        h("h1", {}, "Akaun"),
        h("div", { class: "card", style: "margin-bottom:16px" }, h("h3", {}, "Profil"), h("form", { onsubmit: e => { e.preventDefault(); run(saveBtn, async () => { state.account = (await api("/api/me", { method: "PATCH", body: { name: name.value, waNumber: wa.value } })).account; toast("Profil disimpan."); }); } }, field("Email", h("input", { value: a.email, disabled: true })), field("Nama", name), field("Nombor WhatsApp", wa), saveBtn)),
        h("div", { class: "card", style: "margin-bottom:16px" }, h("h3", {}, "Kata laluan"), h("form", { onsubmit: e => { e.preventDefault(); run(passBtn, async () => { await api("/api/me/password", { method: "POST", body: { current: current.value, next: next.value } }); state.account = null; toast("Kata laluan ditukar. Sila log masuk semula."); renderAll(); }); } }, a.hasPassword ? field("Kata laluan semasa", current) : null, field("Kata laluan baharu", next), passBtn)),
        h("div", { class: "card" }, h("h3", {}, "Padam akaun"), h("p", { class: "muted" }, "Semua bot di bawah akaun ini akan dipadam dan peranti dinyahpautkan."), field("Taip email anda", confirm), a.hasPassword ? field("Kata laluan", delPass) : null, h("button", { class: "btn btn-danger", onclick: e => run(e.currentTarget, async () => { const result = await api("/api/me", { method: "DELETE", body: { confirm: confirm.value, password: delPass.value } }); state.account = null; toast(`Akaun dipadam (${result.removedBots} bot).`); renderAll(); }) }, "Padam akaun saya"))
    );
}

async function renderAll() {
    renderTopbar();
    stopPolling();
    const params = new URLSearchParams(location.search);
    const [page, id] = location.hash.replace(/^#/, "").split("/");
    try {
        let node;
        if (params.get("reset")) node = resetView(params.get("reset"));
        else if (!state.account) node = landing(authView("login"));
        else if (page === "new") node = newBotView();
        else if (page === "bot" && id) node = await botView(id);
        else if (page === "account") node = accountView();
        else node = await dashboardView();
        view.replaceChildren(node);
    } catch (error) {
        toast(error.message, true);
        if (state.account) view.replaceChildren(h("div", { class: "card empty" }, error.message, h("p", {}, h("a", { onclick: () => navigate("dashboard") }, "Kembali"))));
    }
}

async function start() {
    try {
        state.config = await api("/api/config");
    } catch {
        view.textContent = "Gagal memuatkan konfigurasi pelayan.";
        return;
    }
    try {
        state.account = (await api("/api/me")).account;
    } catch {
        state.account = null;
    }
    window.addEventListener("popstate", renderAll);
    renderAll();
}

start();
