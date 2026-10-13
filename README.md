# Estudo de Segurança em Laboratórios — GitHub Pages + Groq

O site estático pode ser hospedado no GitHub Pages. A chamada à Groq exige um backend separado, pois uma chave de API não pode ser protegida no JavaScript público.

## 1. Publicar o site no GitHub Pages
1. Envie `index.html` para a raiz do repositório público.
2. Em **Settings → Pages**, configure a publicação a partir da branch principal e da raiz (`/root`).
3. No início do bloco da assistente em `index.html`, substitua `https://SUA-API-NO-RENDER.onrender.com` pela URL pública do backend depois de implantá-lo.

## 2. Implantar o backend no Render
1. Crie um **Web Service** no Render conectado ao mesmo repositório GitHub.
2. Use `npm start` como comando de inicialização (Node 18+).
3. Em **Environment**, configure:
   - `GROQ_API_KEY`: a chave da Groq (adicione no painel do Render; nunca no GitHub).
   - `ALLOWED_ORIGIN`: somente a origem do GitHub Pages, por exemplo `https://SEU-USUARIO.github.io`. Não inclua caminho de repositório nem barra final.
   - Opcional: `GROQ_MODEL=llama-3.3-70b-versatile`.
4. Após o deploy, copie a URL `https://...onrender.com` e cole no `AI_API_BASE` em `index.html`.
5. Faça commit e push do `index.html` atualizado para o GitHub. O Render fará deploy do backend a partir do mesmo repositório.

## Progresso
O progresso usa `localStorage`, então fica salvo no mesmo navegador e origem do GitHub Pages. Ele não sincroniza automaticamente entre dispositivos ou navegadores.

## Segurança
- Não coloque a chave real em `index.html`, `server.js`, `.env.example` ou no repositório.
- Se a chave foi adicionada anteriormente a um repositório público, remova-a e revogue/regenere a chave.
- O backend inclui uma limitação simples de requisições por minuto e restrição de origem CORS; CORS não substitui autenticação nem proteção contra abuso. Para um site público, considere adicionar rate limiting por IP/autenticação e monitorar o uso da API.
