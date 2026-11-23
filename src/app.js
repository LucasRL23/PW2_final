import express from 'express';
import { criarRotasAuth } from './routes/authRoutes.js';
import { criarAuthenticateJWT } from './middlewares/authenticateJWT.js';

// Cada instância possui seus próprios arrays, inclusive durante os testes.
export function criarApp(jwtSecret) {
  if (!jwtSecret) throw new Error('Configure JWT_SECRET no arquivo .env.');
  const app = express();
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'API de alunos - PW2 - Avaliação 3' });
  });

  // Cadastro e login são públicos; todo acesso a /alunos exige JWT.
  app.use(criarRotasAuth(jwtSecret));
  app.use('/alunos', criarAuthenticateJWT(jwtSecret));

  app.use((req, res) => {
    res.status(404).json({ message: 'Rota não encontrada!' });
  });

  // O Express identifica um tratador de erros pelos quatro parâmetros.
  app.use((erro, req, res, next) => {
    if (erro.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'JSON inválido no corpo da requisição.' });
    }
    if (erro.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Corpo da requisição muito grande.' });
    }
    res.status(500).json({ message: 'Erro interno do servidor.' });
  });

  return app;
}
