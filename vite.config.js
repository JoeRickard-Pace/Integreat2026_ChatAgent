import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const chatTarget = env.VITE_CHAT_API_URL || env.CHAT_API_URL || env.VITE_API_URL;
  const auditTarget = env.VITE_AUDIT_API_URL || env.AUDIT_API_URL;
  const statesTarget = env.VITE_GETSTATES_API_URL || env.GETSTATES_API_URL;

  const boothConfig = {
    bookingUrl: 'mailto:connect@paceintegration.com?subject=Pre-flight%20check',
    liveDataUrl: env.VITE_GETSTATES_API_URL || env.GETSTATES_API_URL || '/states-data',
    award: false,
  };

  const boothConfigPlugin = () => ({
    name: 'booth-config',
    configureServer(server) {
      server.middlewares.use('/booth-config.json', (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(boothConfig));
      });

      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;

        if (pathname === '/booth') {
          res.writeHead(301, { Location: '/booth/' });
          res.end();
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/booth-config.json', (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(boothConfig));
      });

      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;

        if (pathname === '/booth') {
          res.writeHead(301, { Location: '/booth/' });
          res.end();
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'booth-config.json',
        source: JSON.stringify(boothConfig, null, 2),
      });
    },
  });

  const boothRedirect = () => ({
    name: 'booth-route-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;

        if (pathname === '/booth') {
          res.writeHead(301, { Location: '/booth/' });
          res.end();
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;

        if (pathname === '/booth') {
          res.writeHead(301, { Location: '/booth/' });
          res.end();
          return;
        }
        next();
      });
    },
  });

  const withAuth = (token, path) => ({
    target: path,
    changeOrigin: true,
    secure: false,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        if (token) {
          proxyReq.setHeader('Authorization', `Bearer ${token}`);
          proxyReq.setHeader('Accept', 'application/json');
        }
      });
    },
  });

  return {
    plugins: [react(), boothConfigPlugin(), boothRedirect()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/chat': withAuth(env.VITE_CHAT_API_KEY || env.CHAT_API_KEY || env.VITE_API_KEY || '', chatTarget),
        '/audit-data': withAuth(env.VITE_AUDIT_API_KEY || env.AUDIT_API_KEY || '', auditTarget),
        '/states-data': withAuth(env.VITE_GETSTATES_API_KEY || env.GETSTATES_API_KEY || '', statesTarget),
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      proxy: {
        '/chat': withAuth(env.VITE_CHAT_API_KEY || env.CHAT_API_KEY || env.VITE_API_KEY || '', chatTarget),
        '/audit-data': withAuth(env.VITE_AUDIT_API_KEY || env.AUDIT_API_KEY || '', auditTarget),
        '/states-data': withAuth(env.VITE_GETSTATES_API_KEY || env.GETSTATES_API_KEY || '', statesTarget),
      },
    },
  };
});
