const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const SECRET = 'if_keep_secret_key_2024';
const GOOGLE_CLIENT_ID = 'COLOQUE_AQUI_SEU_CLIENT_ID.apps.googleusercontent.com'; // <--- SEU ID DO GOOGLE
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root_password_123', // Mude para sua senha real do banco
  database: 'ifkeep_db',
  port: 3306
});

db.connect((err) => {
  if (err) console.error('❌ ERRO MYSQL:', err.message);
  else console.log('✅ CONECTADO AO MYSQL!');
});

// MIDDLEWARE
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- LOGIN COM GOOGLE ---
app.post('/google-login', async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const { email, name } = ticket.getPayload();

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
      let user = results[0];
      if (!user) {
        // Se não existe, cria usuário sem senha
        db.query("INSERT INTO users (username, email, password, secret_word) VALUES (?, ?, ?, ?)", [name, email, 'google-auth', 'google-auth'], (err, result) => {
          const newToken = jwt.sign({ id: result.insertId }, SECRET, { expiresIn: '24h' });
          res.json({ token: newToken, username: name });
        });
      } else {
        const newToken = jwt.sign({ id: user.id }, SECRET, { expiresIn: '24h' });
        res.json({ token: newToken, username: user.username });
      }
    });
  } catch (err) { res.status(401).json({ error: "Falha na autenticação do Google" }); }
});

// --- ROTAS DE AUTENTICAÇÃO COM PALAVRA-SECRETA ---
app.post('/register', async (req, res) => {
  const { username, email, password, secret_word } = req.body;
  const hash = await bcrypt.hash(password, 10);
  
  db.query("INSERT INTO users (username, email, password, secret_word) VALUES (?, ?, ?, ?)", [username, email, hash, secret_word], (err) => {
    if (err) {
      console.error("Erro no cadastro:", err);
      return res.status(400).json({ error: "E-mail ou usuário já cadastrado" });
    }
    res.json({ message: "Conta criada com sucesso!" });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: "Usuário não encontrado" });
    
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Senha incorreta" });
    
    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  });
});

app.post('/reset-password', async (req, res) => {
  const { email, secret_word, newPassword } = req.body;
  
  db.query("SELECT * FROM users WHERE email = ? AND secret_word = ?", [email, secret_word], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ error: "E-mail ou Palavra-Secreta incorretos." });
    }
    
    const hash = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE id = ?", [hash, results[0].id], (err) => {
      if (err) return res.status(500).json({ error: "Erro ao salvar nova senha." });
      res.json({ message: "Senha atualizada! Faça login." });
    });
  });
});

// --- MATÉRIAS E NOTAS ---
app.get('/subjects', authenticateToken, (req, res) => {
  db.query('SELECT name FROM subjects WHERE user_id = ?', [req.user.id], (err, results) => {
    res.json(err ? [] : results.map(row => row.name));
  });
});

app.post('/subjects', authenticateToken, (req, res) => {
  db.query("INSERT INTO subjects (name, user_id) VALUES (?, ?)", [req.body.name, req.user.id], (err) => {
    if (err) {
      console.error("Erro ao criar matéria:", err);
      return res.status(500).json({ error: "Erro ao salvar matéria no banco de dados." });
    }
    res.json({ message: "Salvo" });
  });
});

app.get('/notes', authenticateToken, (req, res) => {
  db.query('SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, results) => {
    res.json(err ? [] : results);
  });
});

app.post('/notes', authenticateToken, (req, res) => {
  const { title, content, color, subject, archived, date } = req.body;
  db.query("INSERT INTO notes (title, content, color, subject, archived, date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)", 
  [title, content, color, subject, archived ? 1 : 0, date, req.user.id], (err) => {
    if (err) {
      console.error("Erro ao criar nota:", err);
      return res.status(500).json({ error: "Erro ao salvar nota no banco de dados." });
    }
    res.json({ message: "Salvo" });
  });
});

app.put('/notes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(req.body), id, req.user.id];
  
  db.query(`UPDATE notes SET ${fields} WHERE id = ? AND user_id = ?`, values, (err) => {
    if (err) console.error("Erro ao atualizar:", err);
    res.json({ message: "Atualizado" });
  });
});

app.delete('/notes/:id', authenticateToken, (req, res) => {
  db.query("DELETE FROM notes WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err) => {
    res.json({ message: "Excluído" });
  });
});

app.delete('/subjects/:name', authenticateToken, (req, res) => {
  db.query("DELETE FROM subjects WHERE name = ? AND user_id = ?", [req.params.name, req.user.id], (err) => {
    res.json({ message: "Excluído" });
  });
});

app.listen(3001, () => console.log('🚀 Server ON: 3001'));