import { useEffect, useState } from "react";
import { MEDIA_BASE } from "../api";
import "./CardTile.css";

function imageUrl(url) {
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : `${MEDIA_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function CardTile({ deckCard, onRegenerate }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const generatedUrl = imageUrl(deckCard.generated_image_url);

  useEffect(() => {
    if (!modalOpen) return undefined;
    function closeOnEscape(event) { if (event.key === "Escape") setModalOpen(false); }
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [modalOpen]);

  async function regenerate() {
    setRegenerating(true); setError("");
    try { await onRegenerate(deckCard.id); }
    catch (requestError) { setError(requestError.response?.data?.detail || "No se pudo regenerar la carta."); }
    finally { setRegenerating(false); }
  }

  return (
    <article className={`card-tile ${deckCard.resolution_error ? "card-tile-error" : ""}`}>
      <div className="card-image-wrap">
        {generatedUrl ? <button type="button" className="card-image-button" onClick={() => setModalOpen(true)} aria-label={`Ampliar ${deckCard.name}`} disabled={regenerating}><img src={generatedUrl} alt={`Arte generado de ${deckCard.name}`} /></button> : <div className="image-placeholder"><span>✦</span>Sin generar</div>}
        {(deckCard.quantity || 1) > 1 && <span className="quantity-badge">×{deckCard.quantity}</span>}
        {generatedUrl && <div className="card-overlay"><a href={deckCard.original_art_url} target="_blank" rel="noreferrer" className={!deckCard.original_art_url ? "disabled" : ""}>Ver original</a><button type="button" onClick={regenerate} disabled={regenerating}>{regenerating ? "Generando…" : "Regenerar"}</button></div>}
        {regenerating && <div className="regenerating"><span className="spinner" />Generando arte…</div>}
      </div>
      <div className="card-info"><h3>{deckCard.name || deckCard.raw_name || "Carta sin resolver"}</h3><p>{deckCard.type_line || "Tipo desconocido"}</p>{deckCard.resolution_error && <div className="card-resolution-error">{deckCard.resolution_error}</div>}{error && <div className="card-resolution-error">{error}</div>}</div>
      {modalOpen && <div className="image-modal" role="dialog" aria-modal="true" aria-label={`Arte de ${deckCard.name}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><button onClick={() => setModalOpen(false)} aria-label="Cerrar imagen">×</button><img src={generatedUrl} alt={`Arte generado de ${deckCard.name} ampliado`} /></div>}
    </article>
  );
}
