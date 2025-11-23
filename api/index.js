const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const serverless = require("serverless-http");
const { Client } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Conexão com NEON POSTGRES
const NEON_URL =
  process.env.NEON_URL ||
  "postgresql://neondb_owner:npg_PuXZ3fcqF0mp@ep-frosty-mud-acdojtkm-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const client = new Client({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false },
});

// Conectar uma vez só
client.connect();

// Função para checar se key existe
async function keyExists(key) {
  const { rows } = await client.query(
    "SELECT key FROM keys WHERE key = $1 LIMIT 1",
    [key]
  );
  return rows.length > 0;
}

// Middleware para limpar expiradas
app.use(async (req, res, next) => {
  await client.query(
    `DELETE FROM keys 
     WHERE expires_at IS NOT NULL 
     AND expires_at < NOW()`
  );
  next();
});

// Rota raiz
app.get("/", (req, res) => {
  res.send("API rodando no Vercel com Neon PostgreSQL!");
});

// Verificar se key existe
app.get("/keys/:key/check", async (req, res) => {
  try {
    const key = req.params.key;

    const { rows } = await client.query(
      "SELECT key, used, expires_at FROM keys WHERE key = $1 LIMIT 1",
      [key]
    );

    if (rows.length === 0)
      return res.json({ valid: false, message: "Key não encontrada" });

    const data = rows[0];

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.json({
        valid: false,
        key,
        expired: true,
        message: "Key expirada",
      });
    }

    if (data.used) {
      return res.json({
        valid: false,
        key,
        used: true,
        message: "Key já usada",
      });
    }

    res.json({
      valid: true,
      key,
      message: "Key válida",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar key
app.post("/keys", async (req, res) => {
  try {
    const newKey = req.body.key;
    if (!newKey) return res.status(400).json({ error: "Key não informada" });

    if (await keyExists(newKey))
      return res.status(400).json({ error: "Key já existe" });

    await client.query(
      `INSERT INTO keys (key, created_at, used, user, expires_at)
       VALUES ($1, NOW(), false, null, null)`,
      [newKey]
    );

    res.json({ success: true, key: newKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar key temporária
app.post("/keys/temporaria", async (req, res) => {
  try {
    let { key, expires_at } = req.body;

    if (!expires_at)
      return res.status(400).json({ error: "Data de expiração obrigatória" });

    if (!key) return res.status(400).json({ error: "Key não informada" });

    if (await keyExists(key))
      return res.status(400).json({ error: "Key já existe" });

    await client.query(
      `INSERT INTO keys (key, created_at, used, user, expires_at)
       VALUES ($1, NOW(), false, null, $2)`,
      [key, expires_at]
    );

    res.json({ success: true, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apagar key
app.delete("/keys/:key", async (req, res) => {
  try {
    const key = req.params.key;

    const { rowCount } = await client.query(
      "DELETE FROM keys WHERE key = $1",
      [key]
    );

    if (rowCount > 0) res.json({ success: true, message: "Key apagada" });
    else res.status(404).json({ error: "Key não encontrada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const { rowCount } = await client.query(
      "UPDATE keys SET key = $1 WHERE key = $2",
      [newKey, oldKey]
    );

    if (rowCount > 0) res.json({ success: true, key: newKey });
    else res.status(404).json({ error: "Key não encontrada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar key como usada e vincular usuário
app.post("/keys/:key/use", async (req, res) => {
  try {
    const key = req.params.key;
    const user = req.body.user || null;

    const { rows } = await client.query(
      "SELECT * FROM keys WHERE key = $1 LIMIT 1",
      [key]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Key não encontrada" });

    if (rows[0].used)
      return res.status(400).json({ error: "Key já usada" });

    await client.query(
      "UPDATE keys SET used = true, user = $1 WHERE key = $2",
      [user, key]
    );

    res.json({ success: true, key, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todas as keys
app.get("/keys", async (req, res) => {
  try {
    const { rows } = await client.query(
      "SELECT key, created_at, used, user, expires_at FROM keys ORDER BY created_at DESC LIMIT 100"
    );

    res.json({ keys: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exportar keys para TXT
app.get("/export/keys.txt", async (req, res) => {
  try {
    const { rows } = await client.query(
      "SELECT key, used, user FROM keys ORDER BY created_at DESC"
    );

    const content = rows
      .map(
        (r) =>
          `Key: ${r.key} | Usada: ${r.used ? "Sim" : "Não"} | Usuário: ${r.user || "-"
          }`
      )
      .join("\n");

    res.setHeader("Content-Disposition", "attachment; filename=keys.txt");
    res.setHeader("Content-Type", "text/plain");
    res.send(content);
  } catch (err) {
    res.status(500).send("Erro ao exportar");
  }
});

module.exports = app;
module.exports.handler = serverless(app);
