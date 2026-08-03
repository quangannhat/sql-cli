import { Config, Context, Effect, Layer, Schema } from "effect";
import { Path, FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Atom } from "@effect-atom/atom-react";

export const DB_TYPES = ["Sqlite", "MySql", "Postgres"] as const;

export const Connection = Schema.Struct({
  name: Schema.String,
  connection: Schema.String,
  type: Schema.Literal(...DB_TYPES),
});
type Connection = typeof Connection.Type;

const AppConfigSchema = Schema.Struct({
  connections: Schema.Array(Connection),
});
export type AppConfigType = typeof AppConfigSchema.Type;

const decodeConfig = Schema.decode(Schema.parseJson(AppConfigSchema));

const DEFAULT_CONFIG: typeof AppConfigSchema.Type = {
  connections: [],
};

export class AppConfig extends Context.Tag("@app/AppConfig")<
  AppConfig,
  typeof AppConfigSchema.Type
>() {
  public static readonly Default = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const configPath = yield* ensureConfig;
      const config = yield* parseConfig(configPath);
      return config;
    }).pipe(
      Effect.catchTags({
        ConfigError: (error) =>
          Effect.logError(`Could not resolve the config path: ${error.message}`).pipe(
            Effect.as(DEFAULT_CONFIG),
          ),
        BadArgument: (error) =>
          Effect.logError(
            `Invalid argument in ${error.module}.${error.method}: ${error.message}`,
          ).pipe(Effect.as(DEFAULT_CONFIG)),
        SystemError: (error) =>
          Effect.logError(
            `Could not access ${error.pathOrDescriptor} (${error.reason}): ${error.message}`,
          ).pipe(Effect.as(DEFAULT_CONFIG)),
        ParseError: (error) =>
          Effect.logError(`Invalid config file: ${error.message}`).pipe(Effect.as(DEFAULT_CONFIG)),
      }),
    ),
  );
}

export const configAtom = Atom.make(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return config;
  }).pipe(Effect.provide(AppConfig.Default), Effect.provide(BunContext.layer)),
);

const ensureConfig = Effect.gen(function* () {
  const homeDir = yield* Config.string("HOME");
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;

  const configDir = path.join(homeDir, ".config", "sql-cli");
  const configPath = path.join(configDir, "config.json");
  yield* fs.makeDirectory(configDir, { recursive: true });
  const fileExists = yield* fs.exists(configPath);
  if (!fileExists) {
    yield* fs.writeFileString(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  return configPath;
});

const parseConfig = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs.readFileString(path);
    const parsed = yield* decodeConfig(content);
    return parsed;
  });
