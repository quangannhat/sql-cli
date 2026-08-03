import { Atom } from "@effect-atom/atom-react";

export type Pane = "sidebar" | "content";

export const focusAtom = Atom.make<Pane>("sidebar");

/** True while `C-w` has been pressed and we're waiting for the next key. */
export const windowPendingAtom = Atom.make(false);
