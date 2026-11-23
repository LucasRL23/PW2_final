import express from 'express';
import { criarAlunosIniciais } from '../data/alunos.js';

export function criarRotasAlunos() {
  const routes = express.Router();
  const alunos = criarAlunosIniciais();

  function dadosValidos(dados) {
    return typeof dados?.nome === 'string' && dados.nome.trim() !== '' &&
      typeof dados?.ra === 'string' && dados.ra.trim() !== '' &&
      Number.isFinite(dados?.nota1) && Number.isFinite(dados?.nota2);
  }

  function media(aluno) {
    return (aluno.nota1 + aluno.nota2) / 2;
  }

  routes.get('/', (req, res) => {
    res.json(alunos);
  });

  // As rotas fixas precisam vir antes de /:id para não serem tratadas como IDs.
  routes.get('/medias', (req, res) => {
    res.json(alunos.map(aluno => ({ nome: aluno.nome, media: media(aluno) })));
  });

  routes.get('/aprovados', (req, res) => {
    // Conforme o exemplo, retorna TODOS os alunos, inclusive os reprovados.
    res.json(alunos.map(aluno => ({
      nome: aluno.nome, status: media(aluno) >= 6 ? 'aprovado' : 'reprovado'
    })));
  });

  routes.post('/', (req, res) => {
    if (!dadosValidos(req.body) || !Number.isSafeInteger(req.body.id)) {
      return res.status(400).json({ message: 'Informe id inteiro, nome, ra, nota1 e nota2 numéricas.' });
    }
    if (alunos.some(aluno => aluno.id === req.body.id)) {
      return res.status(409).json({ message: 'Já existe um aluno com esse ID!' });
    }
    const { id, nome, ra, nota1, nota2 } = req.body;
    alunos.push({ id, nome: nome.trim(), ra: ra.trim(), nota1, nota2 });
    res.status(201).json({ message: 'Aluno criado com sucesso!' });
  });

  // Reutiliza a procura por ID no GET, PUT e DELETE.
  routes.param('id', (req, res, next, valor) => {
    if (!/^-?\d+$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
      return res.status(400).json({ message: 'O ID deve ser um número inteiro.' });
    }
    const index = alunos.findIndex(aluno => aluno.id === Number(valor));
    if (index === -1) {
      return res.status(404).json({ message: 'Aluno não encontrado!' });
    }
    req.alunoIndex = index;
    next();
  });

  routes.get('/:id', (req, res) => {
    res.json(alunos[req.alunoIndex]);
  });

  routes.put('/:id', (req, res) => {
    if (!dadosValidos(req.body)) {
      return res.status(400).json({ message: 'Informe nome, ra, nota1 e nota2 numéricas.' });
    }
    const aluno = alunos[req.alunoIndex];
    if (req.body.id !== undefined && req.body.id !== aluno.id) {
      return res.status(400).json({ message: 'O ID do aluno não pode ser alterado.' });
    }
    const { nome, ra, nota1, nota2 } = req.body;
    aluno.nome = nome.trim();
    aluno.ra = ra.trim();
    aluno.nota1 = nota1;
    aluno.nota2 = nota2;
    res.json(aluno);
  });

  routes.delete('/:id', (req, res) => {
    alunos.splice(req.alunoIndex, 1);
    res.json({ message: 'Aluno removido!' });
  });

  return routes;
}
