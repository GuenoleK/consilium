import { useState } from "react";
import type { AuthorizationRequest } from "@consilium/core";
import { useTranslation } from "../../../../i18n";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./AuthorizationBubble.scss";

export function AuthorizationBubble({ requests, onResolve }: {
  requests: AuthorizationRequest[];
  onResolve: (authorizationId: string, decision: "approved" | "rejected") => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resolvingId, setResolvingId] = useState<string>();
  const pendingRequests = requests.filter((request) => request.status === "pending");
  if (!pendingRequests.length) return null;

  const resolve = async (authorizationId: string, decision: "approved" | "rejected") => {
    setResolvingId(authorizationId);
    try { await onResolve(authorizationId, decision); } finally { setResolvingId(undefined); }
  };

  return <section className="authorization-bubble" aria-label={t("authorizationBubble.label")} aria-live="polite">
    {pendingRequests.map((request) => {
      const isFileAttachment = request.kind === "file_attachment";
      const resolving = resolvingId === request.id;
      return <article className="authorization-bubble__request" key={request.id}>
        <span className="authorization-bubble__icon"><Icon name={isFileAttachment ? "attach_file" : "info"} filled /></span>
        <div className="authorization-bubble__content">
          <p><strong>{t("authorizationBubble.title")}</strong><span>{isFileAttachment ? t("authorizationBubble.kind.fileAttachment") : t("authorizationBubble.kind.action")}</span></p>
          <h2>{t("authorizationBubble.request", { name: request.requestedByName, action: request.action })}</h2>
          <p className="authorization-bubble__details">{request.details}</p>
        </div>
        <div className="authorization-bubble__actions">
          <button type="button" className="authorization-bubble__reject" disabled={Boolean(resolvingId)} onClick={() => void resolve(request.id, "rejected")}>{t("authorizationBubble.reject")}</button>
          <button type="button" className="authorization-bubble__approve" disabled={Boolean(resolvingId)} onClick={() => void resolve(request.id, "approved")}>
            <Icon name={resolving ? "progress_activity" : "check"} />{resolving ? "…" : t("authorizationBubble.approve")}
          </button>
        </div>
      </article>;
    })}
  </section>;
}
