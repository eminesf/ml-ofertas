import dotenv from 'dotenv'
import path from 'path'

// Carrega .env da raiz do monorepo independente de onde o script é executado
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
