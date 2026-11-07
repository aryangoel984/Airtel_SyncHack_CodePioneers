// Segment names used in the lead file <-> short codes used in the catalogue.
// Map the lead file's segment names to the catalogue's short codes.
// Segment is only a recommendation hint (not a blocking rule).
export const SEGMENT_CODES: Record<string, string> = {
  "Micro retail & services": "micro",
  "Professional offices": "prof",
  "Small manufacturers": "mfg",
  "Small multi-site businesses": "multi",
};
export const segmentCode = (s: string) => SEGMENT_CODES[s] ?? s;
/** Reverse lookup: catalogue code -> lead segment name (accepts a name as well). */
export const segmentName = (s: string) =>
  Object.keys(SEGMENT_CODES).find((name) => name === s || SEGMENT_CODES[name] === s);

