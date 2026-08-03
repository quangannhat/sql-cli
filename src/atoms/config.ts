import { AppConfig } from "@app/config";
import { appRuntime } from "@app/atoms/runtime";

export const configAtom = appRuntime.atom(AppConfig);
