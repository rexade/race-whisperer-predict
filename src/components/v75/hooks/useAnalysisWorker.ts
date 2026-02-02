
import { useRef, useCallback } from "react";

type WorkerRequest = {
    requestId: string;
    type: "PROCESS_RACE";
    payload: any;
};

type WorkerResponse =
    | { requestId: string; type: "DONE"; payload: any }
    | { requestId: string; type: "ERROR"; error: string };

export function useAnalysisWorker() {
    const workerRef = useRef<Worker | null>(null);
    const pendingRef = useRef(new Map<
        string,
        { resolve: (v: any) => void; reject: (e: any) => void }
    >());

    const start = useCallback(() => {
        if (workerRef.current) return;

        // Use Vite's worker import syntax
        const w = new Worker(
            new URL("../../../workers/analysis.worker.ts", import.meta.url),
            { type: "module" }
        );

        w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
            const msg = ev.data;
            const pending = pendingRef.current.get(msg.requestId);
            if (!pending) return;

            pendingRef.current.delete(msg.requestId);

            if (msg.type === "DONE") pending.resolve(msg.payload);
            else pending.reject(new Error(msg.error));
        };

        w.onerror = (err) => {
            // Reject everything pending
            for (const [, p] of pendingRef.current) p.reject(err);
            pendingRef.current.clear();
        };

        workerRef.current = w;
    }, []);

    const stop = useCallback(() => {
        if (!workerRef.current) return;
        workerRef.current.terminate();
        workerRef.current = null;

        for (const [, p] of pendingRef.current) p.reject(new Error("Worker stopped"));
        pendingRef.current.clear();
    }, []);

    const run = useCallback(async (payload: any) => {
        if (!workerRef.current) throw new Error("Worker not started");

        const requestId =
            crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const req: WorkerRequest = { requestId, type: "PROCESS_RACE", payload };

        return new Promise((resolve, reject) => {
            pendingRef.current.set(requestId, { resolve, reject });
            workerRef.current!.postMessage(req);
        });
    }, []);

    return { start, stop, run };
}
