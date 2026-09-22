import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./DeckList.css";

function getErrorMessage(error) {
  return error.response?.data?.detail || "No se pudieron cargar tus mazos.";
}

export default function DeckList() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    async function loadDecks() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/decks/");
        if (active) setDecks(Array.isArray(response.data) ? response.data : response.data.results || []);
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDecks();
    return () => { active = false; };
  }, [reloadKey]);

  async function deleteDeck(event, deck) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`¿Eliminar “${deck.name}”? Esta acción no se puede deshacer.`)) return;
    setDeletingId(deck.id);
    setError("");
    try {
      await api.delete(`/decks/${deck.id}/`);
      setDecks((current) => current.filter((item) => item.id !== deck.id));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo eliminar el mazo.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="page-loading">Cargando…</div>;
  if (error && !decks.length) return <div className="error-panel">{error}<br /><button className="secondary-button" onClick={retry}>Reintentar</button></div>;

  return (
    <section className="deck-list-page">
      <div className="page-heading">
        <div><p className="eyebrow">Tu colección</p><h1>Mis mazos</h1><p>Elige un mazo para crear y revisar sus proxies.</p></div>
        <Link className="primary-button import-link" to="/importar">+ Importar mazo</Link>
      </div>
      {error && <div className="error-panel list-error">{error}</div>}
      {!decks.length ? (
        <div className="empty-state"><div className="empty-icon">◇</div><h2>Aún no hay mazos</h2><p>Importa una lista para comenzar a resolver cartas y generar arte.</p><Link className="primary-button" to="/importar">Importar mi primer mazo</Link></div>
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => {
            const count = deck.card_count ?? deck.total_cards ?? deck.cards?.length ?? 0;
            return (
              <Link className="deck-card" to={`/mazo/${deck.id}`} key={deck.id}>
                <div className="deck-card-accent" />
                <div className="deck-card-top"><span className="deck-label">MAZO</span><button className="delete-button" onClick={(event) => deleteDeck(event, deck)} disabled={deletingId === deck.id} aria-label={`Eliminar ${deck.name}`}>{deletingId === deck.id ? "…" : "Eliminar"}</button></div>
                <h2>{deck.name}</h2>
                <p className="deck-theme">{deck.theme || "Sin tema definido"}</p>
                <div className="deck-meta"><span>{count} {count === 1 ? "carta" : "cartas"}</span><span>{deck.created_at ? new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(deck.created_at)) : "Fecha no disponible"}</span></div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
