import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnectionLifecycle,
  type PeerConnectionPhase,
} from "./connectionLifecycle";

describe("connection lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates pending requests and reconnects after a close", async () => {
    let active = true;
    const connected = new Set<string>();
    const connect = vi.fn(async () => undefined);
    const phases = new Map<string, PeerConnectionPhase>();
    const lifecycle = createConnectionLifecycle({
      connect,
      isConnected: (peerId) => connected.has(peerId),
      isActive: () => active,
      onPhaseChange: (peerId, phase) => {
        if (phase) phases.set(peerId, phase);
        else phases.delete(peerId);
      },
      connectionTimeoutMs: 100,
      retryBaseDelayMs: 10,
      retryMaximumDelayMs: 20,
    });

    lifecycle.request("peer-a");
    lifecycle.request("peer-a");
    expect(connect).toHaveBeenCalledTimes(1);
    expect(phases.get("peer-a")).toBe("connecting");

    connected.add("peer-a");
    lifecycle.handleOpen("peer-a");
    expect(phases.get("peer-a")).toBe("connected");

    connected.delete("peer-a");
    lifecycle.handleClose("peer-a");
    expect(phases.get("peer-a")).toBe("retrying");
    await vi.advanceTimersByTimeAsync(10);
    expect(connect).toHaveBeenCalledTimes(2);

    active = false;
    lifecycle.stop();
    expect(phases.has("peer-a")).toBe(false);
  });

  it("times out with exponential retries and can be requested again", async () => {
    const connect = vi.fn(async () => undefined);
    const phases = new Map<string, PeerConnectionPhase>();
    const lifecycle = createConnectionLifecycle({
      connect,
      isConnected: () => false,
      isActive: () => true,
      onPhaseChange: (peerId, phase) => {
        if (phase) phases.set(peerId, phase);
        else phases.delete(peerId);
      },
      connectionTimeoutMs: 100,
      retryBaseDelayMs: 10,
      retryMaximumDelayMs: 20,
      maximumAttempts: 2,
    });

    lifecycle.request("peer-a");
    await vi.advanceTimersByTimeAsync(100);
    expect(phases.get("peer-a")).toBe("retrying");
    await vi.advanceTimersByTimeAsync(10);
    expect(connect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(phases.get("peer-a")).toBe("failed");

    lifecycle.request("peer-a");
    expect(connect).toHaveBeenCalledTimes(3);
    expect(phases.get("peer-a")).toBe("connecting");
    lifecycle.cancel("peer-a");
  });
});
