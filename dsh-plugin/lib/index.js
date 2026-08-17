import z from "@deepseek-ai/schemastery";
import {
  DEFAULT_BASE_URL,
  normalizeBridgeConfig,
  resolveBridgeConfigPath,
  writeBridgeConfigAtomic,
} from "./config.js";
import {
  createSettingsRouteHandler,
  SETTINGS_ROUTE_PATH,
} from "./settings-route.js";

export const SETTINGS_NAMESPACE = "codex-dsh-bridge";
export const BridgeSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  baseUrl: z.string().default(DEFAULT_BASE_URL),
});

function reportWriteFailure(ctx, configPath, error) {
  ctx.logger.warn(`codex-dsh-bridge: failed to write shared config at ${configPath}`);
  ctx.logger.warn(error);
}

export function apply(ctx) {
  ctx.inject(["settings", "webServer"], (settingsCtx) => {
    const configPath = resolveBridgeConfigPath();
    const scope = settingsCtx.settings.register(
      SETTINGS_NAMESPACE,
      BridgeSettingsSchema,
      {
        applies: "live",
        validate: normalizeBridgeConfig,
      },
    );

    let writeTail = Promise.resolve();
    const persist = (value) => {
      writeTail = writeTail
        .then(() => writeBridgeConfigAtomic(value, { configPath }))
        .catch((error) => {
          reportWriteFailure(settingsCtx, configPath, error);
        });
      return writeTail;
    };

    void persist(scope.get());
    settingsCtx.effect(
      () => scope.watch((next) => persist(next)),
      "codex-dsh-bridge: mirror Harness settings to shared config",
    );
    settingsCtx.effect(
      () => settingsCtx.webServer.register({
        kind: "exact",
        path: SETTINGS_ROUTE_PATH,
        handler: createSettingsRouteHandler(settingsCtx.settings),
      }),
      "codex-dsh-bridge: settings HTTP route",
    );
  });
}
