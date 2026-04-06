import { readFileSync, writeFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('.output/server/package.json', 'utf8'))
delete pkg.dependencies['drizzle-kit']
delete pkg.dependencies['@drizzle-team/brocli']
writeFileSync('.output/server/package.json', JSON.stringify(pkg, null, 2))
console.log('Cleaned drizzle-kit from .output/server/package.json')
