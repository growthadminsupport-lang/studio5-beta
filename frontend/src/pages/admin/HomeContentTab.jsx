import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Alert, Button, Slider, TextField } from "@mui/material";
import { api, errorMessage } from "../../lib/api";
import { SECTION_DEFAULTS, loadSections, toSection } from "../../lib/siteContent";
import { AboutShowcase, DashboardShowcase } from "../../components/Home/Showcases";

// Home page tab: the admin edits the "Comprehensive Dashboard" and "About GrowTH" sections —
// the text, and a picture or video cropped to the section's frame — with a live preview that
// uses the same component as the Home page.

const SHOWCASE = { "home-dashboard": DashboardShowcase, "home-about": AboutShowcase };
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2000;

/**
 * A phone photo is often 4000px and several MB, and every Home page visitor would download it.
 * Scaled down to 2000px as WebP before upload. Scaling is uniform, so the crop, which is in
 * percent, still fits. Small files are sent as they are.
 */
async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  // Safari before 17 cannot encode WebP and hands back PNG, which is larger: keep the original.
  if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
  return new File([blob], "picture.webp", { type: "image/webp" });
}

// The cropper reports the crop it starts from, recomputed and rounded differently from the saved
// one; count that as unchanged.
function sameCrop(a, b) {
  if (!a || !b) return a === b;
  return ["x", "y", "width", "height"].every((k) => Math.abs(a[k] - b[k]) < 0.05);
}

