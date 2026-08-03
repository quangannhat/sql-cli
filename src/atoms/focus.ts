import { Atom } from "@effect-atom/atom-react";

export type Pane = "sidebar" | "content";

export const focusAtom = Atom.make<Pane>("sidebar");
