import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import CardTile from "../components/CardTile";
import ProxyCard from "../components/ProxyCard";
import ProgressBar from "../components/ProgressBar";
import ThemeQuestions from "../components/ThemeQuestions";
import FramingEditor from "../components/FramingEditor";
import WikiPanel from "../components/WikiPanel";
import "./DeckDetail.css";
import { canTryHost, fetchImageInBrowser } from "../browserImages";

const sectionOrder = { commander: 0, main: 1, sideboard: 2 };
const sectionNames = { commander: "Comandante", main: "Mazo principal", sideboard: "Sideboard" };

function referenceSummaryText(summary) {
  return `Encontradas: ${summary.found ?? 0} · No encontradas: ${summary.not_found ?? 0} · Descartadas: ${summary.rejected ?? 0} · Bloqueadas: ${summary.blocked ?? 0} · Errores: ${summary.error ?? 0}`;
}

function jobNotice(job) {
  const kind = job.kind || "images";
  if (job.status === "failed") {
    return job.error_message || (kind === "plan" ? "No se pudo crear el plan." : kind === "references" ? "No se pudieron buscar las referencias." : "La generación falló.");
  }
  if (job.status === "cancelled") {
    if (kind === "images" && job.failed_cards > 0) {
      return `${job.failed_cards} cartas fallaron, puedes regenerarlas individualmente.`;
    }
    return kind === "plan" ? "Planificación cancelada." : kind === "references" ? "Búsqueda de referencias cancelada." : "Generación cancelada.";
  }
  if (kind === "plan") {
    return "Plan temático listo.";
  }
  if (kind === "references") {
    return job.summary ? referenceSummaryText(job.summary) : "Búsqueda de referencias completada.";
  }
  return job.failed_cards > 0
    ? `${job.failed_cards} cartas fallaron, puedes regenerarlas individualmente.`
    : "Generación completada.";
}

