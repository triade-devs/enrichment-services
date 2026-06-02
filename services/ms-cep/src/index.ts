import express from "express";
import { router } from "./router";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(router);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`ms-cep running on :${PORT}`));
