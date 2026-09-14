(async function () {
  "use strict";
  const { $, node, request, remember, recall, download, saveCanvas, card, copy } = WallUI;
  const params = new URLSearchParams(location.search);
  const demo = params.get("demo") === "1", roomId = params.get("room") || "";
  const managed = /^w_[a-f0-9]{24}$/.test(roomId), embed = demo && params.get("embed") === "1";
  if (!demo && !roomId) { location.replace("/wedding-live-wall.html"); return; }
  if (embed) document.body.classList.add("embed");
  const fragmentKey = new URLSearchParams(location.hash.slice(1)).get("key");
  let key = managed ? (fragmentKey || recall("wall_admin_" + roomId, "")) : "";
  if (fragmentKey && managed && remember("wall_admin_" + roomId, fragmentKey)) history.replaceState(null, "", location.pathname + location.search);
  let data = null, paused = false, stopped = false, inFlight = false;
  let queue = [], seen = new Set(), listSignature = "", audioUrl = "";
  let screenLang = params.get("lang") === "en" ? "en" : (recall("wedding_screen_lang", "zh") === "en" ? "en" : "zh");
  const winners = [];
  function getGuestUrl() {
    return demo
      ? location.origin + "/wedding-live-wall.html?from=demo" + (screenLang === "en" ? "&lang=en" : "")
      : location.origin + "/blessing.html?room=" + encodeURIComponent(roomId) + (screenLang === "en" ? "&lang=en" : "");
  }
  let guestUrl = getGuestUrl();
  $("guestLink").href = guestUrl;

  function updateScreenLabels() {
    guestUrl = getGuestUrl();
    $("guestLink").href = guestUrl;
    if ($("screenLang")) $("screenLang").textContent = screenLang === "en" ? "中文" : "English";
    if ($("fullscreen")) $("fullscreen").textContent = screenLang === "en" ? "Full Screen" : "全屏展示";
    if ($("lottery")) $("lottery").textContent = screenLang === "en" ? "Lucky Draw" : "抽奖";
    if ($("music")) $("music").textContent = screenLang === "en" ? "Music" : "音乐";
    if ($("tableCard")) $("tableCard").textContent = screenLang === "en" ? "Download QR Card" : "下载扫码桌牌";
    if ($("replay")) $("replay").textContent = screenLang === "en" ? "Replay Wishes" : "重播祝福";
    if ($("manage")) $("manage").textContent = screenLang === "en" ? "Host Controls" : "主持人管理";
    if ($("qrLabel")) $("qrLabel").textContent = screenLang === "en" ? "Scan to Send Wishes" : "扫码送上你的祝福";
    if ($("guestLink")) $("guestLink").textContent = screenLang === "en" ? "Open Mobile Page" : "打开手机页面";
    $("qrHint").textContent = demo
      ? (screenLang === "en" ? "Demo QR opens creation page" : "演示二维码打开创建页")
      : managed
      ? (screenLang === "en" ? "Wishes appear after host approval" : "主持人审核后上墙")
      : (screenLang === "en" ? "Legacy room: direct on-screen" : "旧版房间：祝福直接上墙");
    if (data) applyRoom();
    try {
      QRCode.toCanvas($("qr"), guestUrl, { width: 240, margin: 4, errorCorrectionLevel: "M" }).then(() => {
        $("qr").style.removeProperty("width"); $("qr").style.removeProperty("height");
      });
    } catch {}
  }

  if ($("screenLang")) {
    $("screenLang").onclick = () => {
      screenLang = screenLang === "en" ? "zh" : "en";
      remember("wedding_screen_lang", screenLang);
      updateScreenLabels();
    };
  }
  updateScreenLabels();

  function notice(text, error = false) { $("adminNotice").textContent = text; $("adminNotice").classList.toggle("error", error); }
  function status(text, error = false) { $("connection").textContent = text; $("connection").classList.toggle("error", error); }
  function approved() { return (data?.messages || []).filter(m => m.status === "approved" || !managed); }
  function applyRoom() {
    const room = data.room;
    $("couple").textContent = room.groom + " & " + room.bride;
    $("eventDetails").textContent = [room.date, room.venue].filter(Boolean).join(" · ");
    $("stage").dataset.theme = room.theme || "rose";
    paused = !!room.paused; $("stage").classList.toggle("paused", paused);
    $("pause").textContent = paused
      ? (screenLang === "en" ? "Resume Screen" : "恢复展示")
      : (screenLang === "en" ? "Pause Screen" : "暂停展示");
    $("modeTag").textContent = demo
      ? (screenLang === "en" ? "Local Demo" : "本地演示")
      : managed
      ? (room.mode === "event" ? (screenLang === "en" ? "Live Event" : "正式活动") : (screenLang === "en" ? "Rehearsal" : "彩排试用"))
      : (screenLang === "en" ? "Legacy Room" : "旧版房间");
    $("ribbon").textContent = demo
      ? (screenLang === "en" ? "Demo · Sample Wishes" : "演示 · 虚构昵称和祝福")
      : (screenLang === "en" ? "Live Wishes · wedding-tv.cn" : "祝福互动 · wedding-tv.cn");
    $("accepting").textContent = room.accepting
      ? (screenLang === "en" ? "Pause Accepting Wishes" : "暂停接收祝福")
      : (screenLang === "en" ? "Resume Accepting Wishes" : "恢复接收祝福");
    if (managed && key) {
      $("manage").hidden = false; $("pause").hidden = false;
      const s = data.stats;
      $("stats").textContent = screenLang === "en"
        ? `Submitted ${s.submitted} · Approved ${s.approved} · Active ${data.messages.length} · Remaining quota ${s.remaining}`
        : `提交 ${s.submitted} · 累计通过 ${s.approved} · 当前保留 ${data.messages.length} · 剩余可提交 ${s.remaining}`;
      $("expiry").textContent = screenLang === "en"
        ? `Room expires: ${new Date(room.expiresAt).toLocaleString("en-US")}. Messages are cleared after 24h.`
        : `房间到期：${new Date(room.expiresAt).toLocaleString("zh-CN")}。每条祝福发送后 24 小时清除，请及时导出。`;
      const records = recall("wedding_wall_trials_v1", []), record = records.find(r => r.id === roomId);
      if (record) { Object.assign(record, s, { syncedAt: Date.now() }); remember("wedding_wall_trials_v1", records); }
      renderManagement();
    }
    const valid = new Set(approved().map(m => m.id));
    queue = queue.filter(m => valid.has(m.id));
    for (const bubble of Array.from($("messages").children)) if (!valid.has(bubble.dataset.id)) bubble.remove();
    for (const item of approved()) if (!seen.has(item.id)) { seen.add(item.id); queue.push(item); }
    $("emptyMessage").hidden = approved().length > 0;
    $("emptyMessage").textContent = screenLang === "en"
      ? "Waiting for guest wishes · Moderated live"
      : "等待宾客送祝福 · 主持人审核后展示";
  }
  function spawn(item) {
    const gap = document.fullscreenElement ? 92 : 72;
    const tracks = Math.max(1, Math.floor($("messages").clientHeight / gap));
    const used = new Set(Array.from($("messages").children, el => Number(el.dataset.track)));
    const track = Array.from({ length: tracks }, (_, i) => i).find(i => !used.has(i));
    if (track === undefined) return false;
    const el = node("div", null, "bubble"); el.dataset.color = item.color; el.dataset.id = item.id;
    el.append(node("strong", item.name), node("span", item.message));
    el.dataset.track = track; el.style.top = track * gap + "px";
    el.addEventListener("animationend", () => el.remove()); $("messages").append(el);
    return true;
  }
  setInterval(() => {
    if (paused || stopped || document.hidden) return;
    if (!queue.length && demo) queue = approved().slice();
    if (queue.length && $("messages").children.length < 5 && spawn(queue[0])) queue.shift();
  }, 2400);
  function renderManagement() {
    const signature = JSON.stringify(data.messages); if (signature === listSignature) return;
    listSignature = signature; $("pending").replaceChildren(); $("approved").replaceChildren();
    for (const item of data.messages.slice().reverse()) {
      const row = node("article", null, "message"); row.dataset.id = item.id;
      row.append(node("div", item.name + (item.identity ? " · " + item.identity : ""), "message-meta"), node("p", item.message));
      const actions = node("div", null, "actions");
      if (item.status === "pending") { const b = node("button", "通过"); b.onclick = () => act("approve", { id: item.id }, b); actions.append(b); }
      const b = node("button", "删除"); b.onclick = () => act("delete", { id: item.id }, b); actions.append(b);
      row.append(actions); $(item.status === "pending" ? "pending" : "approved").append(row);
    }
    if (!$("pending").children.length) $("pending").append(node("p", "暂无待审核祝福", "muted"));
    if (!$("approved").children.length) $("approved").append(node("p", "暂无已通过祝福", "muted"));
  }
  async function poll() {
    if (demo || stopped || inFlight) return;
    inFlight = true;
    try {
      if (managed) data = await request(roomId, key ? "admin" : "public", null, key);
      else {
        const res = await fetch("/api/load?wall=" + encodeURIComponent(roomId), { cache: "no-store", signal: AbortSignal.timeout(12000) });
        const legacy = await res.json(); if (!res.ok || !legacy.ok) throw new Error("旧版房间连接失败");
        const cfg = recall("wedding_wall_cfg_" + roomId, {});
        data = { ...legacy, room: { groom: cfg.groom || "新人", bride: cfg.bride || "新人", venue: cfg.venue || "", date: cfg.date || "", theme: "rose" } };
      }
      applyRoom(); status("已连接 · " + new Date().toLocaleTimeString("zh-CN"));
    } catch (error) {
      if (error.status === 403 && key) { key = ""; $("manage").hidden = true; $("pause").hidden = true; $("adminDialog").close(); notice("管理权限无效，请重新打开正确管理链接", true); }
      if (error.status === 410) {
        stopped = true; data = null; queue = []; winners.length = 0;
        $("messages").replaceChildren(); $("pending").replaceChildren(); $("approved").replaceChildren();
        document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
        for (const id of ["manage", "pause", "lottery", "tableCard", "replay"]) $(id).disabled = true;
        $("guestLink").hidden = true; $("qr").hidden = true; $("qrLabel").textContent = "房间已结束";
        $("qrHint").textContent = "请返回创建页开启新房间";
        $("emptyMessage").hidden = false; $("emptyMessage").textContent = "房间已结束或过期";
      }
      status(error.status === 410 ? error.message : "连接异常，正在重试；新祝福可能尚未同步", true);
    } finally { inFlight = false; }
  }
  async function act(action, body = {}, button) {
    if (button) button.disabled = true;
    try { await request(roomId, action, body, key); await poll(); notice("操作已保存"); }
    catch (error) { notice(error.message, true); }
    finally { if (button) button.disabled = false; }
  }
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => $(b.dataset.close).close());
  $("manage").onclick = () => {
    for (const name of ["groom", "bride", "date", "venue", "theme"]) $("settingsForm").elements[name].value = data.room[name] || "";
    $("adminDialog").showModal();
  };
  $("settingsForm").onsubmit = async event => { event.preventDefault(); await act("settings", { settings: Object.fromEntries(new FormData($("settingsForm"))) }, $("settingsForm").querySelector("button")); };
  $("pause").onclick = () => act("settings", { paused: !data.room.paused }, $("pause"));
  $("accepting").onclick = () => act("settings", { accepting: !data.room.accepting }, $("accepting"));
  $("copyAdmin").onclick = () => copy(location.origin + "/live-wall.html?room=" + roomId + "#key=" + key).then(() => notice("管理链接已准备，请仅交给可信主持人"));
  $("copyScreen").onclick = () => copy(location.origin + "/live-wall.html?room=" + roomId).then(() => notice("观看链接已准备"));
  $("copyGuest").onclick = () => copy(guestUrl).then(() => notice("宾客链接已准备"));
  $("fullscreen").onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $("stage").requestFullscreen(); } catch { status("浏览器不支持全屏，请使用电脑浏览器或系统全屏模式", true); } };
  $("replay").onclick = () => { queue = approved().slice(); $("messages").replaceChildren(); };
  $("lottery").onclick = () => $("lotteryDialog").showModal();
  $("draw").onclick = () => {
    const pool = [...new Set(approved().map(m => m.name))].filter(name => !winners.includes(name));
    if (!pool.length) { $("winner").textContent = "暂无可抽取的昵称"; return; }
    const range = 0x100000000, limit = range - range % pool.length;
    let n; do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= limit);
    const winner = pool[n % pool.length]; winners.push(winner);
    $("winner").textContent = winner; $("winnerHistory").textContent = "本轮已抽取：" + winners.join("、");
  };
  $("music").onclick = () => $("musicDialog").showModal();
  $("musicFile").onchange = () => { const file = $("musicFile").files[0]; if (!file) return; if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(file); $("audio").src = audioUrl; };
  function csvValue(value) { let text = String(value ?? ""); if (/^\s*[=+\-@]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }
  $("exportCsv").onclick = () => {
    const rows = [["昵称", "身份或桌号", "祝福", "发送时间"], ...approved().map(m => [m.name, m.identity, m.message, new Date(m.ts).toISOString()])];
    download(new Blob(["\ufeff" + rows.map(r => r.map(csvValue).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), "当前已通过祝福.csv");
  };
  $("exportStats").onclick = () => {
    const report = { mode: data.room.mode, ...data.stats, retainedMessages: data.messages.length, capturedAt: new Date().toISOString(), note: "用途由创建者选择；提交数不是独立宾客数。仅当前房间，不含昵称、正文、链接或密钥。" };
    download(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "大屏使用记录.json");
  };
  $("exportImage").onclick = async () => {
    const items = approved().slice(-20); if (!items.length) { notice("请先审核通过至少一条祝福", true); return; }
    try { await card(data.room.groom + " & " + data.room.bride + " · 祝福纪念", items.map(m => ({ heading: m.name, text: m.message })), "wedding-tv.cn · 最近 " + items.length + " 条已通过祝福", "婚礼祝福纪念.png"); } catch (error) { notice(error.message, true); }
  };
  $("tableCard").onclick = async () => {
    if (!data) return;
    try {
      await document.fonts.ready;
      const canvas = node("canvas"); canvas.width = 1000; canvas.height = 1300;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1000, 1300);
      ctx.fillStyle = "#a32d4a"; ctx.font = 'bold 38px "Microsoft YaHei",sans-serif'; ctx.textAlign = "center";
      WallUI.wrap(ctx, data.room.groom + " & " + data.room.bride, 850).forEach((line, i) => ctx.fillText(line, 500, 120 + i * 50));
      const qrCanvas = node("canvas"); await QRCode.toCanvas(qrCanvas, guestUrl, { width: 650, margin: 4, errorCorrectionLevel: "M" }); ctx.drawImage(qrCanvas, 175, 280, 650, 650);
      ctx.fillStyle = "#26252b"; ctx.font = '36px "Microsoft YaHei",sans-serif';
      ctx.fillText(screenLang === "en" ? (demo ? "Demo Card · Scan to Experience" : "Scan to Send Wedding Wishes") : (demo ? "演示桌牌 · 扫码体验工具" : "扫码，留下你的婚礼祝福"), 500, 1040);
      ctx.font = '24px "Microsoft YaHei",sans-serif';
      ctx.fillText(screenLang === "en" ? "Displayed after host approval · No personal contact info" : "主持人审核后展示 · 请勿填写私人联系方式", 500, 1110);
      ctx.fillText("wedding-tv.cn", 500, 1220);
      await saveCanvas(canvas, screenLang === "en" ? "wedding_qr_table_card.png" : "婚礼扫码桌牌.png");
    } catch { status(screenLang === "en" ? "Failed to export card, please retry" : "桌牌导出失败，请重试", true); }
  };
  $("closeRoom").onclick = async () => {
    if (!confirm("立即删除房间、所有待审及已通过祝福？请先导出需要保留的内容。此操作不可恢复。")) return;
    try { await request(roomId, "close", {}, key); stopped = true; try { localStorage.removeItem("wall_admin_" + roomId); } catch {} location.replace("/wedding-live-wall.html"); }
    catch (error) { notice(error.message, true); }
  };
  async function backgroundStore(value, write = false) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("WeddingWallAssets", 1); open.onupgradeneeded = () => open.result.createObjectStore("images"); open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction("images", write ? "readwrite" : "readonly"), store = tx.objectStore("images");
        const req = write ? (value ? store.put(value, "bg_" + roomId) : store.delete("bg_" + roomId)) : store.get("bg_" + roomId);
        tx.oncomplete = () => { db.close(); resolve(req.result); }; tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }
  function setBackground(value) { $("backgroundImage").hidden = !value; if (value) $("backgroundImage").src = value; else $("backgroundImage").removeAttribute("src"); }
  $("customBackground").onchange = async () => {
    const file = $("customBackground").files[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { notice("请选择不超过 15 MB 的 JPG、PNG 或 WebP 图片", true); return; }
    try {
      const bitmap = await createImageBitmap(file), scale = Math.min(1, 1920 / bitmap.width);
      const canvas = node("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const image = canvas.toDataURL("image/jpeg", .85); setBackground(image); await backgroundStore(image, true); notice("背景已保存在这台设备，不会上传");
    } catch { notice("图片未能保存，请更换较小图片重试", true); }
  };
  $("removeBackground").onclick = async () => { setBackground(""); try { await backgroundStore(null, true); notice("本机背景已清除"); } catch { notice("本机存储不可用", true); } };
  if (demo) {
    const samples = [["同学小陈", "愿你们并肩走过每一个春夏秋冬"], ["朋友小周", "今天的笑容，往后的每一天都要有"], ["家人", "平安喜乐，携手同行"], ["同事小赵", "新婚快乐，日子常有小惊喜"]];
    data = { room: { groom: "小林", bride: "小夏", venue: "欢迎一起见证我们的婚礼", theme: "rose", accepting: true }, messages: samples.map(([name, message], i) => ({ id: "demo-" + i, name, message, color: i % 2 ? "rose" : "gold", status: "approved", ts: Date.now() })) };
    applyRoom(); spawn(queue.shift()); $("messages").firstElementChild.style.animationDelay = "-4s"; status("本地演示 · 不上传数据");
    $("pause").hidden = false; $("pause").onclick = () => { data.room.paused = !data.room.paused; applyRoom(); };
  } else { await poll(); setInterval(poll, 4000); try { setBackground(await backgroundStore()); } catch {} }
  try {
    await QRCode.toCanvas($("qr"), guestUrl, { width: 240, margin: 4, errorCorrectionLevel: "M" });
    $("qr").style.removeProperty("width"); $("qr").style.removeProperty("height");
  }
  catch { $("qr").hidden = true; status("二维码暂不可用，可复制宾客链接参与", true); }
  window.addEventListener("online", poll);
  window.addEventListener("offline", () => status("网络已断开，恢复后自动重连", true));
})();
