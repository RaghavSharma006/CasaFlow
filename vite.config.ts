import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{main:'index.html',reset:'reset-password.html',parallel:'parallel.html'}}}});
