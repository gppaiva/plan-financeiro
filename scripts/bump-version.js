#!/usr/bin/env node
/**
 * Bumps the patch version in src/version.ts and package.json.
 * Run before pushing: node scripts/bump-version.js
 */
import { readFileSync, writeFileSync } from 'fs'

// Bump src/version.ts
const versionFile = 'src/version.ts'
const versionContent = readFileSync(versionFile, 'utf-8')
const match = versionContent.match(/APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/)
if (!match) {
  console.error('Could not find version in src/version.ts')
  process.exit(1)
}

const [, major, minor, patch] = match
const newPatch = parseInt(patch, 10) + 1
const newVersion = `${major}.${minor}.${newPatch}`

writeFileSync(versionFile, `export const APP_VERSION = '${newVersion}'\n`)

// Bump package.json
const pkgFile = 'package.json'
const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8'))
pkg.version = newVersion
writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n')

console.log(`Version bumped to ${newVersion}`)
