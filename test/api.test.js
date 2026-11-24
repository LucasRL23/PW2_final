import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { criarApp } from '../src/app.js';

const segredoTeste = 'chave-isolada-usada-somente-nos-testes';
const credenciais = { username: 'aluno@example.test', password: 'senha-de-teste' };
const novoAluno = { id: 4, nome: 'Demóstenes', ra: '44444', nota1: 6, nota2: 7 };
let server;
let baseUrl;
let token;

beforeEach(async () => {
  // Porta livre e arrays novos: os testes não usam nem alteram uma API externa.
  server = criarApp(segredoTeste).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  token = jwt.sign({ username: credenciais.username }, segredoTeste, { expiresIn: '1h' });
});

afterEach(async () => {
  await new Promise((resolve, reject) => server.close(erro => erro ? reject(erro) : resolve()));
});

async function requisitar(rota, { method = 'GET', body, authorization = `Bearer ${token}` } = {}) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const resposta = await fetch(baseUrl + rota, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  assert.match(resposta.headers.get('content-type'), /application\/json/);
  return { status: resposta.status, dados: await resposta.json() };
}

test('cadastro, senha incorreta, login e acesso com o token emitido', async () => {
  const cadastro = await requisitar('/register', { method: 'POST', body: credenciais, authorization: null });
  assert.equal(cadastro.status, 201);
  assert.deepEqual(cadastro.dados, { message: 'Usuário criado!' });
  const incorreto = await requisitar('/login', { method: 'POST', body: { ...credenciais, password: 'errada' }, authorization: null });
  assert.equal(incorreto.status, 401);
  assert.equal(incorreto.dados.message, 'Login Incorreto!');
  const login = await requisitar('/login', { method: 'POST', body: credenciais, authorization: null });
  assert.equal(login.status, 200);
  assert.equal(typeof login.dados.message, 'string');
  const conteudo = jwt.verify(login.dados.jwt, segredoTeste, { algorithms: ['HS256'] });
  assert.equal(conteudo.username, credenciais.username);
  assert.equal(conteudo.exp - conteudo.iat, 3600);
  assert.equal(conteudo.password, undefined);
  assert.equal((await requisitar('/alunos', { authorization: `Bearer ${login.dados.jwt}` })).status, 200);
});

test('login de usuário inexistente retorna 401', async () => {
  assert.equal((await requisitar('/login', { method: 'POST', body: credenciais })).status, 401);
});

test('cadastros simultâneos não criam usuários duplicados', async () => {
  const respostas = await Promise.all([1, 2].map(() => requisitar('/register', { method: 'POST', body: credenciais })));
  assert.deepEqual(respostas.map(r => r.status).sort(), [201, 409]);
});

test('cadastro e login rejeitam corpo incompleto ou tipos inválidos', async () => {
  for (const rota of ['/register', '/login']) {
    for (const body of [{}, { username: 10, password: 'senha' }, { username: '   ', password: 'senha' }, { ...credenciais, password: 123456 }, { ...credenciais, password: 'á'.repeat(37) }]) {
      assert.equal((await requisitar(rota, { method: 'POST', body })).status, 400);
    }
  }
});

for (const [method, rota] of [
  ['GET', '/alunos'], ['GET', '/alunos/1'], ['GET', '/alunos/medias'],
  ['GET', '/alunos/aprovados'], ['POST', '/alunos'], ['PUT', '/alunos/1'], ['DELETE', '/alunos/1']
]) {
  test(`${method} ${rota} exige token`, async () => {
    const r = await requisitar(rota, { method, authorization: null });
    assert.equal(r.status, 401);
    assert.equal(r.dados.message, 'Acesso negado. Token não fornecido.');
  });
}

test('token expirado retorna 401', async () => {
  const expirado = jwt.sign({ username: 'teste' }, segredoTeste, { expiresIn: -1 });
  const r = await requisitar('/alunos', { authorization: `Bearer ${expirado}` });
  assert.equal(r.status, 401);
  assert.equal(r.dados.message, 'Acesso negado. Token expirado.');
});

test('assinatura adulterada, algoritmo diferente e cabeçalho inválido retornam 403', async () => {
  for (const authorization of [
    'Bearer invalido', `Basic ${token}`, 'Bearer', `Bearer ${token} extra`,
    `Bearer ${jwt.sign({ username: 'teste' }, 'outra-chave')}`,
    `Bearer ${jwt.sign({ username: 'teste' }, segredoTeste, { algorithm: 'HS384' })}`
  ]) {
    assert.equal((await requisitar('/alunos', { authorization })).status, 403);
  }
});

