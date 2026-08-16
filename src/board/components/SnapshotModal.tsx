import React from "react";
import toast from "react-hot-toast";
import { Textarea } from "../../components/ui/Input";
import { DebugSnapshotImportResult } from "../../debug/stateSnapshot";
import { copyTextToClipboard } from "../../utils/clipboard";

type SnapshotModalProps = {
  getCurrentSnapshotText: () => string;
  onClose: () => void;
  onLoadSnapshot: (raw: string) => DebugSnapshotImportResult;
};

export default function SnapshotModal({
  getCurrentSnapshotText,
  onClose,
  onLoadSnapshot,
}: SnapshotModalProps) {
  const [snapshotText, setSnapshotText] = React.useState(() =>
    getCurrentSnapshotText()
  );

  const refreshSnapshot = () => {
    setSnapshotText(getCurrentSnapshotText());
  };

  const copySnapshot = async () => {
    const nextText = getCurrentSnapshotText();
    setSnapshotText(nextText);

    try {
      await copyTextToClipboard(nextText);
      toast.success("Snapshot copied");
    } catch (error) {
      console.error("Failed to copy the snapshot", error);
      toast.error("Could not copy the snapshot");
    }
  };

  const loadSnapshot = () => {
    const result = onLoadSnapshot(snapshotText);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onClose();
  };

  return (
    <div className="snapshot-modal flex w-[min(680px,92vw)] flex-col gap-3">
      <div className="text-[11px] leading-[1.45] text-win-text-subtle">
        Capture the current table, camera, selection, and shape state. Paste a
        snapshot back here later to replay the same setup.
      </div>
      <Textarea
        className="min-h-[240px] w-full resize-y p-2 font-[Courier_New,Lucida_Console,monospace] text-[10px] leading-[1.45]"
        aria-label="Snapshot JSON"
        spellCheck={false}
        value={snapshotText}
        onChange={(event) => setSnapshotText(event.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="modal-button win-button px-4 py-2"
          type="button"
          onClick={refreshSnapshot}
        >
          Refresh
        </button>
        <button
          className="modal-button win-button px-4 py-2"
          type="button"
          onClick={() => {
            void copySnapshot();
          }}
        >
          Copy Current
        </button>
        <button
          className="modal-button win-button px-4 py-2"
          type="button"
          onClick={loadSnapshot}
        >
          Load Snapshot
        </button>
      </div>
    </div>
  );
}
