import { Config, Context, Effect, Layer, Schema } from "effect";
import { Path, FileSystem } from "@effect/platform";
import { homedir } from "node:os";

export const DB_TYPES = ["Sqlite", "MySql", "Postgres"] as const;

export const Connection = Schema.Struct({
  name: Schema.String,
  connection: Schema.String,
  type: Schema.Literal(...DB_TYPES),
});
export type Connection = typeof Connection.Type;

const AppConfigSchema = Schema.Struct({
  connections: Schema.Array(Connection),
});
export type AppConfigType = typeof AppConfigSchema.Type;

const decodeConfig = Schema.decode(Schema.parseJson(AppConfigSchema));

const DEFAULT_CONFIG: AppConfigType = {
  connections: [],
};

export class ConfigLoadError extends Schema.TaggedError<ConfigLoadError>()("ConfigLoadError", {
  message: Schema.String,
}) {}

const resolvePaths = Effect.fn("resolvePaths")(function* () {
  const home = yield* Config.string("HOME").pipe(Config.withDefault(homedir()));
  const path = yield* Path.Path;

  const directory = path.join(home, ".config", "sql-cli");
  return { directory, file: path.join(directory, "config.json") };
});

const readOrInitialize = Effect.fn("readOrInitialize")(function* (directory: string, file: string) {
  const fs = yield* FileSystem.FileSystem;

  return yield* fs.readFileString(file).pipe(
    Effect.catchIf(
      (error) => error._tag === "SystemError" && error.reason === "NotFound",
      () =>
        Effect.gen(function* () {
          const contents = JSON.stringify(DEFAULT_CONFIG, null, 2);
          yield* fs.makeDirectory(directory, { recursive: true });
          yield* fs.writeFileString(file, contents);
          return contents;
        }),
    ),
  );
});

export const loadConfig = Effect.fn("loadConfig")(function* () {
  const { directory, file } = yield* resolvePaths();
  const contents = yield* readOrInitialize(directory, file);
  return yield* decodeConfig(contents);
});

const loadConfigOrFail = loadConfig().pipe(
  Effect.catchTags({
    ConfigError: (error) =>
      new ConfigLoadError({ message: `Could not resolve the config path: ${error.message}` }),
    BadArgument: (error) =>
      new ConfigLoadError({
        message: `Invalid argument in ${error.module}.${error.method}: ${error.message}`,
      }),
    SystemError: (error) =>
      new ConfigLoadError({
        message: `Could not access ${error.pathOrDescriptor} (${error.reason}): ${error.message}`,
      }),
    ParseError: (error) =>
      new ConfigLoadError({ message: `Invalid config file: ${error.message}` }),
  }),
);

export class AppConfig extends Context.Tag("@app/AppConfig")<AppConfig, AppConfigType>() {
  public static readonly layer = Layer.effect(AppConfig, loadConfigOrFail);

  public static readonly Default = Layer.effect(
    AppConfig,
    loadConfigOrFail.pipe(
      Effect.catchTag("ConfigLoadError", (error) =>
        Effect.logError(error.message).pipe(Effect.as(DEFAULT_CONFIG)),
      ),
    ),
  );
}
