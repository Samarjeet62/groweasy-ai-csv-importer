"use client";

import { CheckCircle2, FileUp, Loader2, Moon, RotateCcw, Sun, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { parseCsvPreview } from "./csvPreview";

const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description"
];

export default function Page() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState({ headers: [], rows: [] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [dragging, setDragging] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  const hasPreview = preview.headers.length > 0;
  const progressLabel = useMemo(() => {
    if (!loading) return "Ready";
    return "AI extraction in progress";
  }, [loading]);

  async function handleFile(nextFile) {
    setError("");
    setResult(null);
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }
    const text = await nextFile.text();
    const parsed = parseCsvPreview(text, 200);
    if (!parsed.headers.length || !parsed.rows.length) {
      setError("CSV must include a header row and at least one data row.");
      return;
    }
    setFile(nextFile);
    setPreview(parsed);
  }

  async function confirmImport() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiBase}/api/import`, { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Import failed.");
      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview({ headers: [], rows: [] });
    setResult(null);
    setError("");
  }

  return (
    <main className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <div>
          <p className="eyebrow">GrowEasy CRM</p>
          <h1>AI CSV Importer</h1>
        </div>
        <button className="iconButton" onClick={() => setDark((value) => !value)} title="Toggle dark mode">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <section className="workspace">
        <div
          className={dragging ? "dropzone active" : "dropzone"}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <UploadCloud size={34} />
          <div>
            <h2>Upload CSV</h2>
            <p>{file ? file.name : "Drag a CSV here or choose a file to preview it before AI processing."}</p>
          </div>
          <label className="primaryButton">
            <FileUp size={17} />
            Choose file
            <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
        </div>

        <div className="actions">
          <span className={loading ? "status busy" : "status"}>{loading && <Loader2 size={16} className="spin" />}{progressLabel}</span>
          <button className="secondaryButton" onClick={reset} disabled={!file && !result}>
            <RotateCcw size={16} />
            Reset
          </button>
          <button className="confirmButton" onClick={confirmImport} disabled={!hasPreview || loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
            Confirm import
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {hasPreview && (
          <DataTable
            title="Uploaded CSV Preview"
            subtitle={`Showing ${preview.rows.length} preview rows. AI processing starts only after confirmation.`}
            headers={preview.headers}
            rows={preview.rows.map((row) => row.cells.map((cell) => cell.value))}
          />
        )}

        {result && (
          <>
            <section className="metrics">
              <Metric label="Total imported" value={result.totalImported} />
              <Metric label="Total skipped" value={result.totalSkipped} />
              <Metric label="Uploaded rows" value={result.totalRows} />
            </section>
            <DataTable
              title="Parsed GrowEasy CRM Records"
              subtitle="Structured records returned by the backend extractor."
              headers={CRM_FIELDS}
              rows={(result.parsed || []).map((record) => CRM_FIELDS.map((field) => record[field] || ""))}
            />
            {(result.skipped || []).length > 0 && (
              <DataTable
                title="Skipped Records"
                subtitle="Rows without email or mobile, plus any failed batch details."
                headers={["row", "reason"]}
                rows={result.skipped.map((item) => [item.row || "", item.reason || "Skipped"])}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({ title, subtitle, headers, rows }) {
  return (
    <section className="tableSection">
      <div className="sectionHead">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