export default function DeckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const autoInterviewHandled = useRef(null);
  const panelRequest = useRef(false);
  const browserBatchId = useRef(0);
  const [deck, setDeck] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [changingResolution, setChangingResolution] = useState(false);
  const [browserProgress, setBrowserProgress] = useState(null);
  const [browserSummary, setBrowserSummary] = useState(null);
  const [browserWarnings, setBrowserWarnings] = useState([]);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [symbols, setSymbols] = useState({});
  const [view, setView] = useState("art");
  const [framingCardId, setFramingCardId] = useState(null);
  const [adjustingFraming, setAdjustingFraming] = useState(false);
  const [framingSummary, setFramingSummary] = useState(null);
  const [changingLayout, setChangingLayout] = useState(false);
  const [searchingReferences, setSearchingReferences] = useState(false);
  const [updatingWiki, setUpdatingWiki] = useState(false);
  const [autoReferenceSummary, setAutoReferenceSummary] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [rewritingTexts, setRewritingTexts] = useState(false);
  const [rewriteSummary, setRewriteSummary] = useState(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [preparingQuestions, setPreparingQuestions] = useState(false);
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [questionsFailed, setQuestionsFailed] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [questionsVersion, setQuestionsVersion] = useState(0);
  const [editingAssignments, setEditingAssignments] = useState(0);
  const [regeneratingCards, setRegeneratingCards] = useState(0);

  useEffect(() => () => {
    browserBatchId.current += 1;
  }, [id]);

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
      setBrowserProgress(null);
      setBrowserSummary(null);
      setBrowserWarnings([]);
      panelRequest.current = false;
      setInterviewOpen(false);
      setFramingCardId(null);
      setFramingSummary(null);
      setRewriteSummary(null);
      setPanelError("");
      setAutoReferenceSummary(null);
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
  const active = jobStatus === "pending" || jobStatus === "running";
  const jobKind = job?.kind || "images";
  const planActive = active && jobKind === "plan";
  const referencesActive = active && jobKind === "references";
  const imagesActive = active && jobKind === "images";
  const busy = Boolean(browserProgress) || changingResolution || updatingWiki || rewritingTexts || adjustingFraming || searchingReferences || changingLayout || active || generating || planning || preparingQuestions || savingAnswers || editingAssignments > 0 || regeneratingCards > 0;

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
          setNotice(jobNotice(nextJob));
          if (nextJob.kind === "references") {
            setAutoReferenceSummary(nextJob.summary || null);
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
          setError(requestError.response?.data?.detail || "No se pudo actualizar el proceso.");
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
      acceptJob(response.data);
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

  async function changeLayout(cardLayout) {
    if (busy || panelRequest.current || cardLayout === (deck.card_layout || "borderless")) {
      return;
    }
    if (!window.confirm("Las cartas sin arte en este formato quedarán pendientes de generar. Las imágenes del otro formato se conservan.")) {
      return;
    }
    panelRequest.current = true;
    setChangingLayout(true);
    setError("");
    try {
      const response = await api.patch(`/decks/${id}/`, { card_layout: cardLayout });
      replacePanelDeck(response.data);
      await loadEstimate();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudo cambiar el formato del mazo.");
      if (requestError.response?.status === 409) {
        try {
          const loadedDeck = await loadDeck();
          setJob(loadedDeck.active_job);
        } catch {
          setNotice("No se pudo recuperar el proceso activo.");
        }
      }
    } finally {
      panelRequest.current = false;
      setChangingLayout(false);
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

  function replacePanelDeck(nextDeck) {
    setDeck(nextDeck);
    setJob(nextDeck.active_job);
  }

  async function handlePanelError(requestError, fallback) {
    const data = requestError.response?.data;
    setPanelError(data?.detail || data?.answers?.[0] || fallback);
    if (requestError.response?.status === 409) {
      try {
        const loadedDeck = await loadDeck();
        setJob(loadedDeck.active_job);
      } catch {
        setNotice("No se pudo recuperar el proceso activo.");
      }
    }
  }

  function acceptJob(nextJob) {
    setJob(nextJob);
    setNotice("");
    setError("");
    setAutoReferenceSummary(null);
  }

  async function requestThemePlan() {
    const response = await api.post(`/decks/${id}/theme-plan/`, {
      overwrite_edited: false,
    });
    acceptJob(response.data);
  }

  async function createThemePlan({ confirm = true } = {}) {
    if (panelRequest.current || busy) {
      return;
    }
    if (confirm && deck.has_theme_plan && !deck.theme_plan_stale && !window.confirm(
      "Se reasignarán las cartas no editadas a mano. Las imágenes de cartas cuyo elemento cambie quedarán pendientes."
    )) {
      return;
    }
    panelRequest.current = true;
    setPlanning(true);
    setPanelError("");
    try {
      await requestThemePlan();
      setInterviewOpen(false);
    } catch (requestError) {
      await handlePanelError(requestError, "No se pudo crear el plan temático.");
    } finally {
      panelRequest.current = false;
      setPlanning(false);
    }
  }

  async function prepareQuestions() {
    if (panelRequest.current || busy) {
      return;
    }
    panelRequest.current = true;
    setPreparingQuestions(true);
    setQuestionsFailed(false);
    setPanelError("");
    try {
      const response = await api.post(`/decks/${id}/theme-questions/`);
      replacePanelDeck(response.data);
      setQuestionsVersion((version) => version + 1);
    } catch (requestError) {
      setQuestionsFailed(true);
      await handlePanelError(requestError, "No se pudieron preparar las preguntas.");
    } finally {
      panelRequest.current = false;
      setPreparingQuestions(false);
    }
  }

  function openInterview() {
    if (busy || panelRequest.current) {
      return;
    }
    setPanelError("");
    setInterviewOpen(true);
    if (!deck.theme_questions?.length) {
      prepareQuestions();
    }
  }

  async function submitAnswers(answers, { plan }) {
    if (panelRequest.current || busy) {
      return;
    }
    panelRequest.current = true;
    setSavingAnswers(true);
    setPanelError("");
    try {
      const response = await api.put(`/decks/${id}/theme-answers/`, { answers });
      replacePanelDeck(response.data);
      if (plan) {
        setSavingAnswers(false);
        setPlanning(true);
        await requestThemePlan();
      }
      setInterviewOpen(false);
    } catch (requestError) {
      await handlePanelError(requestError, "No se pudieron guardar las respuestas o crear el plan temático.");
    } finally {
      panelRequest.current = false;
      setSavingAnswers(false);
      setPlanning(false);
    }
  }

  useEffect(() => {
    if (loading || busy || !deck || !estimate || !location.state?.openInterview || autoInterviewHandled.current === location.key) {
      return;
    }
    autoInterviewHandled.current = location.key;
    navigate(location.pathname, { replace: true, state: null });
    if (!deck.has_theme_plan) {
      setInterviewOpen(true);
      if (!deck.theme_questions?.length && !panelRequest.current) {
        prepareQuestions();
      }
    }
  }, [loading, busy, deck, estimate, location, navigate]);

  async function saveAssignment(cardId, assignment) {
    setEditingAssignments((count) => count + 1);
    try {
      const response = await api.patch(`/cards/${cardId}/theme-assignment/`, assignment);
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      await Promise.all([loadEstimate(), loadDeck()]);
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  async function addReference(cardId, { file, url }) {
    setEditingAssignments((count) => count + 1);
    try {
      let body;
      if (file) {
        body = new FormData();
        body.append("file", file);
      } else {
        body = { url };
      }
      const response = await api.post(`/cards/${cardId}/theme-assignment/references/`, body);
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      await Promise.all([loadEstimate(), loadDeck()]);
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  async function loadWikiImages(cardId, wiki, page) {
    const response = await api.get(`/cards/${cardId}/theme-assignment/wiki-images/`, {
      params: { wiki: wiki || undefined, page: page || undefined },
    });
    return response.data;
  }

  async function pickWikiImage(cardId, file, wiki) {
    setEditingAssignments((count) => count + 1);
    try {
      const response = await api.post(`/cards/${cardId}/theme-assignment/references/wiki/`, { file, wiki });
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      await Promise.all([loadEstimate(), loadDeck()]);
      return response.data;
    } finally {
      // Preserve blocked/full_url on the original error for the picker.
      setEditingAssignments((count) => count - 1);
    }
  }

  async function removeReference(cardId, referenceId) {
    setEditingAssignments((count) => count + 1);
    try {
      const response = await api.delete(`/cards/${cardId}/theme-assignment/references/${referenceId}/`);
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      await Promise.all([loadEstimate(), loadDeck()]);
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  function canSearchReferences() {
    return deck.reference_wiki_confirmed || deck.cards.some((card) => (
      card.theme_assignment?.edited && card.theme_assignment.reference_wiki?.trim()
    ));
  }

  async function searchAutoReferences(force = false) {
    if (busy || panelRequest.current || !canSearchReferences()) {
      return;
    }
    const failedIds = deck.cards.filter((card) => (
      card.theme_assignment?.needs_reference &&
      ["not_found", "rejected", "error"].includes(card.theme_assignment.auto_reference_status)
    )).map((card) => card.id);
    if (force && failedIds.length === 0) {
      return;
    }
    panelRequest.current = true;
    setSearchingReferences(true);
    setAutoReferenceSummary(null);
    setPanelError("");
    try {
      const body = force ? { force: true, deck_card_ids: failedIds } : { force: false };
      const response = await api.post(`/decks/${id}/auto-references/`, body);
      acceptJob(response.data);
    } catch (requestError) {
      await handlePanelError(requestError, "No se pudieron buscar las referencias automáticas.");
    } finally {
      panelRequest.current = false;
      setSearchingReferences(false);
    }
  }

  async function updateWikiConfiguration(method, path, body) {
    if (busy || panelRequest.current) {
      return;
    }
    panelRequest.current = true;
    setUpdatingWiki(true);
    try {
      const response = await api.request({ method, url: path, data: body });
      replacePanelDeck(response.data);
      setAutoReferenceSummary(null);
      await loadEstimate();
      return response.data;
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        try {
          const loadedDeck = await loadDeck();
          setJob(loadedDeck.active_job);
        } catch {
          setNotice("No se pudo recuperar el proceso activo.");
        }
      }
      throw requestError;
    } finally {
      panelRequest.current = false;
      setUpdatingWiki(false);
    }
  }

  async function findWikiCandidates() {
    return updateWikiConfiguration("post", `/decks/${id}/wiki-candidates/`);
  }

  async function confirmWiki(domain, altDomain) {
    return updateWikiConfiguration("put", `/decks/${id}/reference-wiki/`, {
      domain,
      alt_domain: altDomain,
    });
  }

  async function unconfirmWiki() {
    return updateWikiConfiguration("delete", `/decks/${id}/reference-wiki/`);
  }

  async function changeReferenceCount(n) {
    return updateWikiConfiguration("patch", `/decks/${id}/`, { auto_reference_count: n });
  }

  async function retryAutoReference(cardId) {
    setEditingAssignments((count) => count + 1);
    setAutoReferenceSummary(null);
    try {
      const response = await api.post(`/cards/${cardId}/theme-assignment/auto-reference/`, { force: true });
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      // The DeckCard response does not contain the deck-level reference counts.
      await Promise.all([loadEstimate(), loadDeck()]);
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  async function rewriteTexts() {
    if (busy || panelRequest.current) {
      return;
    }
    if (!window.confirm("Se reescribirán el nombre temático y el flavor de las cartas ya generadas, en el idioma configurado. El arte no cambia ni se regenera.")) {
      return;
    }
    panelRequest.current = true;
    setRewritingTexts(true);
    setRewriteSummary(null);
    setPanelError("");
    try {
      const response = await api.post(`/decks/${id}/rewrite-texts/`);
      replacePanelDeck(response.data);
      setRewriteSummary(response.data.rewrite_summary);
    } catch (requestError) {
      await handlePanelError(requestError, "No se pudieron reescribir los textos.");
    } finally {
      panelRequest.current = false;
      setRewritingTexts(false);
    }
  }

  async function changeResolution(imageResolution) {
    if (busy || panelRequest.current) return;
    panelRequest.current = true;
    setChangingResolution(true);
    setError("");
    try {
      const response = await api.patch(`/decks/${id}/`, { image_resolution: imageResolution });
      replacePanelDeck(response.data);
      await loadEstimate();
    } catch (requestError) {
      await handlePanelError(requestError, "No se pudo cambiar la resolución.");
    } finally {
      panelRequest.current = false;
      setChangingResolution(false);
    }
  }

  async function uploadBrowserReferences(cardId, files, urls, mode = "pick") {
    setEditingAssignments((count) => count + 1);
    try {
      const body = new FormData();
      files.forEach((file, index) => {
        body.append("files", file);
        body.append("source_urls", urls[index]);
      });
      body.append("mode", mode);
      const response = await api.post(`/cards/${cardId}/theme-assignment/references/browser/`, body);
      setDeck((current) => String(current?.id) === String(id)
        ? { ...current, cards: current.cards.map((card) => card.id === cardId ? response.data : card) }
        : current);
      if (mode === "pick") {
        await Promise.all([loadDeck(), loadEstimate()]);
        setNotice("Descargada desde tu navegador ✓");
      }
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  async function completeBlockedReferences() {
    if (busy || panelRequest.current) return;
    const blockedCards = deck.cards.filter((card) => card.theme_assignment?.auto_reference_status === "blocked");
    const batchId = ++browserBatchId.current;
    panelRequest.current = true;
    setBrowserSummary(null);
    setBrowserWarnings([]);
    setError("");
    const summary = { completed: 0, invalid: 0, unavailable: 0 };
    const blockedWikis = new Set();
    const warnedHosts = new Set();
    try {
      for (const [index, card] of blockedCards.entries()) {
        const assignment = card.theme_assignment;
        const wiki = assignment.reference_wiki || deck.reference_wiki;
        setBrowserProgress({ current: index + 1, completed: index, total: blockedCards.length, element: assignment.element });
        if (blockedWikis.has(wiki)) {
          summary.unavailable += 1;
          continue;
        }
        try {
          const data = await loadWikiImages(card.id, wiki, assignment.reference_page);
          if (batchId !== browserBatchId.current) return;
          const preferred = (image) => !image.maybe_fan_art && Math.max(image.width, image.height) >= 600;
          const candidates = [...data.images].sort((a, b) => Number(preferred(b)) - Number(preferred(a))).slice(0, (deck.auto_reference_count || 1) + 2);
          const files = [];
          const urls = [];
          let cors = false;
          let unavailable = false;
          for (const candidate of candidates) {
            for (const url of [...new Set([candidate.full_url, candidate.thumb_url])]) {
              if (!url) continue;
              if (!canTryHost(url)) {
                cors = true;
                unavailable = true;
                const host = new URL(url).host;
                if (!warnedHosts.has(host)) {
                  warnedHosts.add(host);
                  setBrowserWarnings((current) => [...current, `${host} tampoco permite descargas desde el navegador; usa "Elegir imagen de la wiki" y pega con Ctrl+V en esas cartas.`]);
                }
                continue;
              }
              try {
                const file = await fetchImageInBrowser(url);
                if (batchId !== browserBatchId.current) return;
                files.push(file);
                urls.push(candidate.full_url || url);
                break;
              } catch (downloadError) {
                if (batchId !== browserBatchId.current) return;
                if (!/Formato|10 MB/.test(downloadError.message)) unavailable = true;
                if (downloadError.message === "cors") {
                  cors = true;
                  const host = new URL(url).host;
                  if (!warnedHosts.has(host)) {
                    warnedHosts.add(host);
                    setBrowserWarnings((current) => [...current, `${host} tampoco permite descargas desde el navegador; usa "Elegir imagen de la wiki" y pega con Ctrl+V en esas cartas.`]);
                  }
                }
              }
            }
          }
          if (files.length) {
            const updated = await uploadBrowserReferences(card.id, files, urls, "auto");
            if (batchId !== browserBatchId.current) return;
            if (updated.theme_assignment?.references?.length) summary.completed += 1;
            else summary.invalid += 1;
          } else {
            if (cors) blockedWikis.add(wiki);
            if (unavailable) summary.unavailable += 1;
            else summary.invalid += 1;
          }
        } catch (requestError) {
          if (batchId !== browserBatchId.current) return;
          if (requestError.response?.status === 409) {
            await handlePanelError(requestError, "Hay un job activo.");
            throw requestError;
          }
          summary.invalid += 1;
        }
        setBrowserProgress({ current: index + 1, completed: index + 1, total: blockedCards.length, element: assignment.element });
      }
      setBrowserSummary(summary);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudieron completar las referencias bloqueadas.");
    } finally {
      if (batchId !== browserBatchId.current) return;
      try {
        const [loadedDeck] = await Promise.all([loadDeck(), loadEstimate()]);
        setJob(loadedDeck.active_job);
      } catch (requestError) {
        setError(requestError.response?.data?.detail || "No se pudo actualizar el mazo.");
      }
      panelRequest.current = false;
      setBrowserProgress(null);
    }
  }

  async function saveFraming(cardId, { offsetX, offsetY, zoom }) {
    setEditingAssignments((count) => count + 1);
    try {
      const response = await api.patch(`/cards/${cardId}/framing/`, {
        offset_x: offsetX,
        offset_y: offsetY,
        zoom,
      });
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      setFramingSummary(null);
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  async function autoFraming(cardId) {
    setEditingAssignments((count) => count + 1);
    try {
      const response = await api.post(`/cards/${cardId}/framing/auto/`);
      setDeck((current) => ({
        ...current,
        cards: current.cards.map((card) => card.id === cardId ? response.data : card),
      }));
      setFramingSummary(null);
      return response.data;
    } finally {
      setEditingAssignments((count) => count - 1);
    }
  }

  async function autoFrameDeck() {
    if (busy || panelRequest.current) {
      return;
    }
    panelRequest.current = true;
    setAdjustingFraming(true);
    setFramingSummary(null);
    setError("");
    try {
      const response = await api.post(`/decks/${id}/framing/auto/`);
      replacePanelDeck(response.data);
      setFramingSummary(response.data.framing_summary);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "No se pudieron ajustar los encuadres.");
      if (requestError.response?.status === 409) {
        try {
          const loadedDeck = await loadDeck();
          setJob(loadedDeck.active_job);
        } catch {
          setNotice("No se pudo recuperar el proceso activo.");
        }
      }
    } finally {
      panelRequest.current = false;
      setAdjustingFraming(false);
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

  const failedAutoReferences = deck.cards.filter((card) => (
    card.theme_assignment?.needs_reference &&
    ["not_found", "rejected", "error"].includes(card.theme_assignment.auto_reference_status)
  ));
  const blockedReferenceCards = deck.cards.filter((card) => card.theme_assignment?.auto_reference_status === "blocked");
  const framingCard = deck.cards.find((card) => card.id === framingCardId);
  const warning = jobStatus === "failed" || jobStatus === "cancelled" || (jobKind === "images" && job?.failed_cards > 0);

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
          <WikiPanel
            key={id}
            deck={deck}
            busy={busy}
            onFindCandidates={findWikiCandidates}
            onConfirm={confirmWiki}
            onUnconfirm={unconfirmWiki}
            onChangeCount={changeReferenceCount}
          />
          {interviewOpen ? (
            preparingQuestions ? null : deck.theme_questions?.length ? (
              <ThemeQuestions
                key={`${id}-${questionsVersion}`}
                questions={deck.theme_questions}
                initialAnswers={deck.theme_answers || {}}
                busy={busy}
                onSubmit={submitAnswers}
                onRegenerate={prepareQuestions}
                onCancel={() => setInterviewOpen(false)}
              />
            ) : (
              <>
                <p>{questionsFailed ? "No se pudieron cargar las preguntas." : "Tu tema no necesita aclaraciones."}</p>
                <div className="theme-plan-actions">
                  {questionsFailed ? (
                    <button type="button" className="secondary-button" disabled={busy} onClick={prepareQuestions}>Reintentar preguntas</button>
                  ) : (
                    <button type="button" className="primary-button" disabled={busy} onClick={() => createThemePlan({ confirm: false })}>Planificar ahora</button>
                  )}
                  <button type="button" className="theme-plan-link" disabled={busy} onClick={() => setInterviewOpen(false)}>Cerrar</button>
                </div>
              </>
            )
          ) : !deck.has_theme_plan ? (
            <>
              <p>Antes de planificar, Claude puede hacerte unas preguntas sobre el tema para personalizar el mazo.</p>
              <div className="theme-plan-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={deck.theme_brief?.length ? () => createThemePlan() : openInterview}
                >
                  {deck.theme_brief?.length ? "Planificar con mis respuestas" : "Responder preguntas"}
                </button>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => createThemePlan()}>Planificar sin preguntas</button>
                {Boolean(deck.theme_brief?.length) && (
                  <button type="button" className="theme-plan-link" disabled={busy} onClick={openInterview}>Editar respuestas</button>
                )}
              </div>
            </>
          ) : (
            <>
              {planActive ? null : deck.theme_plan_stale ? (
                <p className="theme-plan-warning" role="status">Cambiaste tus respuestas después del último plan.</p>
              ) : <p>Plan temático listo.</p>}
              <div className="theme-plan-actions">
                <button type="button" className="secondary-button" disabled={busy} onClick={() => createThemePlan()}>Rehacer plan</button>
                <button type="button" className="theme-plan-link" disabled={busy} onClick={openInterview}>Editar respuestas</button>
              </div>
            </>
          )}
          {planActive && (
            <div className="plan-job-progress" aria-label="Progreso del plan">
              <p role="status">{job.stage || "Planificando cartas…"}</p>
              <ProgressBar completed={job.completed_cards} total={job.total_cards} />
              <p>Puedes seguir mirando el mazo; se actualizará al terminar.</p>
            </div>
          )}
          {!interviewOpen && Boolean(deck.theme_brief?.length) && (
            <ul className="theme-brief" aria-label="Resumen de respuestas">
              {deck.theme_brief.map((item, index) => {
                const shortQuestion = item.question.replace(/[¿?]/g, "").replace(/^(Qué|Quién|Cómo)\s+/i, "").trim();
                return (
                  <li key={`${item.question}-${index}`}>
                    <strong>{shortQuestion.length > 60 ? item.question : shortQuestion}</strong>: {item.answer}
                  </li>
                );
              })}
            </ul>
          )}
          {((deck.has_theme_plan && deck.auto_reference_counts?.needed > 0) || referencesActive || (jobKind === "references" && autoReferenceSummary) || blockedReferenceCards.length > 0 || browserProgress || browserSummary) && (
            <div className="auto-reference-panel">
              <p>
                <strong>{deck.auto_reference_counts?.needed ?? 0}</strong> cartas con personajes u objetos icónicos · {" "}
                <strong>{deck.auto_reference_counts?.with_reference ?? 0}</strong> con referencia
              </p>
              {deck.auto_reference_counts?.pending > 0 ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || !canSearchReferences()}
                  onClick={() => searchAutoReferences()}
                >
                  Buscar referencias automáticas ({deck.auto_reference_counts.pending})
                </button>
              ) : failedAutoReferences.length > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || !canSearchReferences()}
                  onClick={() => searchAutoReferences(true)}
                >
                  Reintentar fallidas
                </button>
              )}
              {blockedReferenceCards.length > 0 && (
                <button type="button" className="secondary-button" disabled={busy} onClick={completeBlockedReferences}>
                  Completar bloqueadas desde el navegador ({blockedReferenceCards.length})
                </button>
              )}
              {browserProgress && (
                <div role="status">
                  <p>Completando {browserProgress.current} de {browserProgress.total}: {browserProgress.element}</p>
                  <ProgressBar completed={browserProgress.completed} total={browserProgress.total} />
                </div>
              )}
              {browserSummary && <p role="status">Completadas: {browserSummary.completed} · Sin imágenes válidas: {browserSummary.invalid} · El navegador no pudo descargar: {browserSummary.unavailable}</p>}
              {browserWarnings.map((warning) => <p key={warning}>{warning}</p>)}
              {!canSearchReferences() && <p>Confirma primero la wiki del mazo</p>}
              {referencesActive && (
                <div className="reference-job-progress" aria-label="Progreso de referencias">
                  <p role="status">{job.stage || "Buscando imágenes en la wiki…"}</p>
                  <ProgressBar completed={job.completed_cards} total={job.total_cards} />
                </div>
              )}
              {autoReferenceSummary && (
                <p className="auto-reference-summary" role="status">
                  {referenceSummaryText(autoReferenceSummary)}
                </p>
              )}
              {autoReferenceSummary?.blocked > 0 && (
                <p>Las wikis de Fandom bloquean descargas automáticas. En esas cartas, abre la wiki desde el enlace y pega la imagen con Ctrl+V.</p>
              )}
              <p>Si no buscas antes, las referencias se buscan solas al generar cada tanda.</p>
            </div>
          )}
          {(preparingQuestions || savingAnswers) && (
            <div className="planning-status" role="status">
              <span className="spinner" />
              {preparingQuestions ? "Preparando preguntas según tu mazo…" : "Guardando respuestas…"}
            </div>
          )}
          {deck.cards.some((card) => card.generated_image) && (
            <div className="rewrite-texts-panel">
              <button type="button" className="secondary-button" disabled={busy} onClick={rewriteTexts}>
                Reescribir nombres y flavor
              </button>
              {rewritingTexts && (
                <div className="planning-status" role="status">
                  <span className="spinner" />
                  Reescribiendo textos…
                </div>
              )}
              {rewriteSummary && (
                <p role="status">Actualizadas: {rewriteSummary.updated} · Sin cambios: {rewriteSummary.skipped}</p>
              )}
            </div>
          )}
          {panelError && <div className="error-panel generation-error" role="alert">{panelError}</div>}
        </div>
        <div className="generation-copy">
          <div>
            <p className="eyebrow">Generación</p>
            <h2>Arte alternativo</h2>
          </div>
          <button
            className="primary-button"
            onClick={generateArt}
            disabled={busy || interviewOpen || estimate.to_generate === 0}
          >
            {imagesActive || generating
              ? "Generando…"
              : estimate.to_generate === 0 ? "Todo generado" : `Generar siguientes ${estimate.batch_size}`}
          </button>
        </div>
        <div className="deck-resolution-control">
          <label>Resolución
            <select aria-label="Resolución" value={deck.image_resolution || "1k"} disabled={busy} onChange={(event) => changeResolution(event.target.value)}>
              <option value="1k">1K</option>
              <option value="2k">2K</option>
            </select>
          </label>
          <p>2K: más nitidez para imprimir y hacer zoom (~USD 0,02 más por imagen). Afecta solo a las imágenes nuevas o regeneradas.</p>
        </div>
        {(deck.card_layout || "borderless") === "borderless" && (
          <div className="deck-framing-panel">
            <button type="button" className="secondary-button" disabled={busy} onClick={autoFrameDeck}>
              Auto-encuadrar mazo
            </button>
            {adjustingFraming && (
              <div className="planning-status" role="status">
                <span className="spinner" />
                Ajustando encuadres…
              </div>
            )}
            {framingSummary && (
              <p role="status">Ajustadas: {framingSummary.adjusted} · Sin cambios: {framingSummary.unchanged} · Sin rostro: {framingSummary.no_face}</p>
            )}
            <p>No modifica las cartas que ajustaste a mano.</p>
          </div>
        )}
        <p className="estimate">
          Esta tanda: <strong>{estimate.batch_size}</strong> cartas <i>·</i>{" "}
          <strong>USD {estimate.batch_cost_usd.toFixed(2)}</strong>
          {estimate.reference_cost_usd > 0 && <span> (incluye USD {estimate.reference_cost_usd.toFixed(2)} en referencias)</span>}
        </p>
        <p className="full-deck-estimate">Mazo completo: USD {estimate.estimated_cost_usd.toFixed(2)}</p>
        {imagesActive && (
          <div className="image-job-progress" aria-label="Progreso de imágenes">
            <ProgressBar
              completed={job.completed_cards}
              total={job.total_cards}
              failed={job.failed_cards}
            />
            {job.stage && <p role="status">{job.stage}</p>}
          </div>
        )}
        {notice && !(jobKind === "references" && jobStatus === "done" && autoReferenceSummary) && (
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
        <label className="deck-layout-select">
          Formato
          <select
            aria-label="Formato"
            value={deck.card_layout || "borderless"}
            onChange={(event) => changeLayout(event.target.value)}
            disabled={busy}
          >
            <option value="borderless">Sin borde</option>
            <option value="classic">Clásico</option>
          </select>
        </label>
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
                    layout={deck.card_layout || "borderless"}
                    onRegenerate={regenerateCard}
                    onSaveAssignment={saveAssignment}
                    onAddReference={addReference}
                    onRemoveReference={removeReference}
                    onRetryAutoReference={retryAutoReference}
                    onLoadWikiImages={loadWikiImages}
                    onPickWikiImage={pickWikiImage}
                    onUploadBrowserReferences={uploadBrowserReferences}
                    disabled={busy}
                  />
                ) : (
                  <div className="framing-card-wrap" key={card.id}>
                    <ProxyCard
                      deckCard={card}
                      symbols={symbols}
                      layout={deck.card_layout || "borderless"}
                      nameMode="themed"
                    />
                    {(deck.card_layout || "borderless") === "borderless" && card.generated_image?.image_url && (
                      <button
                        type="button"
                        className="framing-card-button secondary-button"
                        disabled={busy}
                        onClick={() => setFramingCardId(card.id)}
                        aria-label={`Encuadre de ${card.card?.name || card.raw_name}`}
                      >
                        Encuadre
                      </button>
                    )}
                  </div>
                )
              ))}
            </div>
          </section>
        ))}
      </div>
      {view === "card" && (deck.card_layout || "borderless") === "borderless" && framingCard?.generated_image?.image_url && (
        <FramingEditor
          key={framingCard.id}
          deckCard={framingCard}
          symbols={symbols}
          layout="borderless"
          busy={busy}
          onSave={(framing) => saveFraming(framingCard.id, framing)}
          onAuto={() => autoFraming(framingCard.id)}
          onClose={() => setFramingCardId(null)}
        />
      )}
    </section>
  );
}
