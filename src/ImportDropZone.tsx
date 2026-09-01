import { useRef, useState } from "react";
import { parseGaeb } from "./gaeb";
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
      setMessage(
        `Imported ${result.positions} position${result.positions === 1 ? "" : "s"} as ${result.tender_id}. Price it from your price book.`
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "That file could not be read.");
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
          ? "rounded border border-dashed border-slate-500 bg-slate-50 px-3 py-2 text-xs"
          : "rounded border border-dashed border-slate-300 px-3 py-2 text-xs"
      }
    >
      <span className="text-slate-600">
        {busy
          ? "Reading the file…"
          : "Drop a GAEB DA XML file (.x83 / .X83) here to import a bill of quantities"}
      </span>{" "}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="underline hover:text-slate-900 disabled:opacity-50"
      >
        or choose one
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
      {message && <p className="mt-1 text-slate-700">{message}</p>}
    </section>
  );
}
