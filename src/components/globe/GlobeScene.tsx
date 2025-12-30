import { useRef, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, Line, Html } from "@react-three/drei";
import { TextureLoader } from "three";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { ValidatorNode } from "@/hooks/useValidatorNodes";

interface GlobeSceneProps {
  transactions: Transaction[];
  validators: ValidatorNode[];
  onTransactionSelect: (tx: Transaction | null) => void;
}

// Convert lat/lng to 3D coordinates on sphere
function latLngToVector3(lat: number, lng: number, radius: number = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
}

// Generate arc points between two coordinates
function generateArcPoints(start: THREE.Vector3, end: THREE.Vector3, segments: number = 50): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const midPoint = start.clone().add(end).multiplyScalar(0.5);
  const distance = start.distanceTo(end);
  midPoint.normalize().multiplyScalar(1 + distance * 0.3);
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3();
    
    point.x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * midPoint.x + t * t * end.x;
    point.y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * midPoint.y + t * t * end.y;
    point.z = (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * midPoint.z + t * t * end.z;
    
    points.push(point);
  }
  
  return points;
}

interface TransactionArc {
  id: string;
  points: THREE.Vector3[];
  progress: number;
  color: THREE.Color;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  transaction: Transaction;
}

function TransactionArcs({ transactions, onTransactionSelect }: { transactions: Transaction[], onTransactionSelect: (tx: Transaction | null) => void }) {
  const arcsRef = useRef<TransactionArc[]>([]);
  const [, forceUpdate] = useState(0);
  
  // Add new transactions without replacing existing ones
  useEffect(() => {
    const existingIds = new Set(arcsRef.current.map(a => a.id));
    
    const newArcs = transactions.slice(0, 20)
      .filter(tx => !existingIds.has(tx.hash))
      .map((tx) => {
        const start = latLngToVector3(tx.fromLat, tx.fromLng, 1.01);
        const end = latLngToVector3(tx.toLat, tx.toLng, 1.01);
        const points = generateArcPoints(start, end);
        
        let color = new THREE.Color("#00d9ff");
        if (tx.type === "Transfer") color = new THREE.Color("#00ff88");
        if (tx.type === "Swap") color = new THREE.Color("#ff6b00");
        if (tx.type === "Stake") color = new THREE.Color("#bf00ff");
        if (tx.type === "NFT") color = new THREE.Color("#ffcc00");
        
        return {
          id: tx.hash,
          points,
          progress: 0,
          color,
          startPoint: start,
          endPoint: end,
          transaction: tx,
        };
      });
    
    if (newArcs.length > 0) {
      arcsRef.current = [...arcsRef.current, ...newArcs].slice(-25); // Keep max 25 arcs
    }
  }, [transactions]);
  
  useFrame((_, delta) => {
    let needsUpdate = false;
    
    arcsRef.current = arcsRef.current
      .map((arc) => {
        const newProgress = Math.min(arc.progress + delta * 0.25, 1.5); // Slower, extends past 1 for fade
        if (newProgress !== arc.progress) needsUpdate = true;
        return { ...arc, progress: newProgress };
      })
      .filter((arc) => arc.progress < 1.5); // Remove only after full fade
    
    if (needsUpdate) forceUpdate(n => n + 1);
  });

  return (
    <group>
      {arcsRef.current.map((arc) => {
        // Draw progress (0-1 draws the line, 1-1.5 fades out)
        const drawProgress = Math.min(arc.progress, 1);
        const fadeProgress = arc.progress > 1 ? (arc.progress - 1) * 2 : 0; // 0-1 fade after draw complete
        const opacity = Math.max(0, 1 - fadeProgress);
        
        const visiblePoints = Math.floor(arc.points.length * drawProgress);
        const displayPoints = arc.points.slice(0, Math.max(visiblePoints, 2));
        
        // Traveling dot position
        const dotIndex = Math.min(visiblePoints, arc.points.length - 1);
        const dotPosition = arc.points[dotIndex] || arc.startPoint;
        
        return (
          <group key={arc.id}>
            {/* Main arc line */}
            <Line
              points={displayPoints}
              color={arc.color}
              lineWidth={2}
              transparent
              opacity={opacity * 0.8}
            />
            {/* Traveling dot along the arc */}
            {drawProgress < 1 && (
              <mesh position={dotPosition}>
                <sphereGeometry args={[0.008, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
              </mesh>
            )}
            {/* Start point glow */}
            <mesh position={arc.startPoint}>
              <sphereGeometry args={[0.006, 8, 8]} />
              <meshBasicMaterial color={arc.color} transparent opacity={opacity * 0.6} />
            </mesh>
            {/* End point pulse on arrival */}
            {drawProgress >= 0.95 && (
              <mesh position={arc.endPoint}>
                <sphereGeometry args={[0.008 + fadeProgress * 0.02, 8, 8]} />
                <meshBasicMaterial color={arc.color} transparent opacity={opacity * 0.8} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function ValidatorMarkers({ validators }: { validators: ValidatorNode[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Calculate max count for proportional sizing
  const maxCount = Math.max(...validators.map((v) => v.count), 1);

  return (
    <group>
      {validators.map((validator) => {
        // Skip invalid entries
        if (typeof validator.lat !== 'number' || typeof validator.lng !== 'number') {
          console.warn('Invalid validator coordinates:', validator);
          return null;
        }
        
        const position = latLngToVector3(validator.lat, validator.lng, 1.025);
        const isHovered = hovered === validator.city;

        // Much larger and brighter markers for visibility
        const baseSize = 0.018;
        const scaleFactor = validator.count / maxCount;
        const size = baseSize + scaleFactor * 0.022; // ~0.018 -> ~0.040

        // Full brightness for all nodes
        const intensity = 0.85 + scaleFactor * 0.15;

        // Bright cyan color that stands out against Earth
        const dotColor = isHovered ? "#ffffff" : "#00ffcc";
        const glowColor = "#00d9ff";

        return (
          <group key={`${validator.city}-${validator.country}`}>
            {/* Main marker dot - larger and brighter */}
            <mesh
              position={position}
              onPointerOver={() => setHovered(validator.city)}
              onPointerOut={() => setHovered(null)}
            >
              <sphereGeometry args={[size, 16, 16]} />
              <meshBasicMaterial
                color={dotColor}
                transparent
                opacity={isHovered ? 1 : intensity}
              />
            </mesh>

            {/* Outer glow ring for all nodes */}
            <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[size * 1.3, size * 2.2, 32]} />
              <meshBasicMaterial
                color={glowColor}
                transparent
                opacity={isHovered ? 0.9 : 0.5}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Extra pulse ring for larger nodes */}
            {validator.count > 3 && (
              <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[size * 2.2, size * 3, 32]} />
                <meshBasicMaterial
                  color={glowColor}
                  transparent
                  opacity={isHovered ? 0.6 : 0.25}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Label on hover */}
            {isHovered && (
              <Html position={position} center style={{ pointerEvents: "none" }}>
                <div className="bg-card/95 backdrop-blur-sm border border-primary/50 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap transform -translate-y-10">
                  <p className="text-sm font-semibold text-foreground">{validator.city}</p>
                  <p className="text-xs text-primary font-bold">
                    {validator.count} validator{validator.count > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{validator.country}</p>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function GlobeScene({ transactions, validators, onTransactionSelect }: GlobeSceneProps) {
  const globeRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  
  // Load real NASA Earth texture
  const earthTexture = useLoader(TextureLoader, '/textures/earth-blue-marble.jpg');
  const bumpTexture = useLoader(TextureLoader, '/textures/earth-topology.png');

  // Subtle rotation for atmosphere
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <group>
      {/* Main globe with NASA texture */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshStandardMaterial 
          map={earthTexture}
          bumpMap={bumpTexture}
          bumpScale={0.03}
          metalness={0}
          roughness={0.6}
          emissive="#1a3a5c"
          emissiveIntensity={0.15}
        />
      </Sphere>
      
      {/* Atmosphere glow - inner */}
      <Sphere args={[1.02, 32, 32]}>
        <meshBasicMaterial
          color="#4da6ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Atmosphere glow - outer */}
      <Sphere args={[1.1, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Wireframe overlay for tech look */}
      <Sphere ref={cloudsRef} args={[1.015, 36, 36]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.04}
          wireframe
        />
      </Sphere>
      
      {/* Validator node markers */}
      <ValidatorMarkers validators={validators} />
      
      {/* Transaction arcs */}
      <TransactionArcs 
        transactions={transactions} 
        onTransactionSelect={onTransactionSelect}
      />
    </group>
  );
}
