import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: `file:${path.join(__dirname, 'prisma', 'dev.db')}`,
  },
})
