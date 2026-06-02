import express from "express";
import { router } from "./router";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(router);

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => console.log(`ms-empresa running on :${PORT}`));
