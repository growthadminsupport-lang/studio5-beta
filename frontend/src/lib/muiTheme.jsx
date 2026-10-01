import { useMemo } from "react";
import { createTheme, ThemeProvider as MuiProvider } from "@mui/material/styles";
import { useTheme } from "../context/ThemeContext";

/**
 * MUI follows the app's own light/dark toggle (ThemeContext), so a MUI dialog opened over a
 * Tailwind page never shows up in the other theme. Colours are the brand teal the Tailwind pages
 * use (#056559 light, teal-400 dark). No CssBaseline: Tailwind's preflight already resets the page.
 */
export default function MuiThemeBridge({ children }) {
  const { theme } = useTheme();
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme === "dark" ? "dark" : "light",
          primary: { main: theme === "dark" ? "#2dd4bf" : "#056559" },
          ...(theme === "dark" ? { background: { paper: "#1e293b", default: "#0f172a" } } : {}),
        },
        shape: { borderRadius: 12 },
        typography: { fontFamily: "inherit", button: { textTransform: "none", fontWeight: 600 } },
      }),
    [theme],
  );
  return <MuiProvider theme={muiTheme}>{children}</MuiProvider>;
}
