import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { INSTRUMENT_FACE } from '../../scenario/content'
import type { ComponentId } from '../../scenario/types'
import type { ComponentVisual } from '../../scenario/visuals'

interface CoolingUnitProps {
  visuals: Record<ComponentId, ComponentVisual>
  reducedMotion: boolean
  onHover: (id: ComponentId | null) => void
  onSelect: (id: ComponentId) => void
  onUnavailable?: () => void
}

function plateTexture(text: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#10151a'
    context.fillRect(0, 0, 512, 256)
    context.strokeStyle = accent
    context.lineWidth = 10
    context.strokeRect(16, 16, 480, 224)
    context.fillStyle = '#e4ebe4'
    context.font = '600 54px "IBM Plex Mono", monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      context.fillText(line, 256, 128 + (index - (lines.length - 1) / 2) * 62)
    })
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function DisplayFace({ text, accent, width, height }: { text: string; accent: string; width: number; height: number }) {
  const texture = useMemo(() => plateTexture(text, accent), [text, accent])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[0, 0, 0.012]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function finish(base: string, visual: ComponentVisual) {
  const fault = visual.fault
  const warning = visual.warning
  const hot = visual.highlighted || visual.selected || visual.hovered
  return {
    color: base,
    emissive: fault ? '#c45c4a' : warning ? '#d08a4c' : hot ? '#c4a574' : visual.checked ? '#7d9a86' : '#000000',
    emissiveIntensity: fault ? 0.28 : warning ? 0.18 : visual.highlighted || visual.selected ? 0.22 : visual.hovered ? 0.1 : visual.checked ? 0.07 : 0,
    roughness: 0.48,
    metalness: 0.4,
  }
}

function Part({
  id,
  position,
  onHover,
  onSelect,
  children,
}: {
  id: ComponentId
  visual: ComponentVisual
  position: [number, number, number]
  onHover: (id: ComponentId | null) => void
  onSelect: (id: ComponentId) => void
  children: ReactNode
}) {
  const dragged = useRef(false)
  return (
    <group
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
        onHover(id)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        document.body.style.cursor = ''
        onHover(null)
      }}
      onPointerDown={() => {
        dragged.current = false
      }}
      onPointerMove={(event) => {
        if (event.buttons) dragged.current = true
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (dragged.current) return
        onSelect(id)
      }}
    >
      {children}
    </group>
  )
}

