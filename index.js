const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Verificar se key existe (novo endpoint)
app.get("/keys/:key/check", (req, res) => {
  const key = req.params.key;
  
  db.get("SELECT key, used, expires_at FROM keys WHERE key = ?", [key], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    
    if (!row) {
      return res.json({ valid: false, message: "Key não encontrada" });
    }
    
    // Verificar se está expirada
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.json({ 
        valid: false, 
        message: "Key expirada",
        key: row.key,
        expired: true
      });
    }
    
    // Verificar se já foi usada
    if (row.used === 1) {
      return res.json({ 
        valid: false, 
        message: "Key já usada",
        key: row.key,
        used: true
      });
    }
    
    // Se chegou aqui, a key é válida
    res.json({ 
      valid: true,
      key: row.key,
      message: "Key válida"
    });
  });
});

// Banco SQLite (arquivo criado automaticamente)
const db = new sqlite3.Database("./keys.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    created_at TEXT,
    used INTEGER DEFAULT 0,
    user TEXT DEFAULT NULL,
    expires_at TEXT DEFAULT NULL
  )`);
});

function keyExists(key, cb) {
  db.get("SELECT key FROM keys WHERE key = ?", [key], (err, row) => {
    cb(!!row);
  });
}

// Criar key
app.post("/keys", (req, res) => {
  const newKey = req.body.key;
  if (!newKey) return res.status(400).json({ error: "Key não informada" });

  keyExists(newKey, (exists) => {
    if (exists) return res.status(400).json({ error: "Key já existe" });

    db.run(
      "INSERT INTO keys (key, created_at, used, user) VALUES (?, ?, 0, NULL)",
      [newKey, new Date().toISOString()],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao inserir" });
        res.json({ success: true, key: newKey });
      }
    );
  });
});

// Criar key temporária com data de expiração
app.post("/keys/temporaria", (req, res) => {
  let { key, expires_at } = req.body;

  if (!expires_at) {
    return res.status(400).json({ error: "Data de expiração é obrigatória" });
  }

  expires_at = new Date(expires_at).toISOString();

  if (!key) return res.status(400).json({ error: "Key não informada" });

  keyExists(key, (exists) => {
    if (exists) return res.status(400).json({ error: "Key já existe" });

    db.run(
      "INSERT INTO keys (key, created_at, used, user, expires_at) VALUES (?, ?, 0, NULL, ?)",
      [key, new Date().toISOString(), expires_at],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao inserir" });
        res.json({ success: true, key });
      }
    );
  });
});

// Apagar key
app.delete("/keys/:key", (req, res) => {
  const keyToDelete = req.params.key;
  if (!keyToDelete) return res.status(400).json({ error: "Key não informada para apagar" });

  db.run("DELETE FROM keys WHERE key = ?", [keyToDelete], function (err) {
    if (err) return res.status(500).json({ error: "Erro ao apagar" });
    if (this.changes > 0) res.json({ success: true, message: "Key apagada" });
    else res.status(404).json({ error: "Key não encontrada" });
  });
});

// Atualizar key (substitui por uma nova)
app.put("/keys/:key", (req, res) => {
  const oldKey = req.params.key;
  const newKey = req.body.key;
  if (!newKey) return res.status(400).json({ error: "Nova key não informada" });

  keyExists(newKey, (exists) => {
    if (exists) return res.status(400).json({ error: "A nova key já existe" });

    db.run("UPDATE keys SET key = ? WHERE key = ?", [newKey, oldKey], function (err) {
      if (err) return res.status(500).json({ error: "Erro ao atualizar" });
      if (this.changes > 0) res.json({ success: true, key: newKey });
      else res.status(404).json({ error: "Key não encontrada" });
    });
  });
});

// Marcar key como usada e vincular a usuário
app.post("/keys/:key/use", (req, res) => {
  const key = req.params.key;
  const user = req.body.user || null;

  db.get("SELECT * FROM keys WHERE key = ?", [key], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro" });
    if (!row) return res.status(404).json({ error: "Key não encontrada" });
    if (row.used === 1) return res.status(400).json({ error: "Key já usada" });

    db.run(
      "UPDATE keys SET used = 1, user = ? WHERE key = ?",
      [user, key],
      function (err) {
        if (err) return res.status(500).json({ error: "Erro ao marcar como usada" });
        res.json({ success: true, key, user });
      }
    );
  });
});

app.get("/keys", (req, res) => {
  const now = new Date().toISOString();

  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 20;
  if(limit > 100) limit = 100;

  let offset = (page - 1) * limit;

  let sql = "SELECT key, created_at, used, user, expires_at FROM keys WHERE (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT ? OFFSET ?";
  let params = [now, limit, offset];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "Erro" });

    // Contar total para paginação
    let countSql = "SELECT COUNT(*) as total FROM keys WHERE (expires_at IS NULL OR expires_at > ?)";
    let countParams = [now];

    db.get(countSql, countParams, (err2, countRow) => {
      if (err2) return res.status(500).json({ error: "Erro" });

      res.json({
        page,
        limit,
        total: countRow.total,
        totalPages: Math.ceil(countRow.total / limit),
        keys: rows,
      });
    });
  });
});

// Exportar todas as keys para arquivo TXT
app.get("/export/keys.txt", (req, res) => {
  db.all("SELECT key, used, user FROM keys ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).send("Erro ao exportar");

    let content = rows.map(r => {
      return `Key: ${r.key} | Usada: ${r.used ? "Sim" : "Não"} | Usuário: ${r.user || "-"}`;
    }).join("\n");

    res.setHeader('Content-Disposition', 'attachment; filename=keys.txt');
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
  });
});

// Apaga keys expiradas a cada 5 minutos
setInterval(() => {
  const now = new Date().toISOString();
  db.run(
    "DELETE FROM keys WHERE expires_at IS NOT NULL AND expires_at <= ?",
    [now],
    function (err) {
      if (err) console.error("Erro ao apagar keys expiradas:", err);
    }
  );
}, 5 * 60 * 1000); // 5 minutos

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
