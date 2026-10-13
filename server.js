
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.GROQ_API_KEY;

const ALLOWED_ORIGIN = (
  process.env.ALLOWED_ORIGIN ||
  'https://estudar-kp6f.onrender.com'
).replace(/\/+$/, '');

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const HTML = path.join(__dirname, 'index.html');

const MAX_BODY = 24 * 1024;

let windowStart = Date.now();
let requestCount = 0;

function send(
  res,
  status,
  data,
  type = 'application/json; charset=utf-8'
) {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });

  res.end(
    type.startsWith('application/json')
      ? JSON.stringify(data)
      : data
  );
}

function cors(req, res) {
  const origin = (req.headers.origin || '').replace(/\/+$/, '');

  if (!origin) return true;
  if (origin !== ALLOWED_ORIGIN) return false;

  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;

    req.on('data', chunk => {
      if (tooLarge) return;

      data += chunk.toString();

      if (Buffer.byteLength(data, 'utf8') > MAX_BODY) {
        tooLarge = true;
        reject(new Error('Pedido muito grande.'));
        req.resume();
      }
    });

    req.on('end', () => {
      if (tooLarge) return;

      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url,
    'http://' + (req.headers.host || 'localhost')
  );

  // Permite as requisições CORS do navegador.
  if (url.pathname === '/api/chat' && req.method === 'OPTIONS') {
    if (!cors(req, res)) {
      return send(res, 403, {
        error: 'Origem não autorizada.'
      });
    }

    res.writeHead(204);
    return res.end();
  }

  // Página principal.
  if (
    req.method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/index.html')
  ) {
    try {
      return send(
        res,
        200,
        fs.readFileSync(HTML, 'utf8'),
        'text/html; charset=utf-8'
      );
    } catch (e) {
      console.error('Erro ao abrir index.html:', e.message);

      return send(res, 500, {
        error: 'Não foi possível abrir index.html.'
      });
    }
  }

  // Verificação do servidor.
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, {
      status: 'ok',
      model: MODEL,
      apiConfigured: Boolean(API_KEY),
      allowedOrigin: ALLOWED_ORIGIN
    });
  }

  // Assistente de inteligência artificial.
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    if (!cors(req, res)) {
      return send(res, 403, {
        error: 'Origem não autorizada.'
      });
    }

    if (!API_KEY) {
      return send(res, 503, {
        error: 'Configure GROQ_API_KEY no Render.'
      });
    }

    // Limite de 25 requisições por minuto.
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      requestCount = 0;
    }

    if (++requestCount > 25) {
      return send(res, 429, {
        error: 'Limite de perguntas atingido. Aguarde um minuto.'
      });
    }

    let body;

    try {
      body = await readBody(req);
    } catch (e) {
      return send(res, 400, {
        error: e.message || 'Pedido inválido.'
      });
    }

    const question = String(body.question || '')
      .trim()
      .slice(0, 1200);

    const context = String(body.context || '')
      .slice(0, 16000);

    const mode = body.mode === 'hint' ? 'hint' : 'study';

    if (!question) {
      return send(res, 400, {
        error: 'Escreva uma pergunta.'
      });
    }

    if (!context) {
      return send(res, 400, {
        error: 'Não foi encontrado conteúdo de leitura.'
      });
    }

    // Prompt para dúvidas gerais sobre a matéria.
    const studyPrompt =
      'Você é uma assistente didática de segurança em laboratórios escolares. ' +
      'Responda em português claro e objetivo. ' +
      'Baseie-se prioritariamente no texto de leitura, não invente fatos ' +
      'e diga quando o material não trouxer a resposta. ' +
      'Em temas de segurança, respeite os procedimentos, o professor ' +
      'e os equipamentos de proteção.';

    // Prompt para dar dicas sem entregar a resposta do quiz.
    const hintPrompt =
      'Você é uma tutora que ajuda o estudante a entender uma questão ' +
      'de múltipla escolha sem revelar a resposta. O estudante está em um quiz. ' +
      'NUNCA diga a alternativa correta, não copie a resposta correta do material, ' +
      'não identifique letras/opções, não elimine explicitamente todas as ' +
      'alternativas erradas e não resolva a questão por ele. ' +
      'Primeiro reexplique a pergunta em linguagem mais simples; ' +
      'depois explique no máximo 1 ou 2 conceitos relevantes; ' +
      'termine com uma pista gradual ou uma pergunta orientadora ' +
      'que faça o aluno pensar. ' +
      'Se o estudante insistir em pedir a resposta, recuse gentilmente ' +
      'e ofereça outra pista. Use apenas o texto de leitura e não invente conteúdo.';

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            Authorization: 'Bearer ' + API_KEY,
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            model: MODEL,

            temperature: mode === 'hint' ? 0.35 : 0.25,

            max_tokens: mode === 'hint' ? 350 : 700,

            messages: [
              {
                role: 'system',
                content: mode === 'hint' ? hintPrompt : studyPrompt
              },
              {
                role: 'user',

                content:
                  'TEXTO DE LEITURA:\n' +
                  context +
                  '\n\n' +
                  (
                    mode === 'hint'
                      ? 'DÚVIDA SOBRE A QUESTÃO (não revele a resposta):\n'
                      : 'PERGUNTA DO ESTUDANTE:\n'
                  ) +
                  question
              }
            ]
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data.error?.message ||
          'A Groq retornou HTTP ' + response.status + '.';

        console.error(
          'Erro da Groq:',
          response.status,
          message
        );

        return send(
          res,
          response.status === 429 ? 429 : 502,
          { error: message }
        );
      }

      const answer = data.choices?.[0]?.message?.content;

      if (!answer) {
        return send(res, 502, {
          error: 'A Groq não retornou uma resposta válida.'
        });
      }

      return send(res, 200, {
        answer: String(answer).slice(
          0,
          mode === 'hint' ? 3000 : 9000
        ),
        model: MODEL,
        mode
      });

    } catch (e) {
      console.error('Erro ao acessar a Groq:', e.message);

      return send(res, 502, {
        error: 'Falha ao acessar a Groq. Confira a conexão e a chave.'
      });
    }
  }

  // Qualquer rota não reconhecida.
  return send(res, 404, {
    error: 'Rota não encontrada.'
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Backend iniciado na porta ' + PORT);
  console.log('Origem autorizada: ' + ALLOWED_ORIGIN);
  console.log('Modelo configurado: ' + MODEL);
});
