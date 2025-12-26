import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/daydial-scheduler/', // REPLACE 'daydial-scheduler' with your actual repo name
})