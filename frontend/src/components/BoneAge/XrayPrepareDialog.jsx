import { useEffect, useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery } from '@mui/material';
import { detectFilm, isWholeFrame, loadXray, prepareUpload } from '../../lib/xray';

function formatBytes(n) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/**
 * Between choosing a file and uploading it: shows the X-ray (page 1 of a PDF, or the image),
 * proposes a crop around the film, lets the doctor adjust it, and reports what will be sent.
 * Opening a new file remounts this (keyed by the file), so state never leaks between files.
 */
export default function XrayPrepareDialog({ file, onCancel, onUpload }) {
  const fullScreen = useMediaQuery('(max-width:640px)');
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(null);
  const [crop, setCrop] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url = null;
    loadXray(file, page)
      .then(async (result) => {
        if (cancelled) return;
        const blob = await new Promise((resolve) => result.canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLoaded(result);
        setPreview(url);
        setCrop(detectFilm(result.canvas));
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, page]);

  async function upload() {
    setBusy(true);
    setError(null);
    try {
      onUpload(await prepareUpload(loaded, crop));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const whole = isWholeFrame(crop);

  return (
    <Dialog open onClose={busy ? undefined : onCancel} fullScreen={fullScreen} maxWidth="sm" fullWidth>
      <DialogTitle>Check the X-ray</DialogTitle>
      <DialogContent>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Keep the whole film in the box and leave out page margins, text and the light box. Do not crop tightly to the
          hand: the AI was trained on full films.
        </p>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!preview && !error && <p className="py-10 text-center text-sm text-slate-500">Opening {file.name}…</p>}
        {preview && (
          <div className="flex justify-center rounded-xl bg-slate-900 p-2">
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} keepSelection ruleOfThirds={false}>
              <img src={preview} alt="X-ray to upload" style={{ maxHeight: fullScreen ? '60vh' : '55vh' }} />
            </ReactCrop>
          </div>
        )}
        {loaded && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {whole ? 'Whole image' : 'Cropped'} · original {formatBytes(file.size)}
              {loaded.pages > 1 ? ` · page ${page} of ${loaded.pages}` : ''}
            </span>
            <span className="flex gap-2">
              {loaded.pages > 1 && (
                <>
                  <Button size="small" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>
                    Previous page
                  </Button>
                  <Button size="small" disabled={page >= loaded.pages || busy} onClick={() => setPage((p) => p + 1)}>
                    Next page
                  </Button>
                </>
              )}
              <Button size="small" disabled={whole || busy} onClick={() => setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 })}>
                Use whole image
              </Button>
            </span>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={upload} disabled={!loaded || busy}>
          {busy ? 'Preparing…' : 'Upload and analyse'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
