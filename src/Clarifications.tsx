import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCopy } from "./i18n";
import type { Clarification, Role } from "./types";
import { declareFormTool } from "./webmcp/registry";

/**
 * Asking the client a question, and reading what has been answered.
 *
 * The form carries `toolname`, so the browser derives a tool from the page
 * itself: no registration call, no second implementation, and one submit
 * handler serving a person and an agent alike. That is the declarative half of
 * WebMCP, and BidDesk offers both halves on purpose -- nine tools registered
 * imperatively because they do not map onto a form submission, and this one
 * because it does.
 *
 * Questions and answers are written by other parties. They are printed as text
 * and never rendered as markup, and the tool that returns them declares
 * untrustedContentHint. This is the prompt-injection boundary.
 */
export default function Clarifications({
  role,
  questions,
  onAsk,
  onAnswer
}: {
  role: Role;
  questions: Clarification[];
  onAsk: (input: { oz: string | null; question: string }) => Promise<unknown>;
  onAnswer: (questionId: string, answer: string) => Promise<unknown>;
}) {
  /**
   * The fields are UNCONTROLLED on purpose.
   *
   * When an agent uses this form, the browser writes into the inputs and then
   * submits. React never sees those writes, so a controlled input is reset to
   * its state value by the next render -- and any render will do, the live log
   * alone causes several. The submit then reads two empty fields and files
   * nothing, while the agent is told the form was submitted. Found by the eval
   * run: the tool reported success and no question ever arrived.
   */
  const copy = useCopy();
  const formRef = useRef<HTMLFormElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // The form IS the tool while it is on the page. Telling the registry keeps
  // the self-diagnosis honest about what the page offers, in both API styles.
  useEffect(() => {
    if (role !== "bidder") return;
    return declareFormTool({
      name: "ask_clarification",
      title: "Ask the client a question about the tender",
      readOnly: false
    });
  }, [role]);

  /**
   * One handler for a person and for an agent.
   *
   * `respondWith` has to be called while the submit event is still being
   * dispatched -- synchronously -- and handed a promise, not awaited first.
   * Awaiting the network call before calling it means the browser has already
   * answered the agent with its own placeholder ("pending form submission"),
   * and our result never arrives. Found by the eval run, not by reading.
   */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitEvent = event.nativeEvent as SubmitEvent;
    const data = new FormData(event.currentTarget);
    const text = String(data.get("question") ?? "").trim();
    const item = String(data.get("oz") ?? "").trim();

    if (text.length === 0) {
      const failure = { ok: false, error: "invalid_input", hint: "question is required." };
      // The agent gets the English error object; the person gets a sentence.
      setFailure(copy.clarifications.needsText);
      submitEvent.respondWith?.(Promise.resolve(failure));
      return;
    }

    // Clearing the fields is a courtesy to a person. To the browser, a reset
    // while an agent's submission is pending IS a cancellation -- it answers
    // the agent with "Tool execution cancelled by a form reset" and files
    // nothing. So the form is only cleared when a person submitted it.
    const byAgent = submitEvent.agentInvoked === true;

    const work = onAsk({ oz: item.length > 0 ? item : null, question: text }).then(
      (result) => {
        if (!byAgent) formRef.current?.reset();
        setFailure(null);
        return result;
      },
      (caught: unknown) => {
        const hint =
          caught instanceof Error ? caught.message : "The question could not be sent.";
        setFailure(copy.clarifications.sendFailed);
        return { ok: false, error: "ask_failed", hint };
      }
    );

    // Handed over at once, still pending. The browser resolves the agent's call
    // when it settles.
    submitEvent.respondWith?.(work);
    void work;
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <h3 className="text-base font-medium text-navy">
        {copy.clarifications.title}
      </h3>

      {role === "bidder" && (
      <form
        ref={formRef}
        className="card flex flex-wrap items-end gap-3 px-4 py-3"
        toolname="ask_clarification"
        tooldescription="Ask the client a question about the tender currently open, optionally about one position. The question is published to the client and, once answered, to every bidder, so never include prices or anything confidential."
        // Without toolautosubmit the browser fills the fields and then waits for
        // a person to press the button: the agent's call hangs and no question is
        // ever filed. Asking a question is an ordinary, reversible write, so the
        // agent may complete it. The one action that does need a hand -- handing
        // the bid in -- is not a form at all.
        toolautosubmit=""
        onSubmit={submit}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-muted" htmlFor="clarification-oz">
            {copy.clarifications.itemLabel}
          </label>
          <input
            id="clarification-oz"
            name="oz"
            placeholder={copy.clarifications.itemPlaceholder}
            toolparamdescription='The item number the question is about, for example "02.04". Leave empty for a question about the tender as a whole.'
            className="field h-9 w-28"
          />
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label className="text-xs text-ink-muted" htmlFor="clarification-question">
            {copy.clarifications.questionLabel}
          </label>
          <textarea
            id="clarification-question"
            name="question"
            required
            rows={2}
            maxLength={500}
            placeholder={copy.clarifications.questionPlaceholder}
            toolparamdescription="The question itself, at most 500 characters. Write it as a professional question to the client."
            className="field h-auto w-full py-2"
          />
        </div>
        <button type="submit" className="btn-secondary">
          {copy.clarifications.ask}
        </button>
      </form>
      )}

      {failure && <p className="text-xs text-ink-muted">{failure}</p>}

      {questions.length === 0 ? (
        <p className="text-xs text-ink-subtle">{copy.clarifications.none}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {questions.map((entry) => (
              <li key={entry.id} className="card px-4 py-3 text-[13px]">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
                  <span className="font-mono">{entry.id}</span>
                  {entry.oz ? <span>· {entry.oz}</span> : null}
                  <span>· {entry.bidder ?? copy.clarifications.unknownBidder}</span>
                  <span className="badge ml-auto">
                    {copy.clarifications.status[entry.status] ?? entry.status}
                  </span>
                </p>
                <p className="mt-1.5 text-ink">{entry.question}</p>
                {entry.answer && (
                  <p className="mt-1.5 border-l-2 border-line-strong pl-2 text-ink-muted">
                    <span className="text-ink-subtle">{copy.clarifications.clientAnswered}</span>
                    {entry.answer}
                  </p>
                )}
                {role === "client" && entry.answer === null && (
                  <AnswerBox questionId={entry.id} onAnswer={onAnswer} copy={copy} />
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-subtle">{copy.clarifications.fromOtherParties}</p>
        </>
      )}
    </section>
  );
}

/** The client answers once, and the answer goes to every bidder. */
function AnswerBox({
  questionId,
  onAnswer,
  copy
}: {
  questionId: string;
  onAnswer: (questionId: string, answer: string) => Promise<unknown>;
  copy: ReturnType<typeof useCopy>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-2 flex items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (answer.trim().length === 0) return;
        setBusy(true);
        try {
          await onAnswer(questionId, answer.trim());
          setAnswer("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor={`answer-${questionId}`}>
        {copy.clarifications.answerFor(questionId)}
      </label>
      <input
        id={`answer-${questionId}`}
        value={answer}
        maxLength={500}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder={copy.clarifications.answerPlaceholder}
        className="field h-8 min-w-64 flex-1 text-xs"
      />
      <button
        type="submit"
        disabled={busy}
        className="btn-secondary btn-sm"
      >
        {copy.clarifications.answer}
      </button>
    </form>
  );
}
