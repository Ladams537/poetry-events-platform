export type AppConfig = {
  databasePath: string;
  jwtSecret: string;
  frontendOrigin: string;
  nodeEnv: "development" | "test" | "production";
};

export function readConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as AppConfig["nodeEnv"];

  return {
    databasePath: overrides.databasePath ?? process.env.DATABASE_PATH ?? "./poetry-events.db",
    jwtSecret:
      overrides.jwtSecret ??
      process.env.JWT_SECRET ??
      "dev-secret-change-me-dev-secret-change-me",
    frontendOrigin: overrides.frontendOrigin ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    nodeEnv: overrides.nodeEnv ?? nodeEnv
  };
}
