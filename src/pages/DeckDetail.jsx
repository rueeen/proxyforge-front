import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import CardTile from "../components/CardTile";
import ProgressBar from "../components/ProgressBar";
import "./DeckDetail.css";

const sectionOrder = { commander: 0, main: 1, sideboard: 2 };
const sectionNames = { commander: "Comandante", main: "Mazo principal", sideboard: "Sideboard" };

export default function DeckDetail() {
  const { id } = useParams(); const navigate = useNavigate();
  const [deck, setDeck] = useState(null); const [estimate, setEstimate] = useState(null); const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [generating, setGenerating] = useState(false); const [notice, setNotice] = useState(""); const [reloadKey, setReloadKey] = useState(0);
  const intervalRef = useRef(null); const mountedRef = useRef(true);

  const loadDeck = useCallback(async () => { const response = await api.get(`/decks/${id}/`); if (mountedRef.current) setDeck(response.data); return response.data; }, [id]);

  useEffect(() => {
    mountedRef.current = true;
    async function loadPage() {
      setLoading(true); setError("");
      try {
        const [deckResponse, estimateResponse] = await Promise.all([api.get(`/decks/${id}/`), api.get(`/decks/${id}/estimate/`)]);
        if (!mountedRef.current) return;
        setDeck(deckResponse.data); setEstimate(estimateResponse.data);
        const activeJob = deckResponse.data.active_job || deckResponse.data.current_job;
        if (activeJob && ["pending", "running"].includes(activeJob.status)) setJob(activeJob);
        else if (deckResponse.data.active_job_id) setJob({ id: deckResponse.data.active_job_id, status: "pending" });
      } catch (requestError) { if (mountedRef.current) setError(requestError.response?.data?.detail || "No se pudo cargar el mazo."); }
      finally { if (mountedRef.current) setLoading(false); }
    }
    loadPage();
    return () => { mountedRef.current = false; if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!job?.id || !["pending", "running"].includes(job.status)) return undefined;
    async function pollJob() {
      try {
        const response = await api.get(`/jobs/${job.id}/`); if (!mountedRef.current) return;
        const nextJob = response.data; setJob(nextJob);
        if (["done", "failed"].includes(nextJob.status)) {
          clearInterval(intervalRef.current); intervalRef.current = null; await loadDeck(); setGenerating(false);
          if ((nextJob.failed_cards || 0) > 0) setNotice(`${nextJob.failed_cards} cartas fallaron. Puedes regenerarlas individualmente desde cada carta.`);
          else if (nextJob.status === "done") setNotice("Generación completada.");
          else setNotice("La generación no pudo completarse.");
        }
      } catch (requestError) { if (mountedRef.current) { setNotice(requestError.response?.data?.detail || "Se perdió la conexión con el proceso de generación."); setGenerating(false); } clearInterval(intervalRef.current); intervalRef.current = null; }
      finally { /* El siguiente intervalo continuará el polling mientras el job siga activo. */ }
    }
    pollJob(); intervalRef.current = setInterval(pollJob, 2000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [job?.id, job?.status, loadDeck]);

  async function generateArt() { setGenerating(true); setError(""); setNotice(""); try { const response = await api.post(`/decks/${id}/generate/`); setJob(response.data.job || response.data); } catch (requestError) { setError(requestError.response?.data?.detail || "No se pudo iniciar la generación."); setGenerating(false); } finally { /* El proceso continúa mediante polling. */ } }
  async function regenerateCard(cardId) { try { const response = await api.post(`/cards/${cardId}/regenerate/`); const updated = response.data.card || response.data; setDeck((current) => ({ ...current, cards: (current.cards || current.deck_cards || []).map((card) => card.id === cardId ? { ...card, ...updated } : card) })); } catch (requestError) { throw requestError; } finally { /* El tile controla su indicador. */ } }

  const cards = useMemo(() => { const list = deck?.cards || deck?.deck_cards || []; return [...list].sort((a,b) => (sectionOrder[a.section] ?? 1) - (sectionOrder[b.section] ?? 1) || (a.name || a.raw_name || "").localeCompare(b.name || b.raw_name || "", "es")); }, [deck]);
  const sections = useMemo(() => cards.reduce((groups, card) => { const section = card.section || "main"; (groups[section] ||= []).push(card); return groups; }, {}), [cards]);
  if (loading) return <div className="page-loading">Cargando…</div>;
  if (error && !deck) return <div className="error-panel">{error}<br/><button className="secondary-button" onClick={() => setReloadKey((key) => key + 1)}>Reintentar</button></div>;
  const unique = estimate?.unique_cards ?? estimate?.total_unique ?? cards.length; const generated = estimate?.generated_cards ?? estimate?.already_generated ?? cards.filter((c) => c.generated_image_url).length; const remaining = estimate?.cards_to_generate ?? estimate?.remaining_cards ?? Math.max(unique-generated,0); const cost = Number(estimate?.estimated_cost ?? estimate?.cost_usd ?? 0).toFixed(2); const active = ["pending","running"].includes(job?.status);
  return (
    <section className="detail-page">
      <button className="back-button" onClick={() => navigate(-1)}>← Volver</button>
      <header className="deck-header"><div><div className="header-tags"><span className="theme-badge">{deck.theme || "Sin tema"}</span><span>{cards.length} cartas</span></div><h1>{deck.name}</h1></div></header>
      <section className="generation-panel"><div className="generation-copy"><div><p className="eyebrow">Generación</p><h2>Arte alternativo</h2></div><button className="primary-button" onClick={generateArt} disabled={active || generating || remaining === 0}>{active || generating ? "Generando…" : remaining === 0 ? "Todo generado" : "Generar arte"}</button></div><p className="estimate"><strong>{unique}</strong> cartas únicas <i>·</i> <strong>{generated}</strong> ya generadas <i>·</i> <strong>{remaining}</strong> por generar <i>·</i> costo estimado <strong>USD {cost}</strong></p>{active && <ProgressBar completed={job.completed_cards} total={job.total_cards} failed={job.failed_cards} />}{notice && <div className={job?.status === "failed" || job?.failed_cards > 0 ? "generation-notice warning" : "generation-notice"}>{notice}</div>}{error && <div className="error-panel generation-error">{error}<br/><button className="secondary-button" onClick={() => setError("")}>Reintentar</button></div>}</section>
      <div className="cards-area">{Object.entries(sections).sort(([a],[b]) => (sectionOrder[a] ?? 1)-(sectionOrder[b] ?? 1)).map(([section, sectionCards]) => <section className="card-section" key={section}>{Object.keys(sections).length > 1 && <div className="section-heading"><h2>{sectionNames[section] || section}</h2><span>{sectionCards.length}</span></div>}<div className="cards-grid">{sectionCards.map((card) => <CardTile key={card.id} deckCard={card} onRegenerate={regenerateCard} />)}</div></section>)}</div>
    </section>
  );
}
