export type PeerConnectionPhase =
  | "connecting"
  | "connected"
  | "retrying"
  | "failed";

type Timer = ReturnType<typeof globalThis.setTimeout>;

export type ConnectionLifecycleOptions = {
  connect: (peerId: string) => Promise<void>;
  isConnected: (peerId: string) => boolean;
  isActive: () => boolean;
  onPhaseChange: (
    peerId: string,
    phase: PeerConnectionPhase | null
  ) => void;
  onError?: (error: unknown) => void;
  connectionTimeoutMs?: number;
  retryBaseDelayMs?: number;
  retryMaximumDelayMs?: number;
  maximumAttempts?: number;
  retryDelayOffsetMs?: (peerId: string) => number;
};

export const createConnectionLifecycle = ({
  connect,
  isConnected,
  isActive,
  onPhaseChange,
  onError,
  connectionTimeoutMs = 12_000,
  retryBaseDelayMs = 750,
  retryMaximumDelayMs = 15_000,
  maximumAttempts = 5,
  retryDelayOffsetMs = () => 0,
}: ConnectionLifecycleOptions) => {
  const desiredPeerIds = new Set<string>();
  const phases = new Map<string, PeerConnectionPhase>();
  const attemptCounts = new Map<string, number>();
  const connectionTimeouts = new Map<string, Timer>();
  const retryTimers = new Map<string, Timer>();

  const setPhase = (peerId: string, phase: PeerConnectionPhase | null) => {
    if (phase === null) {
      if (!phases.delete(peerId)) return;
    } else {
      if (phases.get(peerId) === phase) return;
      phases.set(peerId, phase);
    }
    onPhaseChange(peerId, phase);
  };

  const clearConnectionTimeout = (peerId: string) => {
    const timer = connectionTimeouts.get(peerId);
    if (timer !== undefined) globalThis.clearTimeout(timer);
    connectionTimeouts.delete(peerId);
  };

  const clearRetryTimer = (peerId: string) => {
    const timer = retryTimers.get(peerId);
    if (timer !== undefined) globalThis.clearTimeout(timer);
    retryTimers.delete(peerId);
  };

  const clearTimers = (peerId: string) => {
    clearConnectionTimeout(peerId);
    clearRetryTimer(peerId);
  };

  const scheduleRetry = (peerId: string) => {
    clearTimers(peerId);
    if (!desiredPeerIds.has(peerId) || !isActive()) {
      setPhase(peerId, null);
      return;
    }
    if (isConnected(peerId)) {
      attemptCounts.set(peerId, 0);
      setPhase(peerId, "connected");
      return;
    }

    const attemptCount = attemptCounts.get(peerId) ?? 0;
    if (attemptCount >= maximumAttempts) {
      setPhase(peerId, "failed");
      onError?.(
        new Error(
          `Could not connect to peer ${peerId} after ${maximumAttempts} attempts`
        )
      );
      return;
    }

    const delay =
      Math.min(
        retryMaximumDelayMs,
        retryBaseDelayMs * 2 ** Math.max(0, attemptCount - 1)
      ) + Math.max(0, retryDelayOffsetMs(peerId));
    setPhase(peerId, "retrying");
    retryTimers.set(
      peerId,
      globalThis.setTimeout(() => {
        retryTimers.delete(peerId);
        beginAttempt(peerId);
      }, delay)
    );
  };

  function beginAttempt(peerId: string) {
    if (!desiredPeerIds.has(peerId) || !isActive()) {
      setPhase(peerId, null);
      return;
    }
    if (isConnected(peerId)) {
      attemptCounts.set(peerId, 0);
      setPhase(peerId, "connected");
      return;
    }
    if (phases.get(peerId) === "connecting") return;

    clearTimers(peerId);
    attemptCounts.set(peerId, (attemptCounts.get(peerId) ?? 0) + 1);
    setPhase(peerId, "connecting");

    connectionTimeouts.set(
      peerId,
      globalThis.setTimeout(() => {
        connectionTimeouts.delete(peerId);
        scheduleRetry(peerId);
      }, connectionTimeoutMs)
    );

    void connect(peerId).catch((error) => {
      onError?.(error);
      scheduleRetry(peerId);
    });
  }

  return {
    request(peerId: string) {
      desiredPeerIds.add(peerId);
      const phase = phases.get(peerId);
      if (phase === "connecting" || phase === "retrying") return;
      if (phase === "failed") attemptCounts.set(peerId, 0);
      beginAttempt(peerId);
    },

    handleOpen(peerId: string) {
      desiredPeerIds.add(peerId);
      clearTimers(peerId);
      attemptCounts.set(peerId, 0);
      setPhase(peerId, "connected");
    },

    handleClose(peerId: string) {
      if (!desiredPeerIds.has(peerId)) {
        clearTimers(peerId);
        setPhase(peerId, null);
        return;
      }
      attemptCounts.set(peerId, 0);
      scheduleRetry(peerId);
    },

    cancel(peerId: string) {
      desiredPeerIds.delete(peerId);
      attemptCounts.delete(peerId);
      clearTimers(peerId);
      setPhase(peerId, null);
    },

    stop() {
      Array.from(desiredPeerIds).forEach((peerId) => {
        desiredPeerIds.delete(peerId);
        attemptCounts.delete(peerId);
        clearTimers(peerId);
        setPhase(peerId, null);
      });
    },

    phase(peerId: string) {
      return phases.get(peerId) ?? null;
    },
  };
};
