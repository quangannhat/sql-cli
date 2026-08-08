import { Layer } from "effect";
import { BunServices } from "@effect/platform-bun";
import { Atom } from "effect/unstable/reactivity";
import { AppConfig } from "@app/config";

export const appRuntime = Atom.runtime(
  Layer.provideMerge(AppConfig.layerFallback, BunServices.layer),
);
