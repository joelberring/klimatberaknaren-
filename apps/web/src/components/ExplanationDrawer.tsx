import {
  LABELS,
  type CalculationExplanation
} from "../../../../packages/shared/src";

interface ExplanationDrawerProps {
  explanation: CalculationExplanation | null;
  onClose: () => void;
}

export function ExplanationDrawer({ explanation, onClose }: ExplanationDrawerProps) {
  if (!explanation) {
    return null;
  }

  return (
    <aside className="explanation-drawer" aria-label="Metodpanel">
      <div className="explanation-header">
        <div>
          <p className="eyebrow">Metod och verifiering</p>
          <h2>{explanation.title}</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          Stäng
        </button>
      </div>

      <section className="explanation-block">
        <strong>Sammanfattning</strong>
        <p>{explanation.summary}</p>
      </section>

      <section className="explanation-block">
        <strong>Formel</strong>
        <p>{explanation.formulaText}</p>
      </section>

      <section className="explanation-block">
        <strong>Beräkningssteg</strong>
        <ul className="drawer-list">
          {explanation.calculationSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="explanation-block">
        <strong>Indata och härledningar</strong>
        <ul className="drawer-list">
          {explanation.inputs.map((input) => (
            <li key={`${explanation.id}-${input.key}`}>
              <span>{input.label}: {input.value}</span>
              <em>{input.source === "user" ? "Användarinmatning" : input.source === "derived" ? "Härlett" : input.source === "default" ? "Default" : "Referensdata"}</em>
            </li>
          ))}
        </ul>
      </section>

      {explanation.defaultsApplied.length ? (
        <section className="explanation-block">
          <strong>Defaults som användes</strong>
          <ul className="drawer-list">
            {explanation.defaultsApplied.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="explanation-block">
        <strong>Källor och stöd</strong>
        <ul className="drawer-list">
          {explanation.evidence.map((evidence) => (
            <li key={evidence.methodId}>
              <a href={evidence.url} target="_blank" rel="noreferrer">
                {evidence.title}
              </a>
              <span>
                {LABELS.evidenceType[evidence.evidenceType]} • {evidence.publisher} • {evidence.versionOrYear}
              </span>
              <p className="microcopy">{evidence.citationShort}</p>
            </li>
          ))}
        </ul>
      </section>

      {explanation.limitations.length ? (
        <section className="explanation-block">
          <strong>Begränsningar</strong>
          <ul className="drawer-list">
            {explanation.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
