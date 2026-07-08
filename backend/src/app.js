import cors from "cors";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import { parseCsv } from "./csvParser.js";
import { extractCrmRecords } from "./aiExtractor.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024 }
});

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, provider: process.env.AI_PROVIDER || "mock" });
  });

  app.post("/api/import", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "CSV file is required." });
      const csv = req.file.buffer.toString("utf8");
      const { headers, records } = parseCsv(csv);
      if (headers.length === 0) return res.status(400).json({ error: "CSV must include a header row." });
      if (records.length === 0) return res.status(400).json({ error: "CSV must include at least one data row." });

      const result = await extractCrmRecords(records);
      return res.json({ headers, totalRows: records.length, ...result });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 500;
    res.status(status).json({ error: error.message || "Unexpected server error." });
  });

  return app;
}
