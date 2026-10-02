import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { api, errorMessage } from "../../lib/api";

// The admin portal (docs/user-flows.md §6). An admin runs the service: approves doctors, edits
// articles, answers the inbox, reads usage, exports anonymised data. There is deliberately no
// screen that opens one child's record; the API has no route for it either.

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function useLoad(fn) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setData(await fn());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [fn]);
  useEffect(() => {
    let cancelled = false;
    fn()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError("");
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [fn]);
  return { data, error, reload };
}

// ---------------------------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------------------------

const STATUS_COLOR = { PENDING: "warning", APPROVED: "success", REJECTED: "default" };

function DoctorsTab() {
  const [status, setStatus] = useState("PENDING");
  const fetchDoctors = useCallback(() => api.get("/admin/doctors", { params: { status } }).then((r) => r.data), [status]);
  const { data, error, reload } = useLoad(fetchDoctors);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");

  async function decide(doctor, decision, reason) {
    setActionError("");
    try {
      await api.patch(`/admin/doctors/${doctor.id}`, { decision, note: reason });
      setRejecting(null);
      setNote("");
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextField select size="small" label="Show" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="PENDING">Waiting for approval</MenuItem>
          <MenuItem value="APPROVED">Approved</MenuItem>
          <MenuItem value="REJECTED">Rejected</MenuItem>
          <MenuItem value="">All doctors</MenuItem>
        </TextField>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Check the licence number with the medical council before approving. A doctor can be approved once their email address is confirmed; an approved doctor can then be invited to any child.
        </p>
      </div>
      {(error || actionError) && <Alert severity="error" sx={{ mb: 2 }}>{error || actionError}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>License</TableCell>
              <TableCell>Hospital</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Registered</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.fullName}</TableCell>
                <TableCell>{d.licenseNumber}</TableCell>
                <TableCell>{d.hospital}</TableCell>
                <TableCell>
                  {d.email}
                  <br />
                  <Chip
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                    color={d.isVerified ? "success" : "warning"}
                    label={d.isVerified ? "Email confirmed" : "Email not confirmed"}
                  />
                  {d.phoneNumber ? <><br />{d.phoneNumber}</> : null}
                </TableCell>
                <TableCell>{formatDate(d.createdAt)}</TableCell>
                <TableCell>
                  <Chip size="small" label={d.doctorStatus?.toLowerCase()} color={STATUS_COLOR[d.doctorStatus]} />
                  {d.doctorReviewNote && <p className="mt-1 text-xs text-slate-500">{d.doctorReviewNote}</p>}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {d.doctorStatus !== "APPROVED" && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!d.isVerified}
                      title={d.isVerified ? undefined : "Can be approved once the doctor confirms their email address"}
                      onClick={() => decide(d, "APPROVED")}
                    >
                      Approve
                    </Button>
                  )}{" "}
                  {d.doctorStatus !== "REJECTED" && (
                    <Button size="small" color="error" onClick={() => setRejecting(d)}>
                      Reject
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>No doctors here.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reject {rejecting?.fullName}?</DialogTitle>
        <DialogContent>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">The doctor sees this reason and is emailed.</p>
          <TextField autoFocus fullWidth multiline minRows={2} label="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={!note.trim()} onClick={() => decide(rejecting, "REJECTED", note.trim())}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------------------------

const EMPTY_ARTICLE = { title: "", slug: "", categoryId: "", tag: "Article", summary: "", contentMd: "", coverImageUrl: "", published: false };

function ArticlesTab() {
  const fetchArticles = useCallback(() => api.get("/admin/articles").then((r) => r.data), []);
  const { data, error, reload } = useLoad(fetchArticles);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function open(article) {
    setSaveError("");
    setEditing(article ?? "new");
    setForm(
      article
        ? {
            title: article.title,
            slug: article.slug,
            categoryId: article.categoryId,
            tag: article.tag ?? "",
            summary: article.summary,
            contentMd: article.contentMd,
            coverImageUrl: article.coverImageUrl ?? "",
            published: Boolean(article.publishedAt),
          }
        : { ...EMPTY_ARTICLE, categoryId: categories[0]?.id ?? "" },
    );
  }

  async function save() {
    setSaveError("");
    const body = { ...form, slug: form.slug.trim() || undefined, coverImageUrl: form.coverImageUrl.trim() || undefined, tag: form.tag.trim() || undefined };
    try {
      if (editing === "new") await api.post("/admin/articles", body);
      else await api.patch(`/admin/articles/${editing.id}`, body);
      setEditing(null);
      reload();
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  async function remove(article) {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    await api.delete(`/admin/articles/${article.id}`).catch((err) => window.alert(errorMessage(err)));
    reload();
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === "published" ? e.target.checked : e.target.value }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Published articles appear in Knowledge next to the team&apos;s five designed pages. Write in Markdown and end with the
          sources you used (FR-20). Only use images you have the right to publish.
        </p>
        <Button variant="contained" onClick={() => open(null)}>
          New article
        </Button>
      </div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {a.title}
                  <p className="text-xs text-slate-500">/knowledge/{a.slug}</p>
                </TableCell>
                <TableCell>{a.category?.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={a.publishedAt ? "published" : "draft"} color={a.publishedAt ? "success" : "default"} />
                </TableCell>
                <TableCell>{formatDate(a.updatedAt)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Button size="small" onClick={() => open(a)}>Edit</Button>
                  <Button size="small" color="error" onClick={() => remove(a)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>{editing === "new" ? "New article" : "Edit article"}</DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <TextField label="Title" value={form.title} onChange={set("title")} required />
            <TextField label="URL slug (optional)" value={form.slug} onChange={set("slug")} helperText="Lowercase words joined by hyphens" />
            <TextField select label="Category" value={form.categoryId} onChange={set("categoryId")}>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Label" value={form.tag} onChange={set("tag")} helperText="Article, Guide, Explainer…" />
            <TextField className="sm:col-span-2" label="Summary" value={form.summary} onChange={set("summary")} multiline minRows={2} />
            <TextField className="sm:col-span-2" label="Cover image URL (optional, https)" value={form.coverImageUrl} onChange={set("coverImageUrl")} />
            <TextField className="sm:col-span-2" label="Content (Markdown)" value={form.contentMd} onChange={set("contentMd")} multiline minRows={12} />
          </div>
          <FormControlLabel control={<Switch checked={form.published} onChange={set("published")} />} label="Published" sx={{ mt: 1 }} />
          {saveError && <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------------------------

function InboxTab() {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("NEW");
  const fetchInbox = useCallback(() => api.get("/admin/inbox", { params: { kind, status } }).then((r) => r.data), [kind, status]);
  const { data, error, reload } = useLoad(fetchInbox);

  async function mark(message, next) {
    await api.patch(`/admin/inbox/${message.id}`, { status: next }).catch(() => {});
    reload();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <TextField select size="small" label="Type" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="CONTACT">Contact form</MenuItem>
          <MenuItem value="PROBLEM">Problem reports</MenuItem>
        </TextField>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="NEW">New</MenuItem>
          <MenuItem value="READ">Read</MenuItem>
          <MenuItem value="RESOLVED">Resolved</MenuItem>
          <MenuItem value="">All</MenuItem>
        </TextField>
      </div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <div className="flex flex-col gap-3">
        {data?.map((m) => (
          <Paper key={m.id} variant="outlined" sx={{ p: 2 }}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip size="small" label={m.kind === "PROBLEM" ? "Problem" : "Contact"} color={m.kind === "PROBLEM" ? "warning" : "primary"} />
              <span className="font-semibold">{m.subject}</span>
              <span className="text-xs text-slate-500">
                {m.user ? `${m.user.fullName} · ` : ""}
                <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="underline">{m.email}</a> ·{" "}
                {new Date(m.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{m.message}</p>
            {m.context?.page && <p className="mt-1 text-xs text-slate-500">Page: {m.context.page}</p>}
            <div className="mt-2 flex gap-2">
              {m.status === "NEW" && <Button size="small" onClick={() => mark(m, "READ")}>Mark read</Button>}
              {m.status !== "RESOLVED" && <Button size="small" variant="outlined" onClick={() => mark(m, "RESOLVED")}>Resolved</Button>}
              {m.status === "RESOLVED" && <Button size="small" onClick={() => mark(m, "NEW")}>Reopen</Button>}
            </div>
          </Paper>
        ))}
        {data?.length === 0 && <p className="text-sm text-slate-500">Nothing here.</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------------------------

function Stat({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value ?? "—"}</p>
    </Paper>
  );
}

function UsageTab() {
  const fetchStats = useCallback(() => api.get("/admin/stats").then((r) => r.data), []);
  const { data, error } = useLoad(fetchStats);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const t = data.totals;
  const w = data.weekly;
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Accounts" value={t.users} />
        <Stat label="Doctors waiting" value={t.pendingDoctors} />
        <Stat label="Children" value={t.children} />
        <Stat label="Open inbox" value={t.openInbox} />
        <Stat label="Growth entries" value={t.growthEntries} />
        <Stat label="Puberty screenings" value={t.pubertyScreenings} />
        <Stat label="X-rays" value={t.xrays} />
        <Stat label="Caretaker links" value={t.childLinksByRole?.CARETAKER ?? 0} />
      </div>
      <p className="mb-2 text-sm text-slate-500">
        Accounts by type: {Object.entries(t.usersByRole).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ")}. Children followed
        by: {Object.entries(t.childLinksByRole).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ")}.
      </p>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Week starting</TableCell>
              <TableCell align="right">Sign-ups</TableCell>
              <TableCell align="right">Growth entries</TableCell>
              <TableCell align="right">Screenings</TableCell>
              <TableCell align="right">X-rays</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {w.weekStarts.map((d, i) => (
              <TableRow key={d}>
                <TableCell>{d}</TableCell>
                <TableCell align="right">{w.signups[i]}</TableCell>
                <TableCell align="right">{w.growthEntries[i]}</TableCell>
                <TableCell align="right">{w.pubertyScreenings[i]}</TableCell>
                <TableCell align="right">{w.xrays[i]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

function ExportTab() {
  const [error, setError] = useState("");
  async function download(dataset) {
    setError("");
    try {
      const res = await api.get("/admin/export.csv", { params: { dataset }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `growth-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Anonymised for research and reporting: each child is a stable code, with sex, age in months and the month of each
        record. No names, emails, phone numbers, hospital numbers, dates of birth or free-text notes.
      </p>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button variant="contained" onClick={() => download("growth")}>Growth measurements</Button>
        <Button variant="contained" onClick={() => download("puberty")}>Puberty screenings</Button>
        <Button variant="contained" onClick={() => download("bone-age")}>Bone age</Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

const TABS = [
  { path: "doctors", label: "Doctors", element: <DoctorsTab /> },
  { path: "articles", label: "Articles", element: <ArticlesTab /> },
  { path: "inbox", label: "Inbox", element: <InboxTab /> },
  { path: "usage", label: "Usage", element: <UsageTab /> },
  { path: "export", label: "Export", element: <ExportTab /> },
];

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-8 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#056559] dark:text-teal-300">Admin portal</h1>
        <nav className="my-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <NavLink
              key={t.path}
              to={t.path}
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#056559] text-white dark:bg-teal-400 dark:text-slate-950"
                    : "border border-slate-200 text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="text-slate-900 dark:text-slate-100">
          <Routes>
            <Route index element={<Navigate to="doctors" replace />} />
            {TABS.map((t) => (
              <Route key={t.path} path={t.path} element={t.element} />
            ))}
          </Routes>
        </div>
      </div>
    </div>
  );
}
