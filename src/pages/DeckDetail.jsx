import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import CardTile from "../components/CardTile";
import ProxyCard from "../components/ProxyCard";
import ProgressBar from "../components/ProgressBar";
import "./DeckDetail.css";

const sectionOrder = { commander: 0, main: 1, sideboard: 2 };
const sectionNames = { commander: "Comandante", main: "Mazo principal", sideboard: "Sideboard" };

export default function DeckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [symbols, setSymbols] = useState({});
  const [view, setView] = useState("art");
  const [planning, setPlanning] = useState(false);
  const [editingAssignments, setEditingAssignments] = useState(0);
  const [regeneratingCards, setRegeneratingCards] = useState(0);

  const loadDeck = useCallback(async (signal) => {
    const response = await api.get(`/decks/${id}/`, { signal });
    setDeck(response.data);
    return response.data;
  }, [id]);

  const loadEstimate = useCallback(async (signal) => {
    const response = await api.get(`/decks/${id}/estimate/`, { signal });
    setEstimate(response.data);
    return response.data;
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      setLoading(true);
      setError("");
      setNotice("");
      setDeck(null);
      setEstimate(null);
      setJob(null);
      try {
        const [loadedDeck] = await Promise.all([
          loadDeck(controller.signal),
          loadEstimate(controller.signal),
          api.get("/symbology/", { signal: controller.signal }).then((response) => {
            const symbolMap = Object.fromEntries(response.data.map((item) => [item.symbol, item.svg_uri]));
            if (!controller.signal.aborted) {
              setSymbols(symbolMap);
            }
          }).catch(() => {
            if (!controller.signal.aborted) {
              setSymbols({});
            }
          }),
        ]);
        if (!controller.signal.aborted) {
          setJob(loadedDeck.active_job);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.detail || "No se pudo cargar el mazo.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPage();
    return () => {
      controller.abort();
    };
  }, [loadDeck, loadEstimate, reloadKey]);

  const jobId = job?.id;
  const jobStatus = job?.status;

  useEffect(() => {
    if (jobStatus !== "pending" && jobStatus !== "running") {
      return undefined;
    }

    const controller = new AbortController();
    let polling = false;
    let finished = false;

    async function pollJob() {
      if (polling || finished) {
        return;
      }
      polling = true;
      try {
        const response = await api.get(`/jobs/${jobId}/`, {
          signal: controller.signal,
        });
        const nextJob = response.data;
        const terminal = ["done", "failed", "cancelled"].includes(nextJob.status);

        if (terminal) {
          finished = true;
          clearInterval(interval);
          if (nextJob.status === "failed") {
            setNotice(nextJob.error_message || "La generación falló.");
          } else if (nextJob.failed_cards > 0) {
            setNotice(`${nextJob.failed_cards} cartas fallaron, puedes regenerarlas individualmente.`);
          } else if (nextJob.status === "cancelled") {
            setNotice("Generación cancelada.");
          } else {
            setNotice("Generación completada.");
          }
          try {
            await Promise.all([
              loadDeck(controller.signal),
              loadEstimate(controller.signal),
            ]);
          } finally {
            if (!controller.signal.aborted) {
              setJob(nextJob);
            }
          }
        } else {
          setJob(nextJob);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.detail || "No se pudo actualizar la generación.");
        }
      } finally {
        polling = false;
      }
    }

    const interval = setInterval(pollJob, 2000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [jobId, jobStatus, loadDeck, loadEstimate]);

  async function generateArt() {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(`/decks/${id}/generate/`, {});
      setJob(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo iniciar la generación.");
      if (requestError.response?.status === 409) {
        try {
          const loadedDeck = await loadDeck();
          setJob(loadedDeck.active_job);
        } catch (reloadError) {
          setNotice(reloadError.response?.data?.detail || "No se pudo recuperar el proceso activo.");
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateCard(cardId) {
    setRegeneratingCards((count) => count + 1);
    try {
      const response = await api.post(`/cards/${cardId}/regenerate/`, {});
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      await loadEstimate();
    } finally {
      setRegeneratingCards((count) => count - 1);
    }
  }

  async function createThemePlan() {
    if (deck.has_theme_plan && !window.confirm(
      "Se reasignarán las cartas no editadas a mano. Las imágenes de cartas cuyo elemento cambie quedarán pendientes."
    )) {
      return;
    }
    setPlanning(true);
    setError("");
    try {
      const response = await api.post(`/decks/${id}/theme-plan/`, {
        overwrite_edited: false,
      });
      setDeck(response.data);
      setJob(response.data.active_job);
      await loadEstimate();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo crear el plan temático.");
      if (requestError.response?.status === 409) {
        try {
          const loadedDeck = await loadDeck();
          setJob(loadedDeck.active_job);
        } catch (reloadError) {
          setNotice(reloadError.response?.data?.detail || "No se pudo recuperar el proceso activo.");
        }
      }
    } finally {
      setPlanning(false);
    }
  }

  async function saveAssignment(cardId, assignment) {
    setEditingAssignments((count) => count + 1);
    try {
      const response = await api.patch(`/cards/${cardId}/theme-assignment/`, assignment);
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      await loadEstimate();
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  const sections = useMemo(() => {
    if (!deck) {
      return [];
    }
    const cards = [...deck.cards].sort((a, b) => {
      const sectionDifference = sectionOrder[a.section] - sectionOrder[b.section];
      const firstName = a.card?.name ?? a.raw_name;
      const secondName = b.card?.name ?? b.raw_name;
      return sectionDifference || firstName.localeCompare(secondName, "es");
    });
    const groups = {};
    for (const card of cards) {
      if (!groups[card.section]) {
        groups[card.section] = [];
      }
      groups[card.section].push(card);
    }
    return Object.entries(groups);
  }, [deck]);

  if (loading) {
    return <div className="page-loading">Cargando…</div>;
  }

  if (!deck || !estimate) {
    return (
      <div className="error-panel">
        {error}
        <br />
        <button
          className="secondary-button"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const active = jobStatus === "pending" || jobStatus === "running";
  const busy = active || generating || planning || editingAssignments > 0 || regeneratingCards > 0;
  const warning = jobStatus === "failed" || jobStatus === "cancelled" || job?.failed_cards > 0;

  return (
    <section className="detail-page">
      <button className="back-button" onClick={() => navigate(-1)}>
        ← Volver
      </button>
      <header className="deck-header">
        <div>
          <div className="header-tags">
            <span className="theme-badge">{deck.theme}</span>
            <span>{deck.card_count} cartas</span>
          </div>
          <h1>{deck.name}</h1>
        </div>
      </header>
      <section className="generation-panel">
        <div className="theme-plan-panel">
          <p>
            {deck.has_theme_plan
              ? "Plan temático listo."
              : "Aún no hay plan temático. Se creará automáticamente al generar, o puedes crearlo ahora para revisarlo antes de gastar en imágenes."}
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={createThemePlan}
            disabled={busy}
          >
            {deck.has_theme_plan ? "Rehacer plan" : "Crear plan temático"}
          </button>
          {planning && (
            <div className="planning-status" role="status">
              <span className="spinner" />
              Planificando cartas según el tema…
            </div>
          )}
        </div>
        <div className="generation-copy">
          <div>
            <p className="eyebrow">Generación</p>
            <h2>Arte alternativo</h2>
          </div>
          <button
            className="primary-button"
            onClick={generateArt}
            disabled={busy || estimate.to_generate === 0}
          >
            {active || generating
              ? "Generando…"
              : estimate.to_generate === 0 ? "Todo generado" : `Generar siguientes ${estimate.batch_size}`}
          </button>
        </div>
        <p className="estimate">
          Esta tanda: <strong>{estimate.batch_size}</strong> cartas <i>·</i>{" "}
          <strong>USD {estimate.batch_cost_usd.toFixed(2)}</strong>
        </p>
        <p className="full-deck-estimate">Mazo completo: USD {estimate.estimated_cost_usd.toFixed(2)}</p>
        {active && (
          <ProgressBar
            completed={job.completed_cards}
            total={job.total_cards}
            failed={job.failed_cards}
          />
        )}
        {notice && (
          <div className={warning ? "generation-notice warning" : "generation-notice"}>
            {notice}
          </div>
        )}
        {error && <div className="error-panel generation-error">{error}</div>}
      </section>
      <div className="deck-view-controls">
        <div role="group" aria-label="Vista del mazo" className="view-tabs">
          <button type="button" aria-pressed={view === "art"} onClick={() => setView("art")}>
            Arte
          </button>
          <button type="button" aria-pressed={view === "card"} onClick={() => setView("card")}>
            Carta
          </button>
        </div>
        <Link className="secondary-button print-link" to={`/mazo/${id}/imprimir`}>Imprimir</Link>
      </div>
      <div className="cards-area">
        {sections.map(([section, sectionCards]) => (
          <section className="card-section" key={section}>
            {sections.length > 1 && (
              <div className="section-heading">
                <h2>{sectionNames[section]}</h2>
                <span>{sectionCards.length}</span>
              </div>
            )}
            <div className={view === "art" ? "cards-grid" : "proxy-cards-grid"}>
              {sectionCards.map((card) => (
                view === "art" ? (
                  <CardTile
                    key={card.id}
                    deckCard={card}
                    onRegenerate={regenerateCard}
                    onSaveAssignment={saveAssignment}
                    disabled={busy}
                  />
                ) : (
                  <ProxyCard key={card.id} deckCard={card} symbols={symbols} />
                )
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
