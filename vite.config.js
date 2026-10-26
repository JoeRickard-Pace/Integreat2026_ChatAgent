import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const chatTarget = env.CHAT_API_URL || env.VITE_API_URL;
  const auditTarget = env.AUDIT_API_URL;

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
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/chat': withAuth(env.CHAT_API_KEY || env.VITE_API_KEY || '', chatTarget),
        '/audit-data': withAuth(env.AUDIT_API_KEY || '', auditTarget),
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      proxy: {
        '/chat': withAuth(env.CHAT_API_KEY || env.VITE_API_KEY || '', chatTarget),
        '/audit-data': withAuth(env.AUDIT_API_KEY || '', auditTarget),
      },
    },
  };
});
