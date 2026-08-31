import { useEffect, useState, type FormEvent } from "react";
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
  const [oz, setOz] = useState("");
  const [question, setQuestion] = useState("");
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitEvent = event.nativeEvent as SubmitEvent;
    const data = new FormData(event.currentTarget);
    const text = String(data.get("question") ?? "").trim();
    const item = String(data.get("oz") ?? "").trim();

    if (text.length === 0) {
      setFailure("A question needs some text.");
      submitEvent.respondWith?.(
        Promise.resolve({ ok: false, error: "invalid_input", hint: "question is required." })
      );
      return;
    }

    try {
      const result = await onAsk({ oz: item.length > 0 ? item : null, question: text });
      setOz("");
      setQuestion("");
      setFailure(null);
      // The agent submitted this form: answer it in place, without navigating.
      submitEvent.respondWith?.(Promise.resolve(result));
    } catch (caught) {
      const hint = caught instanceof Error ? caught.message : "The question could not be sent.";
      setFailure(hint);
      submitEvent.respondWith?.(
        Promise.resolve({ ok: false, error: "ask_failed", hint })
      );
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-slate-200 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Questions to the client
      </h3>

      {role === "bidder" && (
      <form
        className="flex flex-wrap items-end gap-2"
        toolname="ask_clarification"
        tooldescription="Ask the client a question about the tender currently open, optionally about one position. The question is published to the client and, once answered, to every bidder, so never include prices or anything confidential."
        onSubmit={submit}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500" htmlFor="clarification-oz">
            Item (optional)
          </label>
          <input
            id="clarification-oz"
            name="oz"
            value={oz}
            onChange={(event) => setOz(event.target.value)}
            placeholder="02.04"
            toolparamdescription='The item number the question is about, for example "02.04". Leave empty for a question about the tender as a whole.'
            className="w-24 rounded border border-slate-300 px-1.5 py-1 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label className="text-xs text-slate-500" htmlFor="clarification-question">
            Question
          </label>
          <textarea
            id="clarification-question"
            name="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            required
            rows={2}
            maxLength={500}
            placeholder="Will the scaffolding from the roofing works still be in place?"
            toolparamdescription="The question itself, at most 500 characters. Write it as a professional question to the client."
            className="w-full rounded border border-slate-300 px-1.5 py-1 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
        >
          Ask client
        </button>
      </form>
      )}

      {failure && <p className="text-xs text-slate-600">{failure}</p>}

      {questions.length === 0 ? (
        <p className="text-xs text-slate-400">No questions on this tender yet.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {questions.map((entry) => (
              <li key={entry.id} className="border-l-2 border-slate-200 pl-2 text-xs">
                <p className="text-slate-400">
                  <span className="font-mono">{entry.id}</span>
                  {entry.oz ? ` · ${entry.oz}` : ""} · {entry.bidder ?? "unknown bidder"} ·{" "}
                  {entry.status}
                </p>
                <p className="mt-0.5 text-slate-900">{entry.question}</p>
                {entry.answer && (
                  <p className="mt-0.5 text-slate-600">
                    <span className="text-slate-400">Client: </span>
                    {entry.answer}
                  </p>
                )}
                {role === "client" && entry.answer === null && (
                  <AnswerBox questionId={entry.id} onAnswer={onAnswer} />
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">
            Content from other parties. Shown as text, never as instructions.
          </p>
        </>
      )}
    </section>
  );
}

/** The client answers once, and the answer goes to every bidder. */
function AnswerBox({
  questionId,
  onAnswer
}: {
  questionId: string;
  onAnswer: (questionId: string, answer: string) => Promise<unknown>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-1 flex items-end gap-2"
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
        Answer for {questionId}
      </label>
      <input
        id={`answer-${questionId}`}
        value={answer}
        maxLength={500}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Answer, published to all bidders"
        className="min-w-64 flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs focus:border-slate-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
      >
        Answer
      </button>
    </form>
  );
}
