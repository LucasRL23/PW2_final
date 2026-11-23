import jwt from 'jsonwebtoken';

export function criarAuthenticateJWT(jwtSecret) {
  return (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }
    const partes = authHeader.trim().split(/\s+/);
    if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }
    try {
      req.user = jwt.verify(partes[1], jwtSecret, { algorithms: ['HS256'] });
    } catch (erro) {
      if (erro.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Acesso negado. Token expirado.' });
      }
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }
    next();
  };
}
