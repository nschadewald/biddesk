import { useRef, useState } from "react";
import { parseGaeb } from "./gaeb";
import { useCopy } from "./i18n";
import { importFromFile } from "./store";

/**
 * Where a bill of quantities comes from.
 *
 * Seed data proves the interaction; a file proves the entrance. In practice a
 * bill of quantities never comes out of our database — it arrives as GAEB DA XML
 * from the client's AVA software, and this is that path.
 *
 * Parsing happens in the browser: the file is the visitor's, and it has no
 * reason to travel anywhere before they have decided to import it.
 *
 * There is no tool for this on purpose. Creating a tender is the client's act,
 * and no agent here can perform it.
 */
export default function ImportDropZone() {
  const copy = useCopy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const parsed = parseGaeb(await file.text());
      const result = await importFromFile(parsed);
      setMessage(copy.importZone.imported(result.positions, result.tender_id));
    } catch (caught) {
      // The parser names what went wrong with a code, so the reason can be
      // said in the reader's language instead of in the parser's.
      const code = caught instanceof Error ? (caught as { code?: string }).code : undefined;
      setMessage((code && copy.importZone.error[code]) ?? copy.importZone.failed);
    } finally {
      setBusy(false);
      setOver(false);
    }
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        void take(event.dataTransfer.files[0]);
      }}
      className={
        over
          ? "rounded-lg border border-dashed border-navy-500 bg-elev px-3 py-2 text-xs"
          : "rounded-lg border border-dashed border-line-strong px-3 py-2 text-xs"
      }
    >
      <span className="text-ink-muted">
        {busy ? copy.importZone.reading : copy.importZone.prompt}
      </span>{" "}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="text-ink-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
      >
        {copy.importZone.orChoose}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".x83,.X83,.xml,application/xml,text/xml"
        className="hidden"
        onChange={(event) => {
          void take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {message && <p className="mt-1 text-ink">{message}</p>}
    </section>
  );
}
