const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const serverless = require("serverless-http");
const PocketBase = require("pocketbase/cjs");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// URL do PocketBase
const pb = new PocketBase(process.env.PB_URL || "http://127.0.0.1:8090");

// Função para checar se key existe
async function keyExists(key) {
  try {
    await pb.collection("keys").getFirstListItem(`key="${key}"`);
    return true;
  } catch (err) {
    return false;
  }
}

// Middleware para limpar keys expiradas
app.use(async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const itens = await pb.collection("keys").getFullList();

    for (const item of itens) {
      if (item.expires_at && new Date(item.expires_at) < new Date()) {
        await pb.collection("keys").delete(item.id);
      }
    }
  } catch {}
  next();
});

// Rota raiz
app.get("/", (req, res) => {
  res.send("API rodando no Vercel com PocketBase!");
});

// Verificar key
app.get("/keys/:key/check", async (req, res) => {
  try {
    const key = req.params.key;

    let item;
    try {
      item = await pb.collection("keys").getFirstListItem(`key="${key}"`);
    } catch {
      return res.json({ valid: false, message: "Key não encontrada" });
    }

    if (item.expires_at && new Date(item.expires_at) < new Date()) {
      return res.json({
        valid: false,
        message: "Key expirada",
        expired: true,
      });
    }

    if (item.used) {
      return res.json({
        valid: false,
        message: "Key já usada",
        used: true,
      });
    }

    res.json({
      valid: true,
      message: "Key válida",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar key fixa
app.post("/keys", async (req, res) => {
  try {
    const newKey = req.body.key;

    if (!newKey) return res.status(400).json({ error: "Key não informada" });
    if (await keyExists(newKey))
      return res.status(400).json({ error: "Key já existe" });

    await pb.collection("keys").create({
      key: newKey,
      used: false,
      user: null,
      expires_at: null,
    });

    res.json({ success: true, key: newKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar key temporária
app.post("/keys/temporaria", async (req, res) => {
  try {
    let { key, expires_at } = req.body;

    if (!key) return res.status(400).json({ error: "Key não informada" });
    if (!expires_at)
      return res.status(400).json({ error: "Data de expiração é obrigatória" });

    expires_at = new Date(expires_at).toISOString();

    if (await keyExists(key))
      return res.status(400).json({ error: "Key já existe" });

    await pb.collection("keys").create({
      key,
      used: false,
      user: null,
      expires_at,
    });

    res.json({ success: true, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apagar key
app.delete("/keys/:key", async (req, res) => {
  try {
    const paramKey = req.params.key;
    const item = await pb.collection("keys").getFirstListItem(`key="${paramKey}"`);

    await pb.collection("keys").delete(item.id);

    res.json({ success: true, message: "Key apagada" });
  } catch {
    res.status(404).json({ error: "Key não encontrada" });
  }
});

// Atualizar key
app.put("/keys/:key", async (req, res) => {
  try {
    const oldKey = req.params.key;
    const newKey = req.body.key;

    if (!newKey)
      return res.status(400).json({ error: "Nova key não informada" });

    if (await keyExists(newKey))
      return res.status(400).json({ error: "A nova key já existe" });

    const item = await pb.collection("keys").getFirstListItem(`key="${oldKey}"`);

    await pb.collection("keys").update(item.id, {
      key: newKey,
    });

    res.json({ success: true, key: newKey });
  } catch {
    res.status(404).json({ error: "Key não encontrada" });
  }
});

// Marcar key como usada
app.post("/keys/:key/use", async (req, res) => {
  try {
    const key = req.params.key;
    const user = req.body.user || null;

    const item = await pb.collection("keys").getFirstListItem(`key="${key}"`);

    if (item.used)
      return res.status(400).json({ error: "Key já usada" });

    await pb.collection("keys").update(item.id, {
      used: true,
      user,
    });

    res.json({ success: true, key, user });
  } catch {
    res.status(404).json({ error: "Key não encontrada" });
  }
});

// Listar todas as keys
app.get("/keys", async (req, res) => {
  try {
    const data = await pb.collection("keys").getFullList({
      sort: "-created",
    });

    res.json({ keys: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exportar txt
app.get("/export/keys.txt", async (req, res) => {
  try {
    const rows = await pb.collection("keys").getFullList();

    let content = rows
      .map(
        (r) =>
          `Key: ${r.key} | Usada: ${r.used ? "Sim" : "Não"} | Usuário: ${
            r.user || "-"
          }`
      )
      .join("\n");

    res.setHeader("Content-Disposition", "attachment; filename=keys.txt");
    res.setHeader("Content-Type", "text/plain");
    res.send(content);
  } catch {
    res.status(500).send("Erro ao exportar");
  }
});

module.exports = app;
module.exports.handler = serverless(app);
