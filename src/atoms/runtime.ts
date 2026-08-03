import { Layer } from "effect";
import { BunContext } from "@effect/platform-bun";
import { Atom } from "@effect-atom/atom-react";
import { AppConfig } from "@app/config";

export const appRuntime = Atom.runtime(Layer.provideMerge(AppConfig.Default, BunContext.layer));
