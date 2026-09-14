(function () {
  const { $, node, request, remember, recall, download } = WallUI;
  const recordKey = "wedding_wall_trials_v1";
  $("createForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!$("createForm").reportValidity()) return;
    $("createButton").disabled = true; $("createStatus").textContent = "正在创建房间…";
    try {
      const settings = Object.fromEntries(new FormData($("createForm")));
      const data = await request(null, "create", { settings, mode: settings.mode });
      remember("wall_admin_" + data.roomId, data.adminKey);
      const records = recall(recordKey, []).filter(r => r.expiresAt > Date.now());
      records.push({ id: data.roomId, mode: data.room.mode, createdAt: Date.now(), expiresAt: data.room.expiresAt });
      remember(recordKey, records.slice(-30));
      const isEn = location.pathname.startsWith('/en/') || document.documentElement.lang === 'en';
      const langParam = isEn ? '&lang=en' : '';
      location.assign("/live-wall.html?room=" + data.roomId + langParam + "#key=" + data.adminKey);
    } catch (error) { $("createStatus").textContent = error.message; $("createStatus").classList.add("error"); }
    finally { $("createButton").disabled = false; }
  });
  const records = recall(recordKey, []);
  if (records.length) {
    const isEn = location.pathname.startsWith('/en/') || document.documentElement.lang === 'en';
    const langParam = isEn ? '&lang=en' : '';
    $("recentSection").hidden = false;
    for (const record of records.slice().reverse()) {
      const row = node("li");
      row.append(node("span", (isEn ? (record.mode === "event" ? "Live Event" : "Rehearsal") : (record.mode === "event" ? "正式活动" : "彩排试用")) + " · " + new Date(record.createdAt).toLocaleString(isEn ? "en-US" : "zh-CN")));
      if (record.expiresAt > Date.now()) {
        const link = node("a", isEn ? "Open Room" : "打开房间"); link.href = "/live-wall.html?room=" + encodeURIComponent(record.id) + langParam; row.append(link);
      } else row.append(node("span", isEn ? "Expired" : "已过期", "muted"));
      $("recentRooms").append(row);
    }
  }
  $("exportTrials").onclick = () => {
    const rows = [["创建时间", "用途（自报）", "提交条数", "累计通过条数", "首次祝福时间", "最近同步时间"]];
    for (const r of recall(recordKey, [])) rows.push([new Date(r.createdAt).toISOString(), r.mode === "event" ? "正式活动" : "彩排试用", r.submitted ?? "未同步", r.approved ?? "未同步", r.firstMessageAt ? new Date(r.firstMessageAt).toISOString() : "", r.syncedAt ? new Date(r.syncedAt).toISOString() : ""]);
    const csv = rows.map(row => row.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(",")).join("\r\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "大屏本机试用汇总.csv");
  };
  $("clearTrials").onclick = () => { if (confirm("清除本机汇总记录？线上房间及管理权限不受影响。")) { remember(recordKey, []); $("recentSection").hidden = true; } };
})();
