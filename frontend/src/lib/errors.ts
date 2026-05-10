export function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number | string; message?: string; cause?: { code?: number | string } };
  if (e.code === 4001 || e.code === "ACTION_REJECTED") return true;
  if (e.cause?.code === 4001 || e.cause?.code === "ACTION_REJECTED") return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("user rejected") || msg.includes("user denied");
}
