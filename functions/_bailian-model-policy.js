import snapshot from "./config/bailian-free-models.json" with { type: "json" };

export const DEFAULT_BAILIAN_TEXT_MODEL = "qwen3.8-flash";
export const DEFAULT_BAILIAN_IMAGE_MODEL = "qwen-image-3.0";
export const BAILIAN_QUOTA_SNAPSHOT = snapshot;

const PUBLIC_BEIJING_HOST = "dashscope.aliyuncs.com";
const BEIJING_WORKSPACE_SUFFIX = ".cn-beijing.maas.aliyuncs.com";

const MODELS = new Map();
for (const group of snapshot.groups) {
  for (const code of group.models) {
    if (MODELS.has(code)) throw new Error(`百炼模型额度清单存在重复项：${code}`);
    MODELS.set(code, {
      code,
      category: group.category,
      capabilities: group.capabilities,
      quota: group.quota,
      freeStopEnabled: group.freeStopEnabled,
    });
  }
}

export function requireBailianModel(model, capability) {
  const code = String(model || "").trim();
  const record = MODELS.get(code);
  if (!record) throw new Error(`百炼模型未列入免费额度白名单：${code || "（空）"}`);
  if (!record.capabilities.includes(capability)) {
    throw new Error(`百炼模型 ${code} 不支持当前用途：${capability}`);
  }
  if (snapshot.policy.requirePositiveRecordedQuota && Number(record.quota.remaining) <= 0) {
    throw new Error(`百炼模型 ${code} 的已记录免费额度为 0`);
  }
  if (snapshot.policy.requireFreeStopEnabled && !record.freeStopEnabled) {
    throw new Error(`百炼模型 ${code} 未开启免费额度用完即停`);
  }
  return record;
}

export function listRecordedBailianModels() {
  return [...MODELS.values()];
}

export function requireBailianBeijingBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("百炼接口地址无效");
  }

  const hostname = url.hostname.toLowerCase();
  const isPublicBeijing = hostname === PUBLIC_BEIJING_HOST;
  const isBeijingWorkspace = hostname.endsWith(BEIJING_WORKSPACE_SUFFIX)
    && hostname !== `token-plan${BEIJING_WORKSPACE_SUFFIX}`;
  if (url.protocol !== "https:" || (!isPublicBeijing && !isBeijingWorkspace)) {
    throw new Error("百炼接口仅允许华北 2（北京）免费额度端点，禁止其他地域或 Token Plan 地址");
  }
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("百炼接口地址包含不允许的认证信息或端口");
  }
  return url;
}
