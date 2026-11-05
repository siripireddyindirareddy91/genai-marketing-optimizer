"use client";
import { useState } from "react";
import { Upload, FlaskConical } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
export default function ModelTraining({
  notify,
}: {
  notify: (s: string) => void;
}) {
  const [model, setModel] = useState("logistic"),
    [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [evaluation, setEvaluation] = useState<Record<string, number> | null>(null),
    [busy, setBusy] = useState(false);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Train on your historical outcomes</h3>
          <p>
            Upload pre-conversion feature snapshots with observed binary
            conversion labels
          </p>
        </div>
        <FlaskConical size={20} />
      </div>
      <div className="stack">
        <div className="notice">
          Required CSV columns: engagement, visits, purchases, recency,
          spending, converted (0 or 1). At least 40 rows and 10 observations per
          class. Each row should represent an independent customer snapshot
          taken before the outcome. Repeated customers need group-aware
          validation.
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Baseline model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="logistic">Logistic Regression</option>
              <option value="random_forest">Random Forest</option>
            </select>
          </label>
          <label className="field">
            <span>Historical observations (CSV, max 2 MB)</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  notify("File must be smaller than 2 MB");
                  return;
                }
                Papa.parse<Record<string, string>>(f, {
                  header: true,
                  skipEmptyLines: true,
                  complete: (r) => {
                    const fields = [
                      "engagement",
                      "visits",
                      "purchases",
                      "recency",
                      "spending",
                      "converted",
                    ];
                    if (
                      r.errors.length ||
                      r.data.length < 40 ||
                      r.data.length > 10000 ||
                      r.data.some((row) =>
                        fields.some(
                          (k) =>
                            row[k] === undefined ||
                            row[k].trim() === "" ||
                            !Number.isFinite(Number(row[k])),
                        ),
                      )
                    ) {
                      notify(
                        "Check required columns, numeric values, and 40–10,000 row limit",
                      );
                      return;
                    }
                    setRows(
                      r.data.map((row, i) => ({
                        id: String(i),
                        ...Object.fromEntries(
                          fields.map((k) => [k, Number(row[k])]),
                        ),
                      })),
                    );
                    notify(`${r.data.length} historical observations ready`);
                  },
                });
              }}
            />
          </label>
        </div>
        <button
          className="primary"
          disabled={busy || !rows.length || !backend}
          onClick={async () => {
            setBusy(true);
            try {
              const session = (await supabase?.auth.getSession())?.data.session;
              const r = await fetch(backend + "/api/ml/train", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(session
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {}),
                },
                body: JSON.stringify({ rows, model }),
              });
              const data = await r.json();
              if (!r.ok)
                throw new Error(
                  typeof data.detail === "string"
                    ? data.detail
                    : "Training failed. Check your data and sign-in.",
                );
              setEvaluation(data.metrics);
              notify("Model trained on a 75/25 stratified split");
            } catch (e) {
              notify(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Upload size={15} />
          {busy
            ? "Training and evaluating…"
            : backend
              ? "Train & evaluate model"
              : "Connect Python service to train"}
        </button>
        {evaluation && (
          <div className="signal-grid">
            {Object.entries(evaluation).map(([k, v]) => (
              <div key={k}>
                <small>{k.replaceAll("_", " ").toUpperCase()}</small>
                <strong>
                  {k.endsWith("size") ? v : (v * 100).toFixed(1) + "%"}
                </strong>
              </div>
            ))}
          </div>
        )}
        <p className="muted small">
          Scaling is fitted on training data only. Evaluation uses a held-out
          25% test set. Models are isolated by organization and held in Python
          process memory; retrain after service restart.
        </p>
      </div>
    </section>
  );
}
