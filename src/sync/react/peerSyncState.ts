import toast from "react-hot-toast";
import type { Shape } from "../../types/canvas";
import type { ActionLogEntry } from "../../board/ActionLog";
import { MAX_ACTION_LOG_ENTRIES } from "../../board/constants/game";
import { describeRandomEvent, logActionToConsole } from "../../utils/game";
import { usePeerStore } from "./peerStore";
import {
  normalizeActionLogEntry,
  normalizeActionLogSnapshot,
  normalizeConnectedPayload,
  normalizeHeartbeatPayload,
  normalizeRandomEventPayload,
  type SyncedActionLogEntry,
} from "./syncValidation";

export type PeerSyncUiState = {
  receivedDataMap: Record<string, Shape[]>;
  peerPresence: Record<string, number>;
  peerNames: Record<string, string>;
  actionLog: SyncedActionLogEntry[];
};

const INITIAL_PEER_SYNC_UI_STATE: PeerSyncUiState = {
  receivedDataMap: {},
  peerPresence: {},
  peerNames: {},
  actionLog: [],
};

let peerSyncUiState = INITIAL_PEER_SYNC_UI_STATE;

const peerSyncUiListeners = new Set<() => void>();

export const subscribePeerSyncUiState = (listener: () => void) => {
  peerSyncUiListeners.add(listener);
  return () => {
    peerSyncUiListeners.delete(listener);
  };
};

export const getPeerSyncUiStateSnapshot = () => peerSyncUiState;

const setPeerSyncUiState = (
  updater: (prev: PeerSyncUiState) => PeerSyncUiState
) => {
  const next = updater(peerSyncUiState);
  if (next === peerSyncUiState) return;
  peerSyncUiState = next;
  peerSyncUiListeners.forEach((listener) => listener());
};

export const setPeerShapes = (peerId: string, data: Shape[]) => {
  setPeerSyncUiState((prev) => {
    const current = prev.receivedDataMap[peerId];
    if (current === data) return prev;
    return {
      ...prev,
      receivedDataMap: {
        ...prev.receivedDataMap,
        [peerId]: data,
      },
    };
  });
};

export const setPeerPresenceTimestamp = (peerId: string, timestamp: number) => {
  setPeerSyncUiState((prev) => {
    if (prev.peerPresence[peerId] === timestamp) return prev;
    return {
      ...prev,
      peerPresence: {
        ...prev.peerPresence,
        [peerId]: timestamp,
      },
    };
  });
};

export const setPeerName = (peerId: string, name: string) => {
  setPeerSyncUiState((prev) => {
    if (!name || prev.peerNames[peerId] === name) return prev;
    return {
      ...prev,
      peerNames: {
        ...prev.peerNames,
        [peerId]: name,
      },
    };
  });
};

export const mergeActionLogEntries = (
  current: SyncedActionLogEntry[],
  incoming: SyncedActionLogEntry[]
) => {
  const byId = new Map<string, SyncedActionLogEntry>();
  current.forEach((entry) => byId.set(entry.eventId, entry));
  let changed = false;
  incoming.forEach((entry) => {
    if (byId.has(entry.eventId)) return;
    byId.set(entry.eventId, entry);
    changed = true;
  });
  if (!changed) return current;
  return Array.from(byId.values())
    .sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        left.eventId.localeCompare(right.eventId)
    )
    .slice(-MAX_ACTION_LOG_ENTRIES);
};

const addNormalizedActionLogEntries = (entries: SyncedActionLogEntry[]) => {
  if (entries.length === 0) return [];
  const knownIds = new Set(
    getPeerSyncUiStateSnapshot().actionLog.map((entry) => entry.eventId)
  );
  const additions = entries.filter((entry) => {
    if (knownIds.has(entry.eventId)) return false;
    knownIds.add(entry.eventId);
    return true;
  });
  if (additions.length === 0) return [];
  setPeerSyncUiState((prev) => {
    const actionLog = mergeActionLogEntries(prev.actionLog, additions);
    if (actionLog === prev.actionLog) return prev;
    return {
      ...prev,
      actionLog,
    };
  });
  return additions;
};

export const addActionLogEntry = (entry: ActionLogEntry) => {
  const normalized = normalizeActionLogEntry(entry);
  if (!normalized) return null;
  const [added] = addNormalizedActionLogEntries([normalized]);
  if (!added) return null;
  logActionToConsole(added);
  return added;
};

let messageSubscriptionsRegistered = false;

export const ensurePeerSyncMessageSubscriptions = () => {
  if (messageSubscriptionsRegistered) return;
  messageSubscriptionsRegistered = true;

  const onMessage = usePeerStore.getState().onMessage;

  onMessage("connected", (message, fromPeerId) => {
    const connected = normalizeConnectedPayload(message.payload, fromPeerId);
    if (!connected) return;

    toast(`Peer connected: ${connected.peerId}`, {
      id: `peer-connected:${connected.peerId}`,
    });

    setPeerPresenceTimestamp(connected.peerId, Date.now());

    if (connected.name) {
      setPeerName(connected.peerId, connected.name);
    }

    const { peer, sendMessage } = usePeerStore.getState();
    const ownActionLogEntries = getPeerSyncUiStateSnapshot()
      .actionLog.filter((entry) => entry.playerId === peer?.id)
      .slice(-20);
    if (peer?.id && ownActionLogEntries.length > 0) {
      sendMessage(
        {
          type: "action-log-snapshot",
          payload: { entries: ownActionLogEntries },
        },
        connected.peerId
      );
    }
  });

  onMessage("heartbeat", (message, fromPeerId) => {
    const heartbeat = normalizeHeartbeatPayload(message.payload, fromPeerId);
    if (!heartbeat) return;
    setPeerPresenceTimestamp(heartbeat.peerId, heartbeat.timestamp);
    if (heartbeat.name) {
      setPeerName(heartbeat.peerId, heartbeat.name);
    }
  });

  onMessage("action-log", (message, fromPeerId) => {
    const incoming = normalizeActionLogEntry(message.payload, { fromPeerId });
    if (!incoming) return;
    const [added] = addNormalizedActionLogEntries([incoming]);
    if (added) logActionToConsole(added);
  });

  onMessage("random-event", (message, fromPeerId) => {
    const event = normalizeRandomEventPayload(message.payload, fromPeerId);
    if (!event) return;

    addActionLogEntry({
      playerId: event.peerId,
      playerName: event.playerName,
      action: describeRandomEvent(event),
      cardsInHand: event.cardsInHand,
      timestamp: event.timestamp,
    });
  });

  onMessage("action-log-snapshot", (message, fromPeerId) => {
    const entries = normalizeActionLogSnapshot(message.payload, fromPeerId);
    if (!entries) return;
    const additions = addNormalizedActionLogEntries(entries);
    additions.forEach((entry) => logActionToConsole(entry, "Action Snapshot"));
  });

};
