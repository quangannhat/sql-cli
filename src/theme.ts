export type Theme = {
  readonly border: {
    readonly focused: string;
    readonly unfocused: string;
  };
  readonly text: {
    readonly primary: string;
    readonly muted: string;
  };
  readonly status: {
    readonly error: string;
    readonly warning: string;
    readonly success: string;
  };
};

export const theme: Theme = {
  border: {
    focused: "#a6e3a1",
    unfocused: "#ffffff",
  },
  text: {
    primary: "#ffffff",
    muted: "#888888",
  },
  status: {
    error: "#e06c75",
    warning: "#e5c07b",
    success: "#98c379",
  },
};

export const borderColor = (isFocused: boolean) =>
  isFocused ? theme.border.focused : theme.border.unfocused;
