import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { api, errorMessage } from "../../lib/api";
import { useChildren } from "../../context/ChildrenContext";

/**
 * "Report a problem": lands in the admin portal's inbox with the page and child it came from,
 * so the admin can find it without asking. No medical data is attached.
 */
export default function ReportProblemDialog({ open, onClose }) {
  const location = useLocation();
  const { activeChildId } = useChildren() ?? {};
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  async function send() {
    setError("");
    setState("sending");
    try {
      await api.post("/support/report", {
        message: message.trim(),
        context: { page: location.pathname, ...(activeChildId ? { childId: activeChildId } : {}) },
      });
      setState("sent");
      setMessage("");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  }

  function close() {
    onClose();
    setTimeout(() => setState("idle"), 300);
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Report a problem</DialogTitle>
      <DialogContent>
        {state === "sent" ? (
          <Alert severity="success">Thanks. The GrowTH team will look into it.</Alert>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              What went wrong? A wrong result, something that didn&apos;t load, anything confusing. We include the page you
              are on.
            </p>
            <TextField
              autoFocus
              multiline
              minRows={4}
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the problem"
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {state === "sent" ? (
          <Button variant="contained" onClick={close}>Close</Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" onClick={send} disabled={message.trim().length < 5 || state === "sending"}>
              {state === "sending" ? "Sending…" : "Send"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
