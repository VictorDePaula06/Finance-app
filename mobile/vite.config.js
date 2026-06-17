import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// App mobile isolado — porta 5174 para não colidir com o site (5173).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
});