function SectionEditor({ sectionKey, saved, onSaved }) {
  const defaults = SECTION_DEFAULTS[sectionKey];
  const [text, setText] = useState({ eyebrow: saved.eyebrow ?? "", title: saved.title, body: saved.body });
  // The media being edited: the saved file, a newly picked one (object URL), or none.
  const [media, setMedia] = useState({ src: saved.mediaSrc, type: saved.mediaType, file: null });
  const [crop, setCrop] = useState(saved.crop);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Bumped to remount the cropper, so it starts from the saved crop again.
  const [cropperKey, setCropperKey] = useState(0);
  const [status, setStatus] = useState({ saving: false, error: "", done: false });

  useEffect(() => () => media.file && URL.revokeObjectURL(media.src), [media]);

  // react-easy-crop measures a <video> as soon as its metadata arrives, before layout has
  // resized the element, and so restores a saved crop at the wrong zoom. Reading the size first
  // and giving the cropper's video width/height attributes lets it lay out right away.
  const [videoSize, setVideoSize] = useState(null);
  useEffect(() => {
    if (media.type !== "video" || !media.src) return;
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    probe.onloadedmetadata = () => setVideoSize({ src: media.src, width: probe.videoWidth, height: probe.videoHeight });
    probe.src = media.src;
    return () => {
      probe.onloadedmetadata = null;
      probe.removeAttribute("src");
      probe.load();
    };
  }, [media.type, media.src]);
  const sized = media.type !== "video" || videoSize?.src === media.src;

  const changed =
    media.file !== null ||
    media.src !== saved.mediaSrc ||
    !sameCrop(crop, saved.crop) ||
    text.title !== saved.title ||
    text.body !== saved.body ||
    (defaults.eyebrow !== null && text.eyebrow !== (saved.eyebrow ?? ""));

  function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const video = VIDEO_TYPES.includes(file.type);
    if (!video && !IMAGE_TYPES.includes(file.type)) {
      setStatus({ saving: false, done: false, error: file.type === "video/quicktime"
        ? "This is a .mov video, which most browsers cannot play. Export it as MP4 (H.264) first."
        : "Use a JPEG, PNG or WebP picture, or an MP4 or WebM video." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ saving: false, done: false, error: "The file is over 30 MB. Use a shorter or smaller video." });
      return;
    }
    setStatus({ saving: false, error: "", done: false });
    setMedia({ src: URL.createObjectURL(file), type: video ? "video" : "image", file });
    setCrop(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setCropperKey((k) => k + 1);
  }

  function removeMedia() {
    setMedia({ src: null, type: null, file: null });
    setCrop(null);
  }

  function reset() {
    setText({ eyebrow: saved.eyebrow ?? "", title: saved.title, body: saved.body });
    setMedia({ src: saved.mediaSrc, type: saved.mediaType, file: null });
    setCrop(saved.crop);
    setZoom(1);
    setCropperKey((k) => k + 1);
    setStatus({ saving: false, error: "", done: false });
  }

  async function save() {
    setStatus({ saving: true, error: "", done: false });
    const form = new FormData();
    form.append("title", text.title.trim());
    form.append("body", text.body.trim());
    if (defaults.eyebrow !== null) form.append("eyebrow", text.eyebrow.trim());
    if (crop) form.append("crop", JSON.stringify(crop));
    if (media.file) {
      form.append("file", media.type === "image" ? await shrinkImage(media.file) : media.file);
    } else if (!media.src && saved.mediaSrc) {
      form.append("removeMedia", "true");
    }
    try {
      const { data } = await api.put(`/admin/site/sections/${sectionKey}`, form, { timeout: 120000 });
      const now = toSection(sectionKey, data);
      setMedia({ src: now.mediaSrc, type: now.mediaType, file: null });
      setCrop(now.crop);
      onSaved(data);
      setStatus({ saving: false, error: "", done: true });
    } catch (err) {
      setStatus({ saving: false, error: errorMessage(err), done: false });
    }
  }

  const draft = { ...toSection(sectionKey, null), ...text, eyebrow: defaults.eyebrow === null ? null : text.eyebrow, mediaSrc: media.src, mediaType: media.type, crop };
  const Showcase = SHOWCASE[sectionKey];
  const tooShort = text.title.trim().length < 2 || text.body.trim().length < 2;

  return (
    <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-4 text-base font-semibold">{defaults.label}</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {defaults.eyebrow !== null && (
            <TextField
              label="Small heading"
              size="small"
              value={text.eyebrow}
              slotProps={{ htmlInput: { maxLength: 40 } }}
              onChange={(e) => setText((t) => ({ ...t, eyebrow: e.target.value }))}
            />
          )}
          <TextField
            label="Title"
            size="small"
            value={text.title}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            onChange={(e) => setText((t) => ({ ...t, title: e.target.value }))}
          />
          <TextField
            label="Text"
            size="small"
            multiline
            minRows={2}
            value={text.body}
            slotProps={{ htmlInput: { maxLength: 400 } }}
            helperText={`${text.body.length}/400`}
            onChange={(e) => setText((t) => ({ ...t, body: e.target.value }))}
          />
          <Button
            variant="text"
            size="small"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => setText({ eyebrow: defaults.eyebrow ?? "", title: defaults.title, body: defaults.body })}
          >
            Use the original text
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Picture or video ({defaults.frame}). JPEG, PNG, WebP, MP4 or WebM, up to 30 MB. Videos play muted on a loop, so
            keep them short. Without one, the section shows the drawn app mock-up.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outlined" component="label">
              {media.src ? "Replace" : "Choose file"}
              <input hidden type="file" accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")} onChange={pick} />
            </Button>
            {media.src && (
              <Button variant="text" color="error" onClick={removeMedia}>
                Remove, show the mock-up
              </Button>
            )}
          </div>

          {media.src && sized && (
            <>
              <div className="relative h-64 overflow-hidden rounded-xl bg-slate-900 sm:h-72">
                <Cropper
                  key={cropperKey}
                  {...(media.type === "video" ? { video: media.src } : { image: media.src })}
                  aspect={defaults.aspect}
                  crop={position}
                  zoom={zoom}
                  maxZoom={4}
                  initialCroppedAreaPercentages={crop ?? undefined}
                  onCropChange={setPosition}
                  onZoomChange={setZoom}
                  onCropComplete={(area) => setCrop(area)}
                  mediaProps={media.type === "video" ? { width: videoSize.width, height: videoSize.height } : {}}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">Zoom</span>
                <Slider size="small" min={1} max={4} step={0.01} value={zoom} onChange={(_, v) => setZoom(v)} aria-label="Zoom" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Drag to move, scroll or pinch to zoom.</p>
            </>
          )}
        </div>
      </div>

      {status.error && <Alert severity="error" sx={{ mt: 3 }}>{status.error}</Alert>}
      {status.done && !changed && <Alert severity="success" sx={{ mt: 3 }}>Saved. The Home page shows it now.</Alert>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="contained" disabled={!changed || tooShort || status.saving} onClick={save}>
          {status.saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="text" disabled={!changed || status.saving} onClick={reset}>
          Undo changes
        </Button>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Preview</h3>
      <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900">
        <Showcase section={draft} />
      </div>
    </section>
  );
}

export default function HomeContentTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/site/sections")
      .then((r) => setRows(r.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Two sections of the public Home page. Only use pictures and videos you have the right to publish, and never one that
        shows a child&apos;s real data.
      </p>
      {Object.keys(SECTION_DEFAULTS).map((key) => (
        <SectionEditor
          key={key}
          sectionKey={key}
          saved={toSection(key, rows.find((r) => r.key === key))}
          onSaved={(row) => {
            setRows((all) => [...all.filter((r) => r.key !== key), row]);
            loadSections({ fresh: true });
          }}
        />
      ))}
    </>
  );
}
