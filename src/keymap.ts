import type { KeyEvent, Renderable } from "@opentui/core";
import { createBindingLookup } from "@opentui/keymap/extras";
import type { BindingCommandMap, BindingConfig, BindingDefaults } from "@opentui/keymap/extras";
import { Schema } from "effect";

/**
 * Keybind definitions, following the opencode TUI layout: a flat map of
 * keybind name -> default chord + description, resolved against
 * `@opentui/keymap` which owns matching, sequences and the leader timer.
 *
 * Chord syntax: "ctrl+w", "<leader>h", comma-separated alternatives
 * ("escape,q"), or "none" / false to unbind.
 */

const BindingItem = Schema.String;

export const BindingValueSchema = Schema.Union(
  Schema.Literal(false),
  Schema.Literal("none"),
  BindingItem,
  Schema.Array(BindingItem),
);
export type BindingValueSchema = typeof BindingValueSchema.Type;

type Definition = {
  readonly default: BindingValueSchema;
  readonly description: string;
};

export const LEADER_TOKEN = "leader";
export const LeaderDefault = "ctrl+w";
export const LeaderTimeoutDefault = 2000;

const keybind = (value: Definition["default"], description: string): Definition => ({
  default: value,
  description,
});

export const Definitions = {
  leader: keybind(LeaderDefault, "Leader key for keybind combinations"),

  focus_sidebar: keybind("<leader>h", "Focus the connections sidebar"),
  focus_content: keybind("<leader>l", "Focus the content pane"),
} as const;

export type KeybindName = keyof typeof Definitions;

const KeybindNames = new Set(Object.keys(Definitions));

/** Keybind name -> dotted command name dispatched through the keymap. */
export const CommandMap = {
  focus_sidebar: "focus.sidebar",
  focus_content: "focus.content",
} satisfies BindingCommandMap;

export type CommandName = (typeof CommandMap)[keyof typeof CommandMap];

const CommandDescriptions = Object.fromEntries(
  Object.entries(Definitions).map(([name, item]) => [
    CommandMap[name as keyof typeof CommandMap] ?? name,
    item.description,
  ]),
) as Record<string, string>;

export type Keybinds = { [K in KeybindName]: BindingValueSchema };
export type KeybindOverrides = Partial<Keybinds>;

const decodeBindingValue = Schema.decodeUnknownSync(BindingValueSchema);

export function unknownKeys(input: object) {
  return Object.keys(input).filter((key) => !KeybindNames.has(key));
}

export function parse(overrides: KeybindOverrides = {}): Keybinds {
  const invalid = unknownKeys(overrides);
  if (invalid.length)
    throw new Error(`Unrecognized keybind${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}`);

  return Object.fromEntries(
    Object.entries(Definitions).map(([name, item]) => [
      name,
      decodeBindingValue(overrides[name as KeybindName] ?? item.default),
    ]),
  ) as Keybinds;
}

export const Keybinds = { parse };

export function toBindingConfig(keybinds: Keybinds): BindingConfig<Renderable, KeyEvent> {
  return Object.fromEntries(Object.entries(keybinds)) as BindingConfig<Renderable, KeyEvent>;
}

/** Fills in `desc` from the definition so which-key style UIs get labels for free. */
export function bindingDefaults(): BindingDefaults<Renderable, KeyEvent> {
  return ({ command, binding }) => {
    if (binding.desc !== undefined) return;
    return { desc: CommandDescriptions[command] };
  };
}

/**
 * Resolved bindings for the app. Call `lookup.update(toBindingConfig(...))`
 * once keybinds become user-configurable through the config file.
 */
export const lookup = createBindingLookup<Renderable, KeyEvent>(toBindingConfig(parse()), {
  commandMap: CommandMap,
  bindingDefaults: bindingDefaults(),
});

export const leaderKey = () => lookup.get(LEADER_TOKEN)[0]?.key;
