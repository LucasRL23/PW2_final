import express from 'express';

// Cada instância possui seus próprios arrays, inclusive durante os testes.
export function criarApp(jwtSecret) {
  if (!jwtSecret) throw new Error('Configure JWT_SECRET no arquivo .env.');
  const app = express();
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'API de alunos - PW2 - Avaliação 3' });
  });

  return app;
}
