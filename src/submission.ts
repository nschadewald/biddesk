import type { MissingDocument, SubmissionBlocker } from "./types";

/**
 * Whether a bid can be handed in, decided once.
 *
 * check_bid reports it, submit_bid acts on it, the submit button follows it,
 * and all three read this one function -- so "the check says fine, the
 * submit says no" cannot happen. A blocker is a fact about the bid: a
 * billable position with no price, a required document that has expired, a
 * required document not on file. Contingency positions are quoted apart and
 * never counted into the total, so an open one is a finding, not a blocker.
 *
 * What this deliberately is NOT: a confirmation. While a blocker exists the
 * dialog does not open and nothing waits for a click. The three ways out are
 * the ones the check names -- set the price yourself, let your agent derive
 * one and confirm it, state the document's date and confirm it -- and each of
 * them clears a blocker by changing the bid, never by overriding the check.
 */
export function submissionBlockers(input: {
  positions: { oz: string; text: string; contingency: boolean; my_unit_price: number | null }[];
  missingDocuments: MissingDocument[];
}): SubmissionBlocker[] {
  const blockers: SubmissionBlocker[] = [];

  for (const position of input.positions) {
    if (position.contingency || position.my_unit_price !== null) continue;
    blockers.push({ kind: "open_position", oz: position.oz, text: position.text });
  }

  for (const document of input.missingDocuments) {
    blockers.push(
      document.reason === "expired"
        ? {
            kind: "document_expired",
            doc_type: document.doc_type,
            label: document.label,
            valid_until: document.valid_until ?? ""
          }
        : {
            kind: "document_missing",
            doc_type: document.doc_type,
            label: document.label,
            valid_until: null
          }
    );
  }

  return blockers;
}
