import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clipboardImage, referenceImageError } from "../clipboardImages";
import "./WikiImagePicker.css";

export default function WikiImagePicker({ initialWiki, initialPage, loadImages, onPick, onPasteFile, onClose, maxReached }) {
  const [wiki, setWiki] = useState(initialWiki || "");
  const [page, setPage] = useState(initialPage || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(null);
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState("");
  const [blockedUrl, setBlockedUrl] = useState("");
  const dialogRef = useRef(null);
  const pasteRef = useRef(null);
  const requestId = useRef(0);
  const active = useRef(true);
  const operation = useRef(false);
  const titleId = useId();
  const busy = loading || picking !== null || pasting;

  async function search(searchWiki = wiki, searchPage = page) {
    if (operation.current) {
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    setBlockedUrl("");
    setResult(null);
    try {
      const data = await loadImages(searchWiki.trim(), searchPage.trim());
      if (active.current && currentRequest === requestId.current) {
        setResult(data);
        setWiki(data.wiki || searchWiki);
        setPage(data.page || searchPage);
      }
    } catch (requestError) {
      if (active.current && currentRequest === requestId.current) {
        setError(requestError.response?.data?.detail || "No se pudieron cargar las imágenes de la wiki.");
      }
    } finally {
      if (active.current && currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    active.current = true;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current.focus();
    search(initialWiki || "", initialPage || "");
    return () => {
      active.current = false;
      requestId.current += 1;
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (blockedUrl) {
      pasteRef.current?.focus();
    }
  }, [blockedUrl]);

  useEffect(() => {
    if (!dialogRef.current.contains(document.activeElement) || document.activeElement?.disabled) {
      dialogRef.current.focus();
    }
  }, [busy]);

  async function pick(image) {
    if (operation.current || busy || maxReached) {
      return;
    }
    operation.current = true;
    setPicking(image.file);
    setError("");
    try {
      await onPick(image.file, result.wiki);
      if (active.current) {
        onClose();
      }
    } catch (requestError) {
      if (active.current) {
        const data = requestError.response?.data;
        setError(data?.detail || requestError.message || "No se pudo agregar la imagen.");
        if (data?.blocked && data.full_url) {
          setBlockedUrl(data.full_url);
          window.open(data.full_url, "_blank", "noopener");
        }
      }
    } finally {
      operation.current = false;
      if (active.current) {
        setPicking(null);
      }
    }
  }

  async function paste(event) {
    const { file, error: pasteError, hasImage } = clipboardImage(event.clipboardData);
    if (!hasImage) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (operation.current || busy || maxReached) {
      return;
    }
    const validation = pasteError || (file && referenceImageError(file));
    if (validation) {
      setError(validation);
      return;
    }
    if (!file) {
      return;
    }
    operation.current = true;
    setPasting(true);
    setError("");
    try {
      await onPasteFile(file);
      if (active.current) {
        onClose();
      }
    } catch (requestError) {
      if (active.current) {
        setError(requestError.response?.data?.detail || requestError.message || "No se pudo agregar la imagen.");
      }
    } finally {
      operation.current = false;
      if (active.current) {
        setPasting(false);
      }
    }
  }

  function keyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab") {
      const controls = [...dialogRef.current.querySelectorAll("input:not(:disabled), button:not(:disabled), a[href], [tabindex='0']")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return createPortal(
    <div className="wiki-picker-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section className="wiki-image-picker" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} tabIndex={-1} onKeyDown={keyDown} onPaste={paste}>
        <header className="wiki-picker-header">
          <h2 id={titleId}>Elegir imagen de la wiki</h2>
          <button type="button" className="secondary-button" aria-label="Cerrar selector de imágenes" onClick={onClose}>×</button>
        </header>
        <form className="wiki-picker-search" onSubmit={(event) => {
          event.preventDefault();
          if (!busy) {
            search();
          }
        }}>
          <label>Wiki<input value={wiki} onChange={(event) => setWiki(event.target.value)} disabled={busy} /></label>
          <label>Página<input value={page} onChange={(event) => setPage(event.target.value)} disabled={busy} /></label>
          <button type="submit" className="secondary-button" disabled={busy}>Buscar</button>
        </form>
        {result?.page_url && <a href={result.page_url} target="_blank" rel="noreferrer">Abrir página ↗</a>}
        {result?.fandom && <p className="wiki-picker-warning">Fandom bloquea descargas automáticas: al elegir una imagen se abrirá en una pestaña nueva; cópiala (clic derecho → Copiar imagen) y pégala aquí con Ctrl+V.</p>}
        {maxReached && <p role="status">Máximo de 3 referencias alcanzado; quita una para elegir otra.</p>}
        {error && <div className="error-panel" role="alert">{error}</div>}
        {blockedUrl && (
          <div className="reference-paste-zone" ref={pasteRef} tabIndex={0} aria-disabled={maxReached || busy}>
            {pasting ? "Agregando…" : "Pega aquí la imagen copiada (Ctrl+V)"}
            <a href={blockedUrl} target="_blank" rel="noreferrer">Abrir imagen ↗</a>
          </div>
        )}
        {loading && <div className="wiki-picker-loading" role="status"><span className="spinner" />Cargando imágenes…</div>}
        {result?.images?.length === 0 && <p>La página no tiene imágenes utilizables. Prueba otra página o pega una imagen.</p>}
        <div className="wiki-picker-grid" aria-busy={busy}>
          {result?.images?.map((image) => (
            <button type="button" className="wiki-picker-image" key={image.file} disabled={busy || maxReached} onClick={() => pick(image)} aria-label={`Elegir ${image.file}`}>
              <div className="wiki-picker-thumb">
                <img src={image.thumb_url} alt={image.file} loading="lazy" referrerPolicy="no-referrer" />
                {picking === image.file && <span className="wiki-picker-progress" role="status"><span className="spinner" />Agregando…</span>}
              </div>
              <span className="wiki-picker-filename" title={image.file}>{image.file}</span>
              <small>{image.width}×{image.height}</small>
              <span className="wiki-picker-badges">
                {image.is_page_image && <span>Principal</span>}
                {image.maybe_fan_art && <span className="wiki-picker-fan-art">Posible fan art</span>}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body
  );
}
