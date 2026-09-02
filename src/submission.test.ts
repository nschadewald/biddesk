import { expect, it } from "vitest";
import { submissionBlockers } from "./submission";

const position = (
  oz: string,
  my_unit_price: number | null,
  contingency = false,
  text = `Position ${oz}`
) => ({ oz, text, contingency, my_unit_price });

it("names an open billable position and an expired document as blockers, in that order", () => {
  const blockers = submissionBlockers({
    positions: [
      position("01.01", 480),
      position("03.04", null, false, "Radiators incl. pipes"),
      position("04.02", null, true)
    ],
    missingDocuments: [
      {
        doc_type: "tax_clearance",
        label: "Tax clearance certificate",
        valid_until: "2026-08-12",
        reason: "expired"
      }
    ]
  });

  expect(blockers).toEqual([
    { kind: "open_position", oz: "03.04", text: "Radiators incl. pipes" },
    {
      kind: "document_expired",
      doc_type: "tax_clearance",
      label: "Tax clearance certificate",
      valid_until: "2026-08-12"
    }
  ]);
});

it("does not block on a contingency position alone", () => {
  // 04.02 is open, and it is a contingency position: quoted apart, never in
  // the total, so it does not stand between the draft and the dialog.
  expect(
    submissionBlockers({
      positions: [position("01.01", 480), position("04.02", null, true)],
      missingDocuments: []
    })
  ).toEqual([]);
});

it("blocks on a required document that is not on file at all", () => {
  // Colorpoint holds no reference project in the seed. A required document
  // that is missing keeps the bid from going out as much as an expired one.
  expect(
    submissionBlockers({
      positions: [position("01.01", 480)],
      missingDocuments: [
        { doc_type: "reference_project", label: "Reference project", valid_until: null, reason: "not_held" }
      ]
    })
  ).toEqual([
    { kind: "document_missing", doc_type: "reference_project", label: "Reference project", valid_until: null }
  ]);
});

it("returns nothing for a complete bid with valid documents", () => {
  expect(
    submissionBlockers({ positions: [position("01.01", 480)], missingDocuments: [] })
  ).toEqual([]);
});