function Fan({ visual, reducedMotion, onHover, onSelect }: Omit<CoolingUnitProps, 'visuals'> & { visual: ComponentVisual }) {
  const blades = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (reducedMotion || !blades.current) return
    blades.current.rotation.x += delta * 2.2
  })
  const shell = finish('#5f676e', visual)
  return (
    <Part id="fan" visual={visual} position={[0.66, 0.98, 0]} onHover={onHover} onSelect={onSelect}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.1, 36]} />
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.06, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 36]} />
        <meshStandardMaterial color="#1a2128" roughness={0.7} metalness={0.2} />
      </mesh>
      <group ref={blades} position={[0.08, 0, 0]}>
        {[0, 1, 2, 3, 4].map((blade) => (
          <mesh key={blade} rotation={[blade * ((Math.PI * 2) / 5), 0, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[0.015, 0.16, 0.035]} />
            <meshStandardMaterial color="#c9c2b4" metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </Part>
  )
}

function instrumentText(id: ComponentId, visual: ComponentVisual): string {
  const face = INSTRUMENT_FACE[id]
  if (!face) return ''
  return visual.checked || visual.warning || visual.fault ? face.after : face.before
}

export const CoolingUnit = memo(function CoolingUnit({
  visuals,
  reducedMotion,
  onHover,
  onSelect,
  onUnavailable,
}: CoolingUnitProps) {
  const nameplate = useMemo(() => plateTexture('HYDRACOOL', '#8d734c'), [])
  useEffect(() => () => nameplate.dispose(), [nameplate])

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [2.15, 1.28, 2.7], fov: 33 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.setClearColor('#0e1114')
        const onLost = (event: Event) => {
          event.preventDefault()
          onUnavailable?.()
        }
        gl.domElement.addEventListener('webglcontextlost', onLost)
      }}
    >
      <fog attach="fog" args={['#0e1114', 7, 14]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[4.2, 6.2, 3.4]}
        intensity={2.5}
        color="#f3f0e8"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3.5, 2.4, -2]} intensity={0.45} color="#9aafc0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color="#14181c" roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.1, -1.4]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#101418" roughness={1} metalness={0} />
      </mesh>

      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.08, 0.74]} />
        <meshStandardMaterial color="#3c434a" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.16, 1.44, 0.6]} />
        <meshStandardMaterial color="#7d858d" metalness={0.62} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.84, 0.3]}>
        <boxGeometry args={[1.02, 1.22, 0.03]} />
        <meshStandardMaterial color="#232a31" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.36, 0.34]}>
        <planeGeometry args={[0.46, 0.1]} />
        <meshBasicMaterial map={nameplate} toneMapped={false} />
      </mesh>

      <Part id="air_outlet" visual={visuals.air_outlet} position={[0, 1.58, 0.08]} onHover={onHover} onSelect={onSelect}>
        <mesh castShadow>
          <boxGeometry args={[0.72, 0.14, 0.46]} />
          <meshStandardMaterial {...finish('#6a727a', visuals.air_outlet)} />
        </mesh>
        <group position={[0, 0.08, 0.08]}>
          {[-0.22, -0.07, 0.08, 0.23].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.03, 0.05, 0.28]} />
              <meshStandardMaterial color="#1c232a" />
            </mesh>
          ))}
        </group>
      </Part>

      <Part id="control_panel" visual={visuals.control_panel} position={[0, 1.16, 0.33]} onHover={onHover} onSelect={onSelect}>
        <mesh>
          <boxGeometry args={[0.42, 0.16, 0.03]} />
          <meshStandardMaterial {...finish('#1a2128', visuals.control_panel)} />
        </mesh>
        <DisplayFace text={instrumentText('control_panel', visuals.control_panel)} accent="#8d734c" width={0.36} height={0.12} />
      </Part>

      <Part id="temperature_display" visual={visuals.temperature_display} position={[-0.32, 0.9, 0.33]} onHover={onHover} onSelect={onSelect}>
        <mesh>
          <boxGeometry args={[0.3, 0.16, 0.03]} />
          <meshStandardMaterial {...finish('#161c22', visuals.temperature_display)} />
        </mesh>
        <DisplayFace text={instrumentText('temperature_display', visuals.temperature_display)} accent="#d08a4c" width={0.26} height={0.12} />
      </Part>

      <Part id="pressure_gauge" visual={visuals.pressure_gauge} position={[0.34, 0.9, 0.33]} onHover={onHover} onSelect={onSelect}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 32]} />
          <meshStandardMaterial {...finish('#c8c2b6', visuals.pressure_gauge)} />
        </mesh>
        <mesh position={[0, 0, 0.03]} rotation={[0, 0, visuals.pressure_gauge.checked ? 0.9 : 0.15]}>
          <boxGeometry args={[0.08, 0.008, 0.008]} />
          <meshStandardMaterial color={visuals.pressure_gauge.warning ? '#d08a4c' : '#1b140c'} />
        </mesh>
      </Part>

      <Part id="filter_panel" visual={visuals.filter_panel} position={[0, 0.52, visuals.filter_panel.checked ? 0.4 : 0.33]} onHover={onHover} onSelect={onSelect}>
        <mesh castShadow>
          <boxGeometry args={[0.64, 0.42, 0.05]} />
          <meshStandardMaterial {...finish(visuals.filter_panel.fault ? '#6d5844' : '#343b43', visuals.filter_panel)} />
        </mesh>
        {visuals.filter_panel.checked ? (
          <mesh position={[0, 0, -0.04]}>
            <boxGeometry args={[0.5, 0.3, 0.03]} />
            <meshStandardMaterial color="#8a623d" roughness={0.9} />
          </mesh>
        ) : null}
        <DisplayFace text={instrumentText('filter_panel', visuals.filter_panel)} accent="#c45c4a" width={0.24} height={0.08} />
      </Part>

      <Part id="air_intake" visual={visuals.air_intake} position={[0, 0.24, 0.33]} onHover={onHover} onSelect={onSelect}>
        <mesh>
          <boxGeometry args={[0.86, 0.16, 0.03]} />
          <meshStandardMaterial {...finish('#2a3138', visuals.air_intake)} />
        </mesh>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((x) => (
          <mesh key={x} position={[x, 0, 0.02]}>
            <boxGeometry args={[0.05, 0.1, 0.01]} />
            <meshStandardMaterial color="#10161b" />
          </mesh>
        ))}
      </Part>

      <Fan visual={visuals.fan} reducedMotion={reducedMotion} onHover={onHover} onSelect={onSelect} />

      <Part id="power_switch" visual={visuals.power_switch} position={[-0.64, 0.72, 0.08]} onHover={onHover} onSelect={onSelect}>
        <mesh>
          <boxGeometry args={[0.08, 0.16, 0.08]} />
          <meshStandardMaterial {...finish('#2c333a', visuals.power_switch)} />
        </mesh>
        <mesh position={[0.05, 0.04, 0]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.02, 0.1, 0.03]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
      </Part>

      <Part id="status_indicator" visual={visuals.status_indicator} position={[-0.64, 0.98, 0.08]} onHover={onHover} onSelect={onSelect}>
        <mesh>
          <sphereGeometry args={[0.045, 24, 24]} />
          <meshStandardMaterial color="#8fbf9f" emissive="#8fbf9f" emissiveIntensity={visuals.status_indicator.highlighted ? 0.8 : 0.35} />
        </mesh>
      </Part>

      <Part id="emergency_stop" visual={visuals.emergency_stop} position={[0.46, 1.16, 0.34]} onHover={onHover} onSelect={onSelect}>
        <mesh>
          <cylinderGeometry args={[0.055, 0.07, 0.05, 24]} />
          <meshStandardMaterial color="#8e3b34" roughness={0.45} metalness={0.2} emissive={visuals.emergency_stop.highlighted ? '#c45c4a' : '#000'} emissiveIntensity={0.2} />
        </mesh>
      </Part>

      <Part id="compressor" visual={visuals.compressor} position={[0.18, 0.28, -0.22]} onHover={onHover} onSelect={onSelect}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.46, 28]} />
          <meshStandardMaterial {...finish('#4e565e', visuals.compressor)} />
        </mesh>
        <mesh position={[0.18, 0.08, 0.08]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshStandardMaterial color={visuals.compressor.checked ? '#8fbf9f' : '#1d242b'} emissive={visuals.compressor.checked ? '#8fbf9f' : '#000'} emissiveIntensity={0.2} />
        </mesh>
      </Part>

      <OrbitControls
        makeDefault
        target={[0, 0.78, 0]}
        enablePan={false}
        enableDamping
        minDistance={1.8}
        maxDistance={5.2}
        minPolarAngle={0.8}
        maxPolarAngle={1.45}
      />
    </Canvas>
  )
})
