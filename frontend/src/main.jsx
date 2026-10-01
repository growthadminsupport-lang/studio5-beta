import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ChildrenProvider } from "./context/ChildrenContext";
import MuiThemeBridge from "./lib/muiTheme";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <ThemeProvider>
            <MuiThemeBridge>
              <ChildrenProvider>
                <App />
              </ChildrenProvider>
            </MuiThemeBridge>
          </ThemeProvider>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);