test('lista os três alunos iniciais com todos os campos', async () => {
  const r = await requisitar('/alunos');
  assert.equal(r.status, 200);
  assert.equal(r.dados.length, 3);
  assert.deepEqual(r.dados[0], { id: 1, nome: 'Biruta', ra: '11111', nota1: 8.5, nota2: 9.5 });
});

test('rota de médias retorna nome e média, sem conflito com /:id', async () => {
  const r = await requisitar('/alunos/medias');
  assert.equal(r.status, 200);
  assert.deepEqual(r.dados, [
    { nome: 'Biruta', media: 9 }, { nome: 'Lucao', media: 7.25 }, { nome: 'Enzo', media: 3.5 }
  ]);
});

test('situação inclui reprovados e aprova média exatamente seis', async () => {
  await requisitar('/alunos', { method: 'POST', body: { ...novoAluno, nota1: 5, nota2: 7 } });
  const r = await requisitar('/alunos/aprovados');
  assert.equal(r.status, 200);
  assert.deepEqual(r.dados, [
    { nome: 'Biruta', status: 'aprovado' }, { nome: 'Lucao', status: 'aprovado' },
    { nome: 'Enzo', status: 'reprovado' }, { nome: 'Demóstenes', status: 'aprovado' }
  ]);
});

test('ciclo completo: cadastrar, consultar, alterar, recalcular e excluir', async () => {
  const criado = await requisitar('/alunos', { method: 'POST', body: novoAluno });
  assert.equal(criado.status, 201);
  assert.equal(criado.dados.message, 'Aluno criado com sucesso!');
  assert.deepEqual((await requisitar('/alunos/4')).dados, novoAluno);
  const mudanca = { nome: 'Demóstenes Silva', ra: '004444', nota1: 0, nota2: 2.5 };
  const atualizado = await requisitar('/alunos/4', { method: 'PUT', body: mudanca });
  assert.equal(atualizado.status, 200);
  assert.deepEqual(atualizado.dados, { id: 4, ...mudanca });
  assert.deepEqual((await requisitar('/alunos/medias')).dados.at(-1), { nome: mudanca.nome, media: 1.25 });
  assert.equal((await requisitar('/alunos/aprovados')).dados.at(-1).status, 'reprovado');
  const removido = await requisitar('/alunos/4', { method: 'DELETE' });
  assert.equal(removido.status, 200);
  assert.equal(removido.dados.message, 'Aluno removido!');
  assert.equal((await requisitar('/alunos/4')).status, 404);
  assert.equal((await requisitar('/alunos')).dados.length, 3);
});

test('GET, PUT e DELETE inexistentes retornam 404 sem alterar os demais alunos', async () => {
  const antes = (await requisitar('/alunos')).dados;
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const r = await requisitar('/alunos/999', { method, body: method === 'PUT' ? novoAluno : undefined });
    assert.equal(r.status, 404);
    assert.equal(r.dados.message, 'Aluno não encontrado!');
  }
  assert.deepEqual((await requisitar('/alunos')).dados, antes);
});

test('não aceita ID duplicado nem altera ID existente', async () => {
  assert.equal((await requisitar('/alunos', { method: 'POST', body: { ...novoAluno, id: 1 } })).status, 409);
  assert.equal((await requisitar('/alunos/1', { method: 'PUT', body: novoAluno })).status, 400);
  assert.equal((await requisitar('/alunos/1')).dados.nome, 'Biruta');
});

test('dados inválidos não entram no array nem corrompem um aluno existente', async () => {
  const antes = (await requisitar('/alunos')).dados;
  for (const body of [{}, { ...novoAluno, nome: ' ' }, { ...novoAluno, ra: 123 }, { ...novoAluno, nota1: '6' }, { ...novoAluno, nota2: null }]) {
    assert.equal((await requisitar('/alunos', { method: 'POST', body })).status, 400);
    assert.equal((await requisitar('/alunos/1', { method: 'PUT', body })).status, 400);
  }
  for (const id of ['4', 4.5, null]) {
    assert.equal((await requisitar('/alunos', { method: 'POST', body: { ...novoAluno, id } })).status, 400);
  }
  assert.deepEqual((await requisitar('/alunos')).dados, antes);
});

test('ID inválido na URL retorna JSON com status 400', async () => {
  for (const id of ['abc', '1.5', '1e0', '9007199254740992']) {
    assert.equal((await requisitar(`/alunos/${id}`)).status, 400);
  }
});

test('JSON malformado e rota inexistente também retornam mensagens JSON', async () => {
  const r = await fetch(baseUrl + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalido' });
  assert.equal(r.status, 400);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal((await r.json()).message, 'JSON inválido no corpo da requisição.');
  assert.equal((await requisitar('/rota-inexistente')).status, 404);
});
