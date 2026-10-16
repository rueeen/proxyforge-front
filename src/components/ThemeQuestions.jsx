import { useId, useState } from "react";
import "./ThemeQuestions.css";

export default function ThemeQuestions({
  questions,
  initialAnswers = {},
  busy,
  onSubmit,
  onRegenerate,
  onCancel,
}) {
  const formId = useId();
  const [answers, setAnswers] = useState(() => Object.fromEntries(
    questions.map((question) => [question.id, {
      option_ids: [...(initialAnswers[question.id]?.option_ids || [])],
      other: initialAnswers[question.id]?.other || "",
    }])
  ));
  const [otherSelected, setOtherSelected] = useState(() => Object.fromEntries(
    questions.map((question) => [question.id, Boolean(initialAnswers[question.id]?.other)])
  ));
  const answered = Object.fromEntries(Object.entries(answers).filter(([, answer]) => (
    answer.option_ids.length > 0 || answer.other.trim()
  )));

  function selectOption(question, optionId, checked) {
    setAnswers((current) => {
      const answer = current[question.id];
      return {
        ...current,
        [question.id]: {
          option_ids: question.multiple
            ? checked ? [...answer.option_ids, optionId] : answer.option_ids.filter((id) => id !== optionId)
            : [optionId],
          other: question.multiple ? answer.other : "",
        },
      };
    });
    if (!question.multiple) {
      setOtherSelected((current) => ({ ...current, [question.id]: false }));
    }
  }

  function selectOther(question, selected, text = answers[question.id].other) {
    setOtherSelected((current) => ({ ...current, [question.id]: selected }));
    setAnswers((current) => ({
      ...current,
      [question.id]: {
        option_ids: selected && !question.multiple ? [] : current[question.id].option_ids,
        other: selected ? text : "",
      },
    }));
  }

  function submit(event) {
    event.preventDefault();
    if (!busy) {
      onSubmit(answered, { plan: event.nativeEvent.submitter?.value !== "save" });
    }
  }

  return (
    <form className="theme-questions" onSubmit={submit}>
      {questions.map((question) => {
        const answer = answers[question.id];
        const helpId = `${formId}-${question.id}-help`;
        return (
          <fieldset key={question.id} disabled={busy} aria-describedby={question.help ? helpId : undefined}>
            <legend>{question.question}</legend>
            {question.help && <p className="theme-question-help" id={helpId}>{question.help}</p>}
            <div className="theme-question-options">
              {question.options.map((option) => (
                <label className="theme-question-option" key={option.id}>
                  <input
                    className="theme-question-choice"
                    type={question.multiple ? "checkbox" : "radio"}
                    name={`${formId}-${question.id}`}
                    checked={answer.option_ids.includes(option.id)}
                    onChange={(event) => selectOption(question, option.id, event.target.checked)}
                  />
                  <span className="theme-question-card">
                    <strong>{option.label}</strong>
                    {option.detail && <small>{option.detail}</small>}
                  </span>
                </label>
              ))}
              {question.allow_other && (
                <div className="theme-question-other">
                  <label className="theme-question-option">
                    <input
                      className="theme-question-choice"
                      type={question.multiple ? "checkbox" : "radio"}
                      name={`${formId}-${question.id}`}
                      checked={Boolean(otherSelected[question.id])}
                      onChange={(event) => selectOther(question, event.target.checked)}
                    />
                    <span className="theme-question-card"><strong>Otra</strong></span>
                  </label>
                  <input
                    type="text"
                    aria-label={`Otra respuesta: ${question.question}`}
                    maxLength={200}
                    value={answer.other}
                    onChange={(event) => selectOther(question, true, event.target.value)}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              className="theme-plan-link"
              onClick={() => {
                setAnswers((current) => ({ ...current, [question.id]: { option_ids: [], other: "" } }));
                setOtherSelected((current) => ({ ...current, [question.id]: false }));
              }}
            >
              Limpiar
            </button>
          </fieldset>
        );
      })}
      <p role="status">{Object.keys(answered).length} de {questions.length} respondidas</p>
      <div className="theme-plan-actions">
        <button type="submit" value="plan" className="primary-button" disabled={busy}>Guardar y planificar</button>
        <button type="submit" value="save" className="secondary-button" disabled={busy}>Solo guardar</button>
        <button
          type="button"
          className="theme-plan-link"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Se generarán preguntas nuevas y se perderán las respuestas actuales.")) {
              onRegenerate();
            }
          }}
        >
          Nuevas preguntas
        </button>
        <button type="button" className="theme-plan-link" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
