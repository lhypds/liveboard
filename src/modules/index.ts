import type { ComponentType } from 'react'

const raw = import.meta.glob('./*/index.ts', { eager: true })

const registry: Record<string, ComponentType> = {}
for (const path in raw) {
  const name = path.split('/').at(-2)!
  registry[name] = (raw[path] as { default: ComponentType }).default
}

export default registry
