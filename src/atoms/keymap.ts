import { Atom } from "@effect-atom/atom-react";
import type { KeyMode } from "@app/keymap";

export const keyModeAtom = Atom.make<KeyMode>("normal");
