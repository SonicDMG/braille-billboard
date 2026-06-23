import { Billboard } from '@/components/Billboard'

const REQUIRED_VARS = ['OPENRAG_BASE_URL', 'OPENRAG_API_KEY']

export default function Page() {
  const missingEnvVars = REQUIRED_VARS.filter(v => !process.env[v])

  return <Billboard missingEnvVars={missingEnvVars} />
}
