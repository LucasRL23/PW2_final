import dotenv from 'dotenv';
import { criarApp } from './src/app.js';

dotenv.config({ quiet: true });

const app = criarApp(process.env.JWT_SECRET);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API de alunos disponível em http://localhost:${PORT}`);
});
