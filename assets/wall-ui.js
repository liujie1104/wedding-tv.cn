(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  async function request(room, action, body, key) {
    const url = new URL("/api/wall", location.origin);
    if (room) url.searchParams.set("room", room);
    if (action === "admin") url.searchParams.set("view", "admin");
    const options = { cache: "no-store", headers: {}, signal: AbortSignal.timeout(12000) };
    if (key) options.headers.authorization = "Bearer " + key;
    if (!["public", "admin"].includes(action)) {
      options.method = "POST";
      options.headers["content-type"] = "application/json";
      options.body = JSON.stringify({ ...body, action });
    }
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || "连接失败，请重试");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function remember(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function recall(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = node("a"); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function saveCanvas(canvas, name) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("图片导出失败，请重试");
    // Explicit preview also works in mobile browsers that ignore the download attribute.
    const modal = node("dialog"); modal.className = "image-export";
    const label = node("p", "图片已生成，可下载；手机也可长按图片保存。");
    const image = node("img"); image.alt = name; image.src = URL.createObjectURL(blob);
    const save = node("button", "下载 PNG"); save.onclick = () => download(blob, name);
    const close = node("button", "关闭"); close.onclick = () => modal.close();
    modal.append(label, save, close, image); document.body.append(modal);
    modal.addEventListener("close", () => { URL.revokeObjectURL(image.src); modal.remove(); });
    modal.showModal();
    return blob;
  }
  function wrap(ctx, text, width) {
    const lines = []; let current = "";
    for (const ch of String(text)) {
      if (ch === "\n" || (current && ctx.measureText(current + ch).width > width)) {
        lines.push(current); current = ch === "\n" ? "" : ch;
      } else current += ch;
    }
    lines.push(current); return lines;
  }
  async function card(title, rows, footer, name) {
    await document.fonts.ready;
    const canvas = node("canvas"); canvas.width = 1000;
    let ctx = canvas.getContext("2d");
    ctx.font = '28px "Microsoft YaHei", sans-serif';
    const titleLines = wrap(ctx, title, 880);
    const blocks = rows.map(row => ({ heading: wrap(ctx, row.heading, 880), lines: wrap(ctx, row.text || "", 880) }));
    canvas.height = 190 + titleLines.length * 40 + blocks.reduce((sum, b) => sum + 42 * b.heading.length + 38 * b.lines.length + 38, 0);
    ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1000, canvas.height);
    let y = 70;
    ctx.fillStyle = "#a32d4a"; ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
    for (const line of titleLines) { ctx.fillText(line, 60, y); y += 40; }
    y += 35;
    for (const b of blocks) {
      ctx.fillStyle = "#252329"; ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
      for (const line of b.heading) { ctx.fillText(line, 60, y); y += 42; }
      ctx.fillStyle = "#5d5b62"; ctx.font = '28px "Microsoft YaHei", sans-serif';
      for (const line of b.lines) { ctx.fillText(line, 60, y); y += 38; }
      y += 20; ctx.strokeStyle = "#e8e4e6"; ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(940, y); ctx.stroke(); y += 18;
    }
    ctx.fillStyle = "#5d5b62"; ctx.font = '20px "Microsoft YaHei", sans-serif';
    ctx.fillText(footer, 60, canvas.height - 35);
    return saveCanvas(canvas, name);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return; } catch {}
    const dialog = node("dialog"); dialog.className = "copy-dialog";
    const field = node("textarea"); field.value = text; field.readOnly = true;
    const close = node("button", "关闭"); close.onclick = () => dialog.close();
    dialog.append(node("p", "浏览器未允许自动复制，请选中下方内容复制。"), field, close);
    document.body.append(dialog); dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal(); field.select();
  }
  window.WallUI = { $, node, request, remember, recall, download, saveCanvas, wrap, card, copy };
})();
