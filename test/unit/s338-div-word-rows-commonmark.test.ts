import { COMMONMARK, describeLongWordDocuments } from "./support/s338-div-word";

// Session 338, part B (group g02, site 3): a fenced div opener whose bare word has 4,300,000 letters, under `from: commonmark`. See `s338-div-word-rows.test.ts` for the defect and for what the answer is.
describeLongWordDocuments(COMMONMARK);
