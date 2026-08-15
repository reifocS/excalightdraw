import { describe, expect, it } from "vitest";
import { mergeActionLogEntries } from "./peerSyncState";
import { normalizeActionLogEntry } from "./syncValidation";

const createEntry = (action: string, timestamp: number) => {
  const entry = normalizeActionLogEntry(
    {
      playerId: "peer-a",
      action,
      cardsInHand: 4,
      timestamp,
    },
    { now: timestamp }
  );
  if (!entry) throw new Error("Could not create action log fixture");
  return entry;
};

describe("peer sync action log", () => {
  it("deduplicates snapshots and sorts entries deterministically", () => {
    const later = createEntry("later", 2_000);
    const earlier = createEntry("earlier", 1_000);

    const merged = mergeActionLogEntries([], [later, earlier]);
    expect(merged.map((entry) => entry.action)).toEqual(["earlier", "later"]);

    const withDuplicateSnapshot = mergeActionLogEntries(merged, [
      { ...earlier },
      { ...later },
    ]);
    expect(withDuplicateSnapshot).toBe(merged);
    expect(withDuplicateSnapshot).toHaveLength(2);
  });
});
