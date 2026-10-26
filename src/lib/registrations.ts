// Display of association registration statuses (D-094).

export const REGISTRATION_STATUS = {
  PENDING: { tone: "info", label: "قيد المراجعة" },
  APPROVED: { tone: "ok", label: "معتمد" },
  REJECTED: { tone: "bad", label: "مرفوض" },
} as const;
