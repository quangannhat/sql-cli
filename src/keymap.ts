import type { ParsedKey } from "@opentui/core";

/**
 * Modes work like vim's pending-operator state: `normal` is the resting mode,
 * and a prefix key (e.g. ctrl+w) switches to a mode whose bindings resolve the
 * next keypress. Unmatched keys fall back to `normal`.
 */
export type KeyMode = "normal" | "window";

export type Action =
  | { readonly _tag: "EnterMode"; readonly mode: KeyMode }
  | { readonly _tag: "FocusPane"; readonly pane: "sidebar" | "content" };

export type Binding = {
  readonly keys: string;
  readonly action: Action;
  readonly description: string;
};

export const keymap: Record<KeyMode, ReadonlyArray<Binding>> = {
  normal: [
    {
      keys: "ctrl+w",
      action: { _tag: "EnterMode", mode: "window" },
      description: "window prefix",
    },
  ],
  window: [
    {
      keys: "h",
      action: { _tag: "FocusPane", pane: "sidebar" },
      description: "focus sidebar",
    },
    {
      keys: "l",
      action: { _tag: "FocusPane", pane: "content" },
      description: "focus content",
    },
  ],
};

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  enter: "return",
  cr: "return",
  space: "space",
};

type Chord = {
  readonly name: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly option: boolean;
};

const parseChord = (keys: string): Chord => {
  const parts = keys.toLowerCase().split("+");
  const name = parts[parts.length - 1] ?? "";
  const modifiers = parts.slice(0, -1);

  return {
    name: KEY_ALIASES[name] ?? name,
    ctrl: modifiers.includes("ctrl") || modifiers.includes("control"),
    shift: modifiers.includes("shift"),
    meta: modifiers.includes("meta") || modifiers.includes("cmd"),
    option: modifiers.includes("alt") || modifiers.includes("option"),
  };
};

/** Modifiers must match exactly, so `h` never fires on `ctrl+h`. */
export const matches = (keys: string, key: ParsedKey): boolean => {
  const chord = parseChord(keys);
  return (
    key.name === chord.name &&
    key.ctrl === chord.ctrl &&
    key.shift === chord.shift &&
    key.meta === chord.meta &&
    key.option === chord.option
  );
};

export const resolve = (mode: KeyMode, key: ParsedKey): Action | undefined =>
  keymap[mode].find((binding) => matches(binding.keys, key))?.action;
