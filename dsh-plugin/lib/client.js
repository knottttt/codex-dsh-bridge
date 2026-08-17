window.__ModuleLoader__.load({
  id: "codex-dsh-bridge-companion",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const {
      createElement: h,
      useEffect,
      useState,
    } = React;

    const LOCALE_NAMESPACE = "settings.codex-dsh-bridge";
    const SETTINGS_ROUTE = "/plugins/codex-dsh-bridge-companion/settings";
    const DEFAULT_BASE_URL = "http://127.0.0.1:3080";
    const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

    const css = `
      .codexDshCard{list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}
      .codexDshCard:hover{border-color:var(--dsw-alias-label-dimmed)}
      .codexDshCardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
      .codexDshHeader{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}
      .codexDshHeader:focus-visible,.codexDshButton:focus-visible,.codexDshInput:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      .codexDshHeadText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
      .codexDshName{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
      .codexDshDescription{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
      .codexDshPending{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
      .codexDshChevron{flex:none;color:var(--dsw-alias-label-tertiary);font-size:16px;transition:transform .16s}
      .codexDshChevronOpen{transform:rotate(180deg)}
      .codexDshBody{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
      .codexDshField{display:flex;flex-direction:column;gap:6px;padding:12px 0}
      .codexDshField+.codexDshField{border-top:1px solid var(--dsw-alias-border-l2)}
      .codexDshFieldRow{display:flex;align-items:center;gap:10px}
      .codexDshLabel{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
      .codexDshSwitch{width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary)}
      .codexDshInput{box-sizing:border-box;width:100%;height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
      .codexDshInput:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
      .codexDshInvalid{border-color:var(--dsw-alias-label-error)}
      .codexDshHint,.codexDshReadOnly{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
      .codexDshError{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}
      .codexDshFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}
      .codexDshFooterMessage{flex:1;min-width:0}
      .codexDshButton{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:none;color:var(--dsw-alias-label-secondary)}
      .codexDshButtonPrimary{border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
      .codexDshButton:disabled,.codexDshInput:disabled,.codexDshSwitch:disabled{opacity:.4;cursor:default}
    `;

    if (
      typeof document !== "undefined"
      && document.querySelector('style[data-plugin-css="codex-dsh-bridge-companion"]') === null
    ) {
      const style = document.createElement("style");
      style.dataset.plugin = "codex-dsh-bridge-companion";
      style.dataset.pluginCss = "codex-dsh-bridge-companion";
      style.textContent = css;
      document.head.appendChild(style);
    }

    const en = {
      title: "Codex DSH Bridge",
      description: "Controls local Codex-to-Harness task delegation.",
      expand: "Show settings",
      collapse: "Hide settings",
      unsaved: "Unsaved",
      enabled: "Enable Codex bridge",
      enabledHint: "When disabled, Codex bridge tools reject requests before contacting Harness.",
      endpoint: "Harness endpoint",
      endpointHint: "Loopback HTTP origin only, with an explicit port. DSH_BASE_URL can override this address.",
      invalidUrl: "Use http://127.0.0.1:port, http://localhost:port, or http://[::1]:port.",
      sharedHint: "Saved values are mirrored to the shared bridge file and apply to the next Codex tool call.",
      readOnly: "This Harness deployment stores settings read-only.",
      save: "Save",
      saving: "Saving…",
      discard: "Discard",
      saveFailed: "Harness did not accept the values. Your draft has been kept.",
      conflict: "These settings changed elsewhere. The latest values were loaded; review and save again.",
      loading: "Loading bridge settings…",
      loadFailed: "Bridge settings could not be loaded.",
      retry: "Retry",
    };
    const zh = {
      title: "Codex DSH Bridge",
      description: "控制本机 Codex 向 Harness 派发任务的桥接。",
      expand: "展开设置",
      collapse: "收起设置",
      unsaved: "未保存",
      enabled: "启用 Codex 桥接",
      enabledHint: "关闭后，Codex 桥接工具会在连接 Harness 前直接拒绝请求。",
      endpoint: "Harness 地址",
      endpointHint: "只允许带明确端口的本机 HTTP 地址。DSH_BASE_URL 环境变量可覆盖这里的地址。",
      invalidUrl: "请使用 http://127.0.0.1:端口、http://localhost:端口 或 http://[::1]:端口。",
      sharedHint: "保存后会同步到共享桥接文件，并在 Codex 下一次工具调用时生效。",
      readOnly: "当前 Harness 部署的设置为只读。",
      save: "保存",
      saving: "保存中…",
      discard: "放弃修改",
      saveFailed: "Harness 没有接受这些值，草稿已保留。",
      conflict: "设置已在其他位置发生变化，现已载入最新值；请确认后重新保存。",
      loading: "正在读取桥接设置…",
      loadFailed: "无法读取桥接设置。",
      retry: "重试",
    };

    function normalizeLoopbackBaseUrl(rawValue) {
      let url;
      try {
        url = new URL(rawValue);
      } catch {
        return undefined;
      }
      if (url.protocol !== "http:") return undefined;
      if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return undefined;
      if (url.username || url.password || url.search || url.hash) return undefined;
      if (url.pathname !== "/" || !url.port) return undefined;
      return url.origin;
    }

    function BridgeCard({ t }) {
      const [snapshot, setSnapshot] = useState({
        status: "loading",
        value: { enabled: true, baseUrl: DEFAULT_BASE_URL },
        revision: 0,
        writable: false,
      });
      const [reloadToken, setReloadToken] = useState(0);
      const [open, setOpen] = useState(false);
      const [enabledDraft, setEnabledDraft] = useState(null);
      const [baseUrlDraft, setBaseUrlDraft] = useState(null);
      const [saving, setSaving] = useState(false);
      const [failed, setFailed] = useState(false);

      useEffect(() => {
        let cancelled = false;
        setSnapshot((current) => ({ ...current, status: "loading" }));
        void fetch(SETTINGS_ROUTE, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        })
          .then(async (response) => {
            const body = await response.json();
            if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
            if (!cancelled) {
              setSnapshot({
                status: "ready",
                value: {
                  enabled: body.enabled !== false,
                  baseUrl: body.baseUrl ?? DEFAULT_BASE_URL,
                },
                revision: body.revision,
                writable: body.writable === true,
              });
              setFailed(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setSnapshot((current) => ({ ...current, status: "error" }));
            }
          });
        return () => {
          cancelled = true;
        };
      }, [reloadToken]);

      const savedEnabled = snapshot.value.enabled !== false;
      const savedBaseUrl = snapshot.value.baseUrl ?? DEFAULT_BASE_URL;
      useEffect(() => {
        if (enabledDraft !== null && enabledDraft === savedEnabled) setEnabledDraft(null);
        if (baseUrlDraft !== null && baseUrlDraft === savedBaseUrl) setBaseUrlDraft(null);
      }, [enabledDraft, baseUrlDraft, savedEnabled, savedBaseUrl]);

      const enabled = enabledDraft ?? savedEnabled;
      const baseUrl = baseUrlDraft ?? savedBaseUrl;
      const normalizedBaseUrl = normalizeLoopbackBaseUrl(baseUrl.trim());
      const ready = snapshot.status === "ready";
      const dirty = ready && (enabled !== savedEnabled || baseUrl !== savedBaseUrl);
      const invalid = normalizedBaseUrl === undefined;
      const disabled = !ready || !snapshot.writable || saving;

      const discard = () => {
        setEnabledDraft(null);
        setBaseUrlDraft(null);
        setFailed(false);
      };

      const save = async () => {
        if (!dirty || invalid || disabled) return;
        const targetEnabled = enabled;
        const targetBaseUrl = normalizedBaseUrl;
        setSaving(true);
        setFailed(false);
        try {
          const response = await fetch(SETTINGS_ROUTE, {
            method: "PUT",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              enabled: targetEnabled,
              baseUrl: targetBaseUrl,
              revision: snapshot.revision,
            }),
          });
          const body = await response.json();
          if (response.status === 409 && body.current) {
            setSnapshot({
              status: "ready",
              value: {
                enabled: body.current.enabled !== false,
                baseUrl: body.current.baseUrl ?? DEFAULT_BASE_URL,
              },
              revision: body.current.revision,
              writable: body.current.writable === true,
            });
            setFailed("conflict");
            return;
          }
          if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
          setSnapshot({
            status: "ready",
            value: {
              enabled: body.enabled !== false,
              baseUrl: body.baseUrl ?? DEFAULT_BASE_URL,
            },
            revision: body.revision,
            writable: body.writable === true,
          });
          setEnabledDraft(null);
          setBaseUrlDraft(null);
        } catch {
          setFailed("saveFailed");
        } finally {
          setSaving(false);
        }
      };

      return h(
        "li",
        { className: `codexDshCard${open ? " codexDshCardOpen" : ""}` },
        h(
          "button",
          {
            type: "button",
            className: "codexDshHeader",
            "aria-expanded": open,
            "aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
            onClick: () => setOpen(!open),
          },
          h(
            "span",
            { className: "codexDshHeadText" },
            h("span", { className: "codexDshName" }, t("title")),
            h("span", { className: "codexDshDescription" }, t("description")),
          ),
          dirty ? h("span", { className: "codexDshPending" }, t("unsaved")) : null,
          h("span", {
            className: `codexDshChevron${open ? " codexDshChevronOpen" : ""}`,
            "aria-hidden": true,
          }, "⌄"),
        ),
        open
          ? h(
              "div",
              { className: "codexDshBody" },
              snapshot.status === "loading"
                ? h("p", { className: "codexDshHint", role: "status" }, t("loading"))
                : null,
              snapshot.status === "error"
                ? h("p", { className: "codexDshError", role: "status" }, t("loadFailed"))
                : null,
              ready && !snapshot.writable
                ? h("p", { className: "codexDshReadOnly", role: "status" }, t("readOnly"))
                : null,
              h(
                "div",
                { className: "codexDshField" },
                h(
                  "div",
                  { className: "codexDshFieldRow" },
                  h("label", { className: "codexDshLabel", htmlFor: "codex-dsh-enabled" }, t("enabled")),
                  h("input", {
                    id: "codex-dsh-enabled",
                    className: "codexDshSwitch",
                    type: "checkbox",
                    checked: enabled,
                    disabled,
                    onChange: (event) => {
                      setEnabledDraft(event.target.checked);
                      setFailed(false);
                    },
                  }),
                ),
                h("p", { className: "codexDshHint" }, t("enabledHint")),
              ),
              h(
                "div",
                { className: "codexDshField" },
                h("label", { className: "codexDshLabel", htmlFor: "codex-dsh-endpoint" }, t("endpoint")),
                h("input", {
                  id: "codex-dsh-endpoint",
                  className: `codexDshInput${invalid ? " codexDshInvalid" : ""}`,
                  type: "text",
                  value: baseUrl,
                  disabled,
                  "aria-invalid": invalid || undefined,
                  onChange: (event) => {
                    setBaseUrlDraft(event.target.value);
                    setFailed(false);
                  },
                }),
                invalid
                  ? h("p", { className: "codexDshError", role: "status" }, t("invalidUrl"))
                  : h("p", { className: "codexDshHint" }, t("endpointHint")),
                h("p", { className: "codexDshHint" }, t("sharedHint")),
              ),
              h(
                "div",
                { className: "codexDshFooter" },
                h(
                  "div",
                  { className: "codexDshFooterMessage" },
                  failed ? h("p", { className: "codexDshError", role: "status" }, t(failed)) : null,
                ),
                snapshot.status === "error"
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "codexDshButton",
                        onClick: () => setReloadToken((value) => value + 1),
                      },
                      t("retry"),
                    )
                  : null,
                h(
                  "button",
                  {
                    type: "button",
                    className: "codexDshButton",
                    disabled: !dirty || saving,
                    onClick: discard,
                  },
                  t("discard"),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "codexDshButton codexDshButtonPrimary",
                    disabled: !dirty || invalid || disabled,
                    onClick: () => { void save(); },
                  },
                  t(saving ? "saving" : "save"),
                ),
              ),
            )
          : null,
      );
    }

    const inject = ["slots", "locale"];

    function apply(ctx) {
      const t = ctx.locale.bind(LOCALE_NAMESPACE);
      ctx.effect(
        () => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }),
        "codex-dsh-bridge: settings dictionaries",
      );
      ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
        name: "settings.plugin.item",
        id: "codex-dsh-bridge",
        order: 100,
        locale: LOCALE_NAMESPACE,
      }, () => h(BridgeCard, { t })));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
