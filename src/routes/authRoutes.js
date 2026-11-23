import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function criarRotasAuth(jwtSecret) {
  const routes = express.Router();
  const users = [];

  function credenciaisValidas(body) {
    return typeof body?.username === 'string' && body.username.trim() !== '' &&
      typeof body?.password === 'string' && body.password.trim() !== '' &&
      Buffer.byteLength(body.password, 'utf8') <= 72;
  }

  routes.post('/register', async (req, res, next) => {
    try {
      if (!credenciaisValidas(req.body)) {
        return res.status(400).json({ message: 'Informe username e password válidos (senha até 72 bytes).' });
      }
      const username = req.body.username.trim();
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      // Verifica depois do await para impedir duplicatas em cadastros simultâneos.
      if (users.some(user => user.username === username)) {
        return res.status(409).json({ message: 'Usuário já cadastrado!' });
      }
      users.push({ username, password: hashedPassword });
      return res.status(201).json({ message: 'Usuário criado!' });
    } catch (erro) {
      next(erro);
    }
  });

  routes.post('/login', async (req, res, next) => {
    try {
      if (!credenciaisValidas(req.body)) {
        return res.status(400).json({ message: 'Informe username e password válidos (senha até 72 bytes).' });
      }
      const username = req.body.username.trim();
      const user = users.find(user => user.username === username);
      if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
        return res.status(401).json({ message: 'Login Incorreto!' });
      }
      const token = jwt.sign({ username: user.username }, jwtSecret, {
        expiresIn: '1h', algorithm: 'HS256'
      });
      return res.json({ message: `Login efetuado pelo usuário ${user.username}`, jwt: token });
    } catch (erro) {
      next(erro);
    }
  });

  return routes;
}
