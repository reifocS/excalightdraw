import type Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { create } from "zustand";
import {
  createSyncClient,
  isPeerSyncEnvelope,
  type SyncEnvelope,
} from "@vescofire/peersync";
import { createPeerJsTransport } from "@vescofire/peersync/peerjs";
import { createShapesSyncChannel } from "./shapesChannel";
import {
  createConnectionLifecycle,
  type PeerConnectionPhase,
} from "./connectionLifecycle";
import {
  isValidPeerId,
  normalizeDiscoveredPeerIds,
} from "./syncValidation";

export type Message<TPayload = unknown> = SyncEnvelope<string, TPayload>;

export type MessageCallback<TPayload = unknown> = (
  message: Message<TPayload>,
  peerId: string
) => void;

export interface PeerState {
  peer: Peer | null;
  connections: Map<string, DataConnection>;
  connectionStates: Map<string, PeerConnectionPhase>;
  error: Error | null;
  initPeer: () => () => void;
  connectToPeer: (peerId: string) => void;
  sendMessage: (message: Message, peerId?: string) => void;
  disconnect: (peerId?: string) => void;
  onMessage: <TPayload = unknown>(
    type: string,
    callback: MessageCallback<TPayload>
  ) => () => void;
}

const toError = (error: unknown) => {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error("Unknown peer sync error");
};

const setPeerError = (nextError: Error) => {
  usePeerStore.setState((state) => {
    if (state.error?.message === nextError.message) {
      return state;
    }
    return { error: nextError };
  });
};

let connectionLifecycle: ReturnType<typeof createConnectionLifecycle> | null =
  null;

const syncTransport = createPeerJsTransport({
  onPeerReady: (peer) => {
    usePeerStore.setState({ peer, error: null });
  },
  onPeerDestroyed: () => {
    connectionLifecycle?.stop();
    usePeerStore.setState({ peer: null, connections: new Map() });
  },
  onConnectionsChanged: (connections) => {
    usePeerStore.setState({ connections: new Map(connections) });
  },
  onError: (error) => {
    setPeerError(error);
  },
});

const syncClient = createSyncClient({
  roomId: "maginet",
  transport: syncTransport,
});

let coreHandlersRegistered = false;
let channelPluginsRegistered = false;
const runtimeLeases = new Set<symbol>();

const setConnectionPhase = (
  peerId: string,
  phase: PeerConnectionPhase | null
) => {
  usePeerStore.setState((state) => {
    const currentPhase = state.connectionStates.get(peerId);
    if (phase === null && currentPhase === undefined) return state;
    if (phase !== null && currentPhase === phase) return state;

    const connectionStates = new Map(state.connectionStates);
    if (phase === null) {
      connectionStates.delete(peerId);
    } else {
      connectionStates.set(peerId, phase);
    }
    return { connectionStates };
  });
};

connectionLifecycle = createConnectionLifecycle({
  connect: (peerId) => syncClient.connect(peerId),
  isConnected: (peerId) => usePeerStore.getState().connections.has(peerId),
  isActive: () => runtimeLeases.size > 0,
  onPhaseChange: setConnectionPhase,
  onError: (error) => setPeerError(toError(error)),
  retryDelayOffsetMs: (peerId) => {
    const localPeerId = usePeerStore.getState().peer?.id;
    if (!localPeerId) return 0;
    return localPeerId.localeCompare(peerId) > 0 ? 1_000 : 0;
  },
});

const ensureCoreHandlers = () => {
  if (coreHandlersRegistered) return;
  coreHandlersRegistered = true;

  syncClient.onConnectionOpen((connectedPeerId) => {
    connectionLifecycle?.handleOpen(connectedPeerId);
    const { connections, peer } = usePeerStore.getState();
    const connectedPeers = Array.from(connections.keys()).filter(
      (peerId) => peerId !== connectedPeerId
    );

    syncClient.send(
      {
        type: "peer-sync",
        payload: { connectedPeers },
      },
      connectedPeerId
    );

    if (!peer?.id) return;

    syncClient.send(
      {
        type: "connected",
        payload: { peerId: peer.id },
      },
      connectedPeerId
    );
  });

  syncClient.onConnectionClose((connectedPeerId) => {
    connectionLifecycle?.handleClose(connectedPeerId);
  });

  syncClient.onMessage("peer-sync", (message) => {
    if (!isPeerSyncEnvelope(message)) return;

    const discoveredPeerIds = normalizeDiscoveredPeerIds(
      message.payload.connectedPeers
    );
    if (!discoveredPeerIds) return;

    const { connections, peer } = usePeerStore.getState();
    discoveredPeerIds.forEach((peerId) => {
      if (!connections.has(peerId) && peer?.id !== peerId) {
        usePeerStore.getState().connectToPeer(peerId);
      }
    });
  });
};

const ensureChannelPlugins = () => {
  if (channelPluginsRegistered) return;
  channelPluginsRegistered = true;
  syncClient.registerChannel(
    createShapesSyncChannel({
      getLocalPeerId: () => usePeerStore.getState().peer?.id ?? null,
    })
  );
};

const startPeerRuntime = () => {
  ensureCoreHandlers();
  ensureChannelPlugins();
  void syncClient.start().catch((error) => {
    setPeerError(toError(error));
  });
};

const stopPeerRuntime = () => {
  connectionLifecycle?.stop();
  void syncClient.stop().catch((error) => {
    setPeerError(toError(error));
  });
};

const acquirePeerRuntimeLease = () => {
  const leaseId = Symbol("peer-runtime-lease");
  runtimeLeases.add(leaseId);
  startPeerRuntime();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    runtimeLeases.delete(leaseId);
    if (runtimeLeases.size === 0) {
      stopPeerRuntime();
    }
  };
};

export const usePeerStore = create<PeerState>((_, get) => ({
  peer: null,
  connections: new Map(),
  connectionStates: new Map(),
  error: null,

  initPeer: () => {
    return acquirePeerRuntimeLease();
  },

  connectToPeer: (peerId: string) => {
    const targetPeerId = peerId.trim();
    if (!isValidPeerId(targetPeerId)) {
      setPeerError(new Error("That peer ID is not valid."));
      return;
    }

    const { peer } = get();
    if (peer?.id === targetPeerId) {
      setPeerError(new Error("That peer ID is your own."));
      return;
    }
    connectionLifecycle?.request(targetPeerId);
  },

  sendMessage: (message: Message, peerId?: string) => {
    try {
      syncClient.send(message, peerId);
    } catch (error) {
      setPeerError(toError(error));
    }
  },

  disconnect: (peerId?: string) => {
    if (peerId) {
      connectionLifecycle?.cancel(peerId);
      void syncClient.disconnect(peerId).catch((error) => {
        setPeerError(toError(error));
      });
      return;
    }

    runtimeLeases.clear();
    stopPeerRuntime();
  },

  onMessage: (type: string, callback) => {
    return syncClient.onMessage(type, callback as MessageCallback);
  },
}));
