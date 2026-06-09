'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import {
  BRAIN_REGIONS,
  SPHERE_RADIUS,
  NODE_COUNT,
  MAX_CONNECTIONS,
  MAX_CONNECT_DIST,
  KNN_K,
  SOMA_COUNT,
  SOMA_SCALE_MIN,
  SOMA_SCALE_MAX,
} from '@/config/neural'
import type { ConnectionData, NodeData } from '@/types'

// ── Region assignment ─────────────────────────────────────────
function assignRegion(x: number, y: number) {
  // 30% chance of random assignment — breaks color clumping
  if (Math.random() < 0.30) {
    return BRAIN_REGIONS[Math.floor(Math.random() * BRAIN_REGIONS.length)]
  }
  for (const region of BRAIN_REGIONS) {
    const { xRange, yRange } = region.zone
    if (x >= xRange[0] && x <= xRange[1] && y >= yRange[0] && y <= yRange[1]) {
      return region
    }
  }
  return BRAIN_REGIONS[Math.floor(Math.random() * BRAIN_REGIONS.length)]
}

// ── Node generation (true 3D sphere distribution) ────────────
function generateNodes(): NodeData[] {
  const R = SPHERE_RADIUS
  const nodes: NodeData[] = []
  let attempts = 0
  const maxAttempts = NODE_COUNT * 25

  while (nodes.length < NODE_COUNT && attempts < maxAttempts) {
    attempts++
    const x = (Math.random() * 2 - 1) * R
    const y = (Math.random() * 2 - 1) * R
    const z = (Math.random() * 2 - 1) * R
    // Reject points outside sphere
    if (x * x + y * y + z * z > R * R) continue

    const region = assignRegion(x, y)
    nodes.push({
      id: nodes.length,
      position: new THREE.Vector3(x, y, z),
      regionId: region.id,
      color: region.color,
      hexColor: region.hexColor,
      emissiveIntensity: 1.0 + Math.random() * 0.5,
      scale: 0.05 + Math.random() * 0.07,  // small by default (bouton)
      isSoma: false,
    })
  }
  return nodes
}

// ── Connection generation (KNN sparse graph) ──────────────────
function generateConnections(nodes: NodeData[]): ConnectionData[] {
  const connections: ConnectionData[] = []
  const seen = new Set<string>()

  for (const nodeA of nodes) {
    const byDist = nodes
      .filter(n => n.id !== nodeA.id)
      .map(n => ({ node: n, dist: nodeA.position.distanceTo(n.position) }))
      .filter(({ dist }) => dist <= MAX_CONNECT_DIST)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, KNN_K)

    for (const { node: nodeB } of byDist) {
      if (connections.length >= MAX_CONNECTIONS) break
      const key = `${Math.min(nodeA.id, nodeB.id)}-${Math.max(nodeA.id, nodeB.id)}`
      if (seen.has(key)) continue
      seen.add(key)

      const mid = nodeA.position.clone().lerp(nodeB.position, 0.5)
      mid.x += (Math.random() - 0.5) * 2.0
      mid.y += (Math.random() - 0.5) * 2.0
      mid.z += (Math.random() - 0.5) * 1.5

      const curve = new THREE.CatmullRomCurve3([
        nodeA.position.clone(),
        mid,
        nodeB.position.clone(),
      ])

      const region = BRAIN_REGIONS.find(r => r.id === nodeA.regionId) ?? BRAIN_REGIONS[0]

      connections.push({
        id: connections.length,
        fromId: nodeA.id,
        toId: nodeB.id,
        curve,
        regionColor: region.color,
        hexColor: region.hexColor,
        opacity: 0.35 + Math.random() * 0.2,
        dendriticLevel: 1,  // default secondary — updated below
      })
    }
    if (connections.length >= MAX_CONNECTIONS) break
  }
  return connections
}

// ── Post-process: identify soma + mark dendritic levels ───────
function applyBiologicalStructure(nodes: NodeData[], connections: ConnectionData[]) {
  // Count connections per node
  const connCount = new Map<number, number>()
  for (const c of connections) {
    connCount.set(c.fromId, (connCount.get(c.fromId) ?? 0) + 1)
    connCount.set(c.toId,   (connCount.get(c.toId)   ?? 0) + 1)
  }

  // Top SOMA_COUNT nodes by connection count become soma (cell bodies)
  const sorted = [...connCount.entries()].sort((a, b) => b[1] - a[1])
  const somaIds = new Set(sorted.slice(0, SOMA_COUNT).map(([id]) => id))

  for (const node of nodes) {
    if (somaIds.has(node.id)) {
      node.isSoma = true
      // Keep soma small — same scale range as boutons, just slightly larger
      node.scale = 0.08 + Math.random() * 0.06
      node.emissiveIntensity = 2.5 + Math.random() * 1.0
    }
  }

  // Tag connections: level 0 if either endpoint is a soma
  for (const conn of connections) {
    if (somaIds.has(conn.fromId) || somaIds.has(conn.toId)) {
      conn.dendriticLevel = 0
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────
export interface NeuralNetwork {
  nodes: NodeData[]
  connections: ConnectionData[]
}

export function useNeuralNetwork(): NeuralNetwork {
  return useMemo(() => {
    const nodes = generateNodes()
    const connections = generateConnections(nodes)
    applyBiologicalStructure(nodes, connections)
    return { nodes, connections }
  }, [])
}
