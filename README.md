# PW2_final — API de alunos

Trabalho final (Avaliação 3) de Programação para Web II. Backend com **Node.js, Express, JWT e bcryptjs**, seguindo os endpoints e os formatos de resposta do conteúdo 15.

## Executar

Requisitos: Node.js 22 ou superior e npm.

```sh
git clone https://github.com/LucasRL23/PW2_final.git
cd PW2_final
npm ci
npm start
```

API disponível em **http://localhost:3000**. Para desenvolver com reinício automático:

```sh
npm run dev
```

O `.env` acompanha o projeto para permitir a execução da avaliação, conforme o enunciado. Contém `PORT=3000` e uma chave JWT **pública, didática e exclusiva deste exercício local**. Ela não é uma credencial de conta e não deve ser reutilizada em produção. Variáveis já definidas no ambiente têm prioridade sobre o `.env`.

## Armazenamento

Alunos e usuários são armazenados em **arrays em memória**, como permitido pelo professor. Ao reiniciar, os usuários cadastrados e as alterações são perdidos; os três alunos fictícios iniciais são restaurados. Não é necessário configurar MongoDB nem MockAPI.

| ID | Nome | RA | Nota 1 | Nota 2 | Média | Situação |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Biruta | 11111 | 8.5 | 9.5 | 9 | aprovado |
| 2 | Lucao | 22222 | 7.5 | 7 | 7.25 | aprovado |
| 3 | Enzo | 33333 | 3 | 4 | 3.5 | reprovado |

O array de usuários começa vazio. Primeiro cadastre um usuário em `/register`.

## Autenticação

Envie JSON (`Content-Type: application/json`) para `POST /register`:

```json
{
  "username": "aluno@example.test",
  "password": "senha-de-teste"
}
```

Resposta `201`:

```json
{ "message": "Usuário criado!" }
```

Envie os mesmos dados para `POST /login`. A resposta `200` tem o formato:

```json
{
  "message": "Login efetuado pelo usuário aluno@example.test",
  "jwt": "TOKEN_GERADO_PELO_SERVIDOR"
}
```

As senhas são armazenadas como hash bcrypt, com custo 10. O JWT usa HS256 e expira em **uma hora**, como no exemplo da aula. Para todas as rotas de alunos, envie:

```http
Authorization: Bearer TOKEN_GERADO_PELO_SERVIDOR
```

No Thunder Client ou Postman, escolha **Auth → Bearer** e cole apenas o valor de `jwt`. Também há exemplos prontos no arquivo `requisicoes.http` (compatível com a extensão REST Client do VS Code, ou para copiar ao Thunder Client).

## Endpoints obrigatórios

| Método | Rota | JWT? | Resposta de sucesso |
| --- | --- | --- | --- |
| POST | `/register` | Não | `201`, mensagem de usuário criado |
| POST | `/login` | Não | `200`, `message` e `jwt` |
| GET | `/alunos` | Sim | `200`, lista com todos os campos |
| GET | `/alunos/:id` | Sim | `200`, objeto do aluno |
| GET | `/alunos/medias` | Sim | `200`, lista de `{ nome, media }` |
| GET | `/alunos/aprovados` | Sim | `200`, lista de `{ nome, status }` |
| POST | `/alunos` | Sim | `201`, `{ "message": "Aluno criado com sucesso!" }` |
| PUT | `/alunos/:id` | Sim | `200`, objeto atualizado |
| DELETE | `/alunos/:id` | Sim | `200`, `{ "message": "Aluno removido!" }` |

`:id` representa o inteiro na URL, por exemplo `/alunos/4`. As rotas `/medias` e `/aprovados` são declaradas antes de `/:id`.

`GET /alunos/aprovados` retorna **todos os alunos** com sua situação, inclusive os reprovados. A média é `(nota1 + nota2) / 2`: média maior ou igual a 6 significa `aprovado`, e menor que 6 significa `reprovado`.

### Cadastrar aluno

`POST /alunos`:

```json
{
  "id": 4,
  "nome": "Demóstenes",
  "ra": "44444",
  "nota1": 6,
  "nota2": 7
}
```

O ID é informado no corpo, conforme permitido pelo enunciado, e precisa ser inteiro e único. Nome e RA são strings não vazias. Notas são números JSON (use `7.5`, sem aspas). O RA é texto para preservar zeros à esquerda.

### Alterar aluno

`PUT /alunos/3`:

```json
{
  "nome": "Enzo Pereira",
  "ra": "3333399999",
  "nota1": 3.5,
  "nota2": 4.5
}
```

Envie os quatro campos editáveis. O ID é preservado; caso seja enviado no corpo, deve ser igual ao ID existente.

### Erros

Todas as mensagens são JSON no formato `{ "message": "..." }`, inclusive JSON malformado e rota inexistente.

| Código | Situação |
| --- | --- |
| 400 | Dados inválidos, JSON malformado ou tentativa de alterar o ID |
| 401 | Login incorreto, token ausente ou expirado |
| 403 | Token inválido ou cabeçalho de autenticação incorreto |
| 404 | Aluno ou rota não encontrados |
| 409 | Username ou ID de aluno duplicado |
| 413 | Corpo da requisição maior que o limite do Express |
| 500 | Erro interno inesperado |

Usuário inexistente e senha incorreta retornam a mesma mensagem: `Login Incorreto!`. Senhas vazias ou maiores que 72 bytes são rejeitadas para evitar truncamento pelo bcrypt.

## Testar

```sh
npm test
```

São **22 testes de integração**, com requisições HTTP a um servidor local em porta livre. Cada teste usa arrays novos e fecha seu servidor no final. Cobrem as nove rotas, login real, token expirado/adulterado, médias, situação de todos os alunos, limite de aprovação em 6, CRUD completo, ID inexistente/duplicado, validações e respostas JSON.

Para conferir manualmente:

1. Faça `GET /alunos` sem token: deve retornar `401`.
2. Cadastre um usuário e faça login; copie `jwt`.
3. Liste os alunos e consulte as médias e situações com o token.
4. Cadastre o aluno 4, consulte, altere e exclua.
5. Consulte/altere/exclua um ID inexistente: deve retornar `404`.
6. Envie token inválido: deve retornar `403`.

## Organização

```text
server.js                         Inicia o servidor e carrega o .env
src/app.js                        Configura Express, rotas e erros JSON
src/routes/authRoutes.js          Cadastro, hash de senha e login
src/routes/alunosRoutes.js        CRUD, médias e situação dos alunos
src/middlewares/authenticateJWT.js Valida o token antes das rotas de alunos
src/data/alunos.js                Alunos fictícios iniciais
test/api.test.js                  Testes de integração HTTP
requisicoes.http                  Exemplos para testar manualmente
```

## Referências

- Materiais da disciplina: conteúdos 13, 14 e 15; Avaliação 3 nas páginas 167–191 do conteúdo 15.
- [Express 4 — middleware e erros](https://expressjs.com/en/4x/guide/error-handling/).
- [jsonwebtoken — assinatura e verificação](https://github.com/auth0/node-jsonwebtoken).

O projeto é entregue como backend local para teste pelo professor. O armazenamento em memória e a chave didática foram escolhidos para esse contexto de avaliação.
