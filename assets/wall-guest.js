(function () {
  const { $, node, request } = WallUI;
  const params = new URLSearchParams(location.search), roomId = params.get("room") || "";
  const managed = /^w_[a-f0-9]{24}$/.test(roomId);
  let sending = false, active = false, stopped = false, loading = false, lastPayload = "", retryId = "", signature = "";
  if (!roomId || roomId.length > 32 || (roomId.startsWith("w_") && !managed)) { $("roomNotice").textContent = "请扫描主持人提供的二维码；当前链接缺少有效房间号。"; return; }
  document.querySelectorAll("[data-message]").forEach(button => button.onclick = () => { $("guestMsg").value = button.dataset.message; });
  async function load() {
    if (loading || stopped) return; loading = true;
    try {
      let data;
      if (managed) data = await request(roomId, "public");
      else {
        const response = await fetch("/api/load?wall=" + encodeURIComponent(roomId), { cache: "no-store", signal: AbortSignal.timeout(12000) });
        data = await response.json(); if (!response.ok || !data.ok) throw new Error("房间连接失败");
        data.room = { groom: params.get("g") || "新人", bride: params.get("b") || "新人", accepting: true };
      }
      active = data.room.accepting;
      $("guestCouple").textContent = data.room.groom + " & " + data.room.bride;
      $("roomNotice").textContent = !active ? "主持人已暂停接收祝福" : managed ? "已连接 · 祝福审核通过后展示，每条保留 24 小时" : "旧版房间 · 祝福直接公开展示，最近 200 条保留至最后发送后 24 小时";
      $("submitGuest").disabled = sending || !active;
      $("feedCount").textContent = `当前 ${data.total} 条，显示最近 20 条`;
      const next = JSON.stringify(data.messages);
      if (next !== signature) {
        signature = next; $("feedList").replaceChildren();
        for (const message of data.messages.slice(-20).reverse()) {
          const row = node("article", null, "message");
          row.append(node("div", message.name, "message-meta"), node("p", message.message)); $("feedList").append(row);
        }
        if (!data.messages.length) $("feedList").append(node("p", "暂时没有已通过的祝福", "muted"));
      }
    } catch (error) {
      active = false; $("submitGuest").disabled = true;
      $("roomNotice").textContent = error.status === 410 ? error.message : "暂时无法连接，正在重试，请检查网络";
      if (error.status === 410) { stopped = true; $("feedList").replaceChildren(); $("feedCount").textContent = "房间已关闭"; }
    } finally { loading = false; }
  }
  $("guestForm").onsubmit = async event => {
    event.preventDefault(); if (sending || !active || !$("guestForm").reportValidity()) return;
    const payload = { name: $("guestName").value.trim(), identity: $("guestIdentity").value.trim(), message: $("guestMsg").value.trim(), color: $("guestColor").value };
    if (!payload.name || !payload.message) return;
    const encoded = JSON.stringify(payload);
    if (lastPayload !== encoded || !retryId) { retryId = crypto.randomUUID(); lastPayload = encoded; }
    sending = true; $("submitGuest").disabled = true; $("sendNotice").textContent = "正在发送…";
    try {
      if (managed) await request(roomId, "submit", { ...payload, id: retryId });
      else {
        const response = await fetch("/api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wall: { ...payload, room: roomId } }), signal: AbortSignal.timeout(12000) });
        const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "发送失败");
      }
      $("sendNotice").textContent = managed ? "已提交，等待主持人审核。通过后会出现在下方列表和现场大屏。" : "已提交至旧版祝福墙";
      $("sendNotice").classList.remove("error"); $("guestMsg").value = ""; retryId = ""; await load();
    } catch (error) { $("sendNotice").textContent = "未能确认发送结果：" + error.message + "。可重试相同内容，新版房间不会重复入库。"; $("sendNotice").classList.add("error"); }
    finally { sending = false; $("submitGuest").disabled = !active; }
  };
  load(); setInterval(load, 6000); window.addEventListener("online", load);
})();
