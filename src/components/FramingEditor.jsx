import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProxyCard from "./ProxyCard";
import "./FramingEditor.css";
import { artBounds } from "../artFraming";

function savedFraming(deckCard) {
  return {
    offsetX: deckCard.generated_image?.framing_offset_x ?? 0,
    offsetY: deckCard.generated_image?.framing_offset_y ?? 0,
    zoom: deckCard.generated_image?.framing_zoom ?? 100,
  };
}

export default function FramingEditor({ deckCard, symbols, layout, busy, onSave, onAuto, onClose }) {
  const [framing, setFraming] = useState(() => savedFraming(deckCard));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const previewRef = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [naturalSize, setNaturalSize] = useState(null);
  const titleId = useId();
  const blocked = busy || working;
  const source = deckCard.generated_image?.framing_source || "default";
  const image = deckCard.generated_image;
  const currentSize = image?.width > 0 && image?.height > 0 ? image : naturalSize?.url === image?.image_url ? naturalSize : null;
  const bounds = artBounds(currentSize?.width, currentSize?.height, framing);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sourceNames = { auto: "Automático", manual: "Manual", default: "Por defecto" };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (!dialogRef.current.contains(document.activeElement) || document.activeElement?.disabled) {
      dialogRef.current.focus();
    }
  }, [blocked]);

  useEffect(() => {
    const imageElement = previewRef.current.querySelector(".proxy-art-image");
    if (!imageElement) return undefined;
    const readSize = () => setNaturalSize({ url: image.image_url, width: imageElement.naturalWidth, height: imageElement.naturalHeight });
    imageElement.addEventListener("load", readSize);
    if (imageElement.complete) readSize();
    return () => imageElement.removeEventListener("load", readSize);
  }, [image?.image_url]);

  useEffect(() => {
    const preview = previewRef.current;
    function wheel(event) {
      event.preventDefault();
      if (blocked || !event.deltaY) return;
      const rect = preview.getBoundingClientRect();
      const cursorX = (event.clientX - rect.left) / rect.width * 100;
      const cursorY = (event.clientY - rect.top) / rect.height * 100;
      setFraming((current) => {
        const zoom = clamp(current.zoom + (event.deltaY < 0 ? 5 : -5), 50, 300);
        const ratio = zoom / current.zoom;
        return {
          zoom,
          offsetX: clamp(cursorX - (cursorX - 50 - current.offsetX) * ratio - 50, -60, 60),
          offsetY: clamp(cursorY - (cursorY - 50 - current.offsetY) * ratio - 50, -60, 60),
        };
      });
    }
    preview.addEventListener("wheel", wheel, { passive: false });
    return () => preview.removeEventListener("wheel", wheel);
  }, [blocked]);

  function pointerDown(event) {
    if (blocked || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, framing };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function pointerMove(event) {
    const start = drag.current;
    if (blocked || !start || start.id !== event.pointerId) return;
    setFraming({
      ...start.framing,
      offsetX: clamp(start.framing.offsetX + (event.clientX - start.x) / start.width * 100, -60, 60),
      offsetY: clamp(start.framing.offsetY + (event.clientY - start.y) / start.height * 100, -60, 60),
    });
  }

  function pointerEnd(event) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function run(action) {
    if (blocked) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      if (action === "auto") {
        const updated = await onAuto();
        setFraming(savedFraming(updated));
      } else {
        await onSave(framing);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo ajustar el encuadre.");
    } finally {
      setWorking(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!blocked) {
        onClose();
      }
    } else if (!blocked && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "=", "-", "0"].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      setFraming((current) => {
        if (event.key === "0") return { offsetX: 0, offsetY: 0, zoom: 100 };
        if (["+", "=", "-"].includes(event.key)) return { ...current, zoom: clamp(current.zoom + (event.key === "-" ? -5 : 5), 50, 300) };
        const horizontal = ["ArrowLeft", "ArrowRight"].includes(event.key);
        const field = horizontal ? "offsetX" : "offsetY";
        const delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -step : step;
        return { ...current, [field]: clamp(current[field] + delta, -60, 60) };
      });
    } else if (event.key === "Tab") {
      const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return createPortal(
    <div className="framing-overlay">
      <section
        className="framing-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={blocked}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="framing-header">
          <h2 id={titleId}>Encuadre</h2>
          <button type="button" className="secondary-button" disabled={blocked} onClick={onClose} aria-label="Cerrar encuadre">×</button>
        </header>
        <div className="framing-body">
          <div className="framing-preview-space">
            <div
              className={`framing-preview ${dragging ? "framing-dragging" : ""}`}
              ref={previewRef}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={pointerEnd}
              onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
            >
              <ProxyCard deckCard={deckCard} symbols={symbols} layout={layout} framingOverride={framing} />
              <div className="framing-guide framing-guide-title" aria-hidden="true" />
              <div className="framing-guide framing-guide-text" aria-hidden="true" />
              <div className="framing-face-guide" aria-hidden="true">altura ideal del rostro</div>
            </div>
          </div>
          <div className="framing-controls">
            <span className="framing-source">{sourceNames[source] || sourceNames.default}</span>
            {[{ key: "offsetX", label: "Horizontal", min: -60, max: 60, step: .5 }, { key: "offsetY", label: "Vertical", min: -60, max: 60, step: .5 }, { key: "zoom", label: "Zoom", min: 50, max: 300, step: 1 }].map((control) => (
              <label key={control.key}>
                {control.label} <output>{Number(framing[control.key].toFixed(1))}%</output>
                <input type="range" min={control.min} max={control.max} step={control.step} value={framing[control.key]} disabled={blocked} aria-label={control.label} onChange={(event) => setFraming((current) => ({ ...current, [control.key]: Number(event.target.value) }))} />
              </label>
            ))}
            <p>Arrastra para mover · rueda para zoom · flechas para ajustar</p>
            {bounds?.gaps && <p>Los bordes vacíos se rellenan con un fondo difuminado</p>}
            {framing.zoom > 140 && currentSize?.width > 0 && currentSize.width < 1500 && <p>Con este zoom la imagen puede verse pixelada al imprimir; regenera en 2K para más nitidez</p>}
            <div className="framing-actions">
              <button type="button" className="secondary-button" disabled={blocked} onClick={() => setFraming(savedFraming(deckCard))}>Restablecer</button>
              <button type="button" className="secondary-button" disabled={blocked} onClick={() => setFraming({ offsetX: 0, offsetY: 0, zoom: 100 })}>Llenar</button>
              <button type="button" className="secondary-button" disabled={blocked} onClick={() => setFraming((current) => ({ ...current, offsetX: 0, offsetY: 0 }))}>Centrar</button>
              <button type="button" className="secondary-button" disabled={blocked} onClick={() => run("auto")}>Ajustar a la cara</button>
              <button type="button" className="primary-button" disabled={blocked} onClick={() => run("save")}>Guardar</button>
            </div>
            {working && <p role="status">Ajustando encuadre…</p>}
            {error && <div className="error-panel" role="alert">{error}</div>}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
