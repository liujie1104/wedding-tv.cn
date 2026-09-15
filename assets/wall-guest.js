(function () {
  const { $, node, request } = WallUI;
  const params = new URLSearchParams(location.search), roomId = params.get("room") || "";
  const managed = /^w_[a-f0-9]{24}$/.test(roomId);
  let sending = false, active = false, stopped = false, loading = false, lastPayload = "", retryId = "", signature = "";

  const I18N = {
    zh: {
      tag: "婚礼现场祝福",
      defaultCouple: "欢迎送上你的祝福",
      roomNoticeInvalid: "请扫描主持人提供的二维码；当前链接缺少有效房间号。",
      roomNoticePaused: "主持人已暂停接收祝福",
      roomNoticeManaged: "已连接 · 祝福审核通过后展示，每条保留 24 小时",
      roomNoticeLegacy: "旧版房间 · 祝福直接公开展示，最近 200 条保留至最后发送后 24 小时",
      roomClosed: "房间已关闭",
      connError: "暂时无法连接，正在重试，请检查网络",
      feedCount: (n) => `当前 ${n} 条，显示最近 20 条`,
      feedEmpty: "暂时没有已通过的祝福",
      nameLabel: "你的昵称",
      namePl: "无需填写真实姓名",
      identLabel: "身份或桌号（选填）",
      identPl: "例如：同学 · 6号桌",
      msgLabel: "婚礼祝福",
      msgPl: "写下对新人的祝福",
      quick1Btn: "平安喜乐，携手同行",
      quick1Msg: "新婚快乐，愿你们平安喜乐，携手同行！",
      quick2Btn: "并肩走过四季",
      quick2Msg: "愿你们并肩走过每一个春夏秋冬。",
      colorLabel: "文字配色",
      consent: "我同意将昵称和留言提交给主持人，审核通过后向房间参与者展示。请勿填写联系方式或他人私人信息。",
      privacy: "隐私说明",
      submitBtn: "发送祝福",
      sending: "正在发送…",
      submittedManaged: "已提交，等待主持人审核。通过后会出现在下方列表和现场大屏。",
      submittedLegacy: "已提交至旧版祝福墙",
      sendFail: "未能确认发送结果：",
      sendRetryHint: "。可重试相同内容，新版房间不会重复入库。",
      approvedTitle: "已通过的祝福",
      createTitle: "你也在筹备婚礼？",
      createDesc: "为自己的婚礼创建独立祝福大屏，或下载一张当天流程表。",
      createWall: "创建我的婚礼大屏",
      createTimeline: "制作流程表",
      langToggle: "English",
    },
    en: {
      tag: "Wedding Live Wishes",
      defaultCouple: "Send Your Best Wishes",
      roomNoticeInvalid: "Please scan the QR code provided by the host; invalid room link.",
      roomNoticePaused: "The host has paused accepting new wishes",
      roomNoticeManaged: "Connected · Wishes appear after host approval, kept for 24h",
      roomNoticeLegacy: "Legacy room · Wishes are displayed publicly, kept for 24h",
      roomClosed: "Room is closed",
      connError: "Unable to connect, retrying. Please check your network.",
      feedCount: (n) => `Total: ${n}, showing latest 20`,
      feedEmpty: "No approved wishes yet.",
      nameLabel: "Your Name / Nickname",
      namePl: "Real name not required (e.g., Alex)",
      identLabel: "Relation / Table No. (Optional)",
      identPl: "e.g., College Friend · Table 6",
      msgLabel: "Wedding Wish",
      msgPl: "Write your heartfelt wishes to the newlyweds...",
      quick1Btn: "Wishing you lifetime joy",
      quick1Msg: "Congratulations! Wishing you a lifetime of love, joy, and happiness!",
      quick2Btn: "Best wishes on your journey",
      quick2Msg: "May your journey together be full of love, laughter, and wonder.",
      colorLabel: "Text Color",
      consent: "I agree to submit my nickname and wish for host moderation and on-screen display. Please do not submit private contact info.",
      privacy: "Privacy Policy",
      submitBtn: "Send Wishes",
      sending: "Sending…",
      submittedManaged: "Submitted! Awaiting host moderation. Once approved, it will appear on the big screen.",
      submittedLegacy: "Submitted to legacy wall",
      sendFail: "Could not confirm submission: ",
      sendRetryHint: ". You can retry; approved rooms will not duplicate messages.",
      approvedTitle: "Approved Wishes",
      createTitle: "Planning your own wedding?",
      createDesc: "Create a free live screen room or design your wedding day timeline.",
      createWall: "Create Live Screen",
      createTimeline: "Build Timeline",
      langToggle: "中文",
    },
  };

  let lang = params.get("lang") === "en" ? "en" : (localStorage.getItem("wall_guest_lang") === "en" ? "en" : "zh");

  function applyLanguage() {
    const t = I18N[lang];
    if ($("guestTag")) $("guestTag").textContent = t.tag;
    if ($("langToggle")) $("langToggle").textContent = t.langToggle;
    if ($("lblGuestName")) $("lblGuestName").textContent = t.nameLabel;
    if ($("guestName")) $("guestName").placeholder = t.namePl;
    if ($("lblGuestIdentity")) $("lblGuestIdentity").textContent = t.identLabel;
    if ($("guestIdentity")) $("guestIdentity").placeholder = t.identPl;
    if ($("lblGuestMsg")) $("lblGuestMsg").textContent = t.msgLabel;
    if ($("guestMsg")) $("guestMsg").placeholder = t.msgPl;
    if ($("quickBtn1")) { $("quickBtn1").textContent = t.quick1Btn; $("quickBtn1").dataset.message = t.quick1Msg; }
    if ($("quickBtn2")) { $("quickBtn2").textContent = t.quick2Btn; $("quickBtn2").dataset.message = t.quick2Msg; }
    if ($("lblGuestColor")) $("lblGuestColor").textContent = t.colorLabel;
    const colorSelect = $("guestColor");
    if (colorSelect && colorSelect.options) {
      const colorLabels = lang === "en"
        ? { rose: "Rose", gold: "Gold", red: "Red", purple: "Purple" }
        : { rose: "玫瑰", gold: "金色", red: "红色", purple: "紫色" };
      for (let i = 0; i < colorSelect.options.length; i++) {
        const opt = colorSelect.options[i];
        if (colorLabels[opt.value]) opt.textContent = colorLabels[opt.value];
      }
    }
    if ($("lblConsentText")) {
      $("lblConsentText").childNodes[0].nodeValue = t.consent;
      if ($("privacyLink")) {
        $("privacyLink").textContent = t.privacy;
        $("privacyLink").href = lang === "en" ? "/en/privacy.html" : "/privacy.html";
      }
    }
    if ($("submitGuest") && !sending) $("submitGuest").textContent = t.submitBtn;
    if ($("lblApprovedTitle")) $("lblApprovedTitle").textContent = t.approvedTitle;
    if ($("lblCreateTitle")) $("lblCreateTitle").textContent = t.createTitle;
    if ($("lblCreateDesc")) $("lblCreateDesc").textContent = t.createDesc;
    if ($("btnCreateWall")) {
      $("btnCreateWall").textContent = t.createWall;
      $("btnCreateWall").href = lang === "en" ? "/en/wedding-live-wall.html?from=guest" : "/wedding-live-wall.html?from=guest";
    }
    if ($("btnCreateTimeline")) {
      $("btnCreateTimeline").textContent = t.createTimeline;
      $("btnCreateTimeline").href = lang === "en" ? "/en/timeline.html" : "/timeline.html";
    }
    if ($("footerPrivacy")) {
      $("footerPrivacy").textContent = t.privacy;
      $("footerPrivacy").href = lang === "en" ? "/en/privacy.html" : "/privacy.html";
    }
    if ($("footerBrand")) {
      $("footerBrand").href = lang === "en" ? "/en/" : "/";
    }
  }

  if ($("langToggle")) {
    $("langToggle").onclick = () => {
      lang = lang === "en" ? "zh" : "en";
      localStorage.setItem("wall_guest_lang", lang);
      applyLanguage();
      load();
    };
  }
  applyLanguage();

  if (!roomId || roomId.length > 32 || (roomId.startsWith("w_") && !managed)) {
    $("roomNotice").textContent = I18N[lang].roomNoticeInvalid;
    return;
  }
  document.querySelectorAll("[data-message]").forEach(button => button.onclick = () => { $("guestMsg").value = button.dataset.message; });

  async function load() {
    if (loading || stopped) return; loading = true;
    const t = I18N[lang];
    try {
      let data;
      if (managed) data = await request(roomId, "public");
      else {
        const response = await fetch("/api/load?wall=" + encodeURIComponent(roomId), { cache: "no-store", signal: AbortSignal.timeout(12000) });
        data = await response.json(); if (!response.ok || !data.ok) throw new Error("房间连接失败");
        data.room = { groom: params.get("g") || "新人", bride: params.get("b") || "新人", accepting: true };
      }
      active = data.room.accepting;
      $("guestCouple").textContent = (data.room.groom || "Partner") + " & " + (data.room.bride || "Partner");
      $("roomNotice").textContent = !active ? t.roomNoticePaused : managed ? t.roomNoticeManaged : t.roomNoticeLegacy;
      $("submitGuest").disabled = sending || !active;
      $("feedCount").textContent = t.feedCount(data.total);
      const next = JSON.stringify(data.messages);
      if (next !== signature) {
        signature = next; $("feedList").replaceChildren();
        for (const message of data.messages.slice(-20).reverse()) {
          const row = node("article", null, "message");
          row.append(node("div", message.name, "message-meta"), node("p", message.message)); $("feedList").append(row);
        }
        if (!data.messages.length) $("feedList").append(node("p", t.feedEmpty, "muted"));
      }
    } catch (error) {
      active = false; $("submitGuest").disabled = true;
      $("roomNotice").textContent = error.status === 410 ? error.message : t.connError;
      if (error.status === 410) { stopped = true; $("feedList").replaceChildren(); $("feedCount").textContent = t.roomClosed; }
    } finally { loading = false; }
  }

  $("guestForm").onsubmit = async event => {
    event.preventDefault(); if (sending || !active || !$("guestForm").reportValidity()) return;
    const t = I18N[lang];
    const payload = { name: $("guestName").value.trim(), identity: $("guestIdentity").value.trim(), message: $("guestMsg").value.trim(), color: $("guestColor").value };
    if (!payload.name || !payload.message) return;
    const encoded = JSON.stringify(payload);
    if (lastPayload !== encoded || !retryId) { retryId = crypto.randomUUID(); lastPayload = encoded; }
    sending = true; $("submitGuest").disabled = true; $("sendNotice").textContent = t.sending;
    try {
      if (managed) await request(roomId, "submit", { ...payload, id: retryId });
      else {
        const response = await fetch("/api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wall: { ...payload, room: roomId } }), signal: AbortSignal.timeout(12000) });
        const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "发送失败");
      }
      $("sendNotice").textContent = managed ? t.submittedManaged : t.submittedLegacy;
      $("sendNotice").classList.remove("error"); $("guestMsg").value = ""; retryId = ""; await load();
    } catch (error) {
      $("sendNotice").textContent = t.sendFail + error.message + t.sendRetryHint;
      $("sendNotice").classList.add("error");
    }
    finally { sending = false; $("submitGuest").disabled = !active; }
  };
  load(); setInterval(load, 6000); window.addEventListener("online", load);
})();
