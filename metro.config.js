const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');

const config = getDefaultConfig(__dirname);

// Enhanced middleware to proxy third-party API calls in web mode to bypass CORS
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      // Football-Data proxy endpoint
      if (req.url && req.url.startsWith('/api/proxy/football')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const token =
          req.headers['x-auth-token'] || parsedUrl.searchParams.get('token') || '';
        let targetPath = parsedUrl.searchParams.get('path') || '/v4/matches';

        // Forward any extra query parameters (dateFrom, dateTo, status, competitions, etc.)
        const queryParams = new URLSearchParams();
        for (const [key, value] of parsedUrl.searchParams.entries()) {
          if (key !== 'token' && key !== 'path') {
            queryParams.append(key, value);
          }
        }
        const qs = queryParams.toString();
        if (qs) {
          targetPath += (targetPath.includes('?') ? '&' : '?') + qs;
        }

        const options = {
          hostname: 'api.football-data.org',
          port: 443,
          path: targetPath,
          method: 'GET',
          headers: {
            'X-Auth-Token': token,
            'User-Agent': 'ScoreViewerHub/1.0',
            Accept: 'application/json',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader(
            'Access-Control-Allow-Headers',
            'X-Auth-Token, Content-Type, Authorization'
          );
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message, matches: [] }));
        });

        proxyReq.end();
        return;
      }

      // PandaScore proxy endpoint (backup for web mode)
      if (req.url && req.url.startsWith('/api/proxy/pandascore')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const token = parsedUrl.searchParams.get('token') || '';
        let targetPath = parsedUrl.searchParams.get('path') || '/matches';

        const queryParams = new URLSearchParams();
        for (const [key, value] of parsedUrl.searchParams.entries()) {
          if (key !== 'token' && key !== 'path') {
            queryParams.append(key, value);
          }
        }
        const qs = queryParams.toString();
        if (qs) {
          targetPath += (targetPath.includes('?') ? '&' : '?') + qs;
        }
        targetPath += (targetPath.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);

        const options = {
          hostname: 'api.pandascore.co',
          port: 443,
          path: targetPath,
          method: 'GET',
          headers: {
            'User-Agent': 'ScoreViewerHub/1.0',
            Accept: 'application/json',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message, data: [] }));
        });

        proxyReq.end();
        return;
      }

      // VLR.gg scraper proxy endpoint (for web mode)
      if (req.url && req.url.startsWith('/api/proxy/vlr')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const targetUrl = parsedUrl.searchParams.get('url') || 'https://www.vlr.gg';
        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          parsedTarget = new URL('https://www.vlr.gg' + targetUrl);
        }

        const options = {
          hostname: parsedTarget.hostname,
          port: 443,
          path: parsedTarget.pathname + parsedTarget.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/html; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 502;
          res.end(err.message);
        });

        proxyReq.end();
        return;
      }

      // Gezzly (R6 stats oficiales de Ubisoft) proxy endpoint (for web mode)
      if (req.url && req.url.startsWith('/api/proxy/gezzly')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const targetUrl = parsedUrl.searchParams.get('url') || 'https://www.gezzly.gg/matches';
        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          parsedTarget = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://www.gezzly.gg' + targetUrl);
        }

        const options = {
          hostname: parsedTarget.hostname,
          port: 443,
          path: parsedTarget.pathname + parsedTarget.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/html; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 502;
          res.end(err.message);
        });

        proxyReq.end();
        return;
      }

      // Generic CDN proxy endpoint (CommunityDragon / Data Dragon para iconos) en web
      if (req.url && req.url.startsWith('/api/proxy/cdn')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const targetUrl = parsedUrl.searchParams.get('url') || '';
        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          res.statusCode = 400;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end('{}');
          return;
        }

        const options = {
          hostname: parsedTarget.hostname,
          port: 443,
          path: parsedTarget.pathname + parsedTarget.search,
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.end();
        return;
      }

      // gol.gg proxy endpoint (for web mode). El cliente siempre hace GET al proxy;
      // si method=POST, el proxy realiza el POST server-side con el body indicado
      // (evita depender de leer el body en Metro y de preflight CORS).
      if (req.url && req.url.startsWith('/api/proxy/gol')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const targetUrl = parsedUrl.searchParams.get('url') || '';
        const method = (parsedUrl.searchParams.get('method') || 'GET').toUpperCase();
        const body = parsedUrl.searchParams.get('body') || '';
        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          res.statusCode = 400;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end('{}');
          return;
        }

        const options = {
          hostname: parsedTarget.hostname,
          port: 443,
          path: parsedTarget.pathname + parsedTarget.search,
          method,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: method === 'POST' ? 'application/json' : 'text/html',
            'X-Requested-With': 'XMLHttpRequest',
            ...(method === 'POST'
              ? {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': Buffer.byteLength(body),
                }
              : {}),
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/html; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message }));
        });

        if (method === 'POST' && body) proxyReq.write(body);
        proxyReq.end();
        return;
      }

      // Leaguepedia (LoL picks/bans/MVP) proxy endpoint (for web mode)
      if (req.url && req.url.startsWith('/api/proxy/leaguepedia')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const targetUrl = parsedUrl.searchParams.get('url') || 'https://lol.fandom.com/api.php';
        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          parsedTarget = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://lol.fandom.com' + targetUrl);
        }

        const options = {
          hostname: parsedTarget.hostname,
          port: 443,
          path: parsedTarget.pathname + parsedTarget.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message, cargoquery: [] }));
        });

        proxyReq.end();
        return;
      }

      // Rainbow Six Ubisoft proxy endpoint (for web mode)
      if (req.url && req.url.startsWith('/api/proxy/r6')) {
        const parsedUrl = new URL(req.url, 'http://localhost:8081');
        const targetUrl = parsedUrl.searchParams.get('url') || 'https://www.ubisoft.com/en-us/esports/rainbow-six/siege';
        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
        } catch {
          parsedTarget = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://www.ubisoft.com' + targetUrl);
        }

        const options = {
          hostname: parsedTarget.hostname,
          port: 443,
          path: parsedTarget.pathname + parsedTarget.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/html; charset=utf-8');
          res.statusCode = proxyRes.statusCode || 200;
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 502;
          res.end(err.message);
        });

        proxyReq.end();
        return;
      }

      // Handle CORS preflight for all proxies
      if (req.method === 'OPTIONS' && req.url && req.url.startsWith('/api/proxy/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'X-Auth-Token, Content-Type, Authorization'
        );
        res.statusCode = 204;
        res.end();
        return;
      }

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
