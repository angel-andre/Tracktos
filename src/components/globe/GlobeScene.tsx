import { useRef, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, Html } from "@react-three/drei";
import { TextureLoader } from "three";
import type { Transaction } from "@/hooks/useRealtimeTransactions";
import type { ValidatorNode } from "@/hooks/useValidatorNodes";

interface GlobeSceneProps {
  transactions: Transaction[];
  validators: ValidatorNode[];
  onTransactionSelect: (tx: Transaction | null) => void;
  getValidatorLocation?: (proposerAddress: string | null) => ValidatorNode | null;
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

// Transaction pulse effects on validator nodes - now uses real proposer data
interface TransactionPulse {
  id: string;
  validatorCity: string;
  lat: number;
  lng: number;
  progress: number;
  color: THREE.Color;
  type: string;
  proposer: string | null;
}

function TransactionPulses({ 
  transactions, 
  validators,
  getValidatorLocation 
}: { 
  transactions: Transaction[];
  validators: ValidatorNode[];
  getValidatorLocation?: (proposerAddress: string | null) => ValidatorNode | null;
}) {
  const pulsesRef = useRef<TransactionPulse[]>([]);
  const processedTxRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  // Add new pulses when new transactions arrive
  useEffect(() => {
    if (transactions.length === 0 || validators.length === 0) return;
    
    // Process new transactions that haven't been seen
    const newPulses: TransactionPulse[] = [];
    
    for (const tx of transactions.slice(0, 5)) {
      if (processedTxRef.current.has(tx.hash)) continue;
      processedTxRef.current.add(tx.hash);
      
      // Get validator location from proposer address
      let validator: ValidatorNode | null = null;
      
      if (tx.proposer && getValidatorLocation) {
        validator = getValidatorLocation(tx.proposer);
      }
      
      // Fallback: if no proposer or mapping, use weighted random distribution
      if (!validator) {
        // Use deterministic selection based on transaction hash
        let hash = 0;
        for (let i = 0; i < tx.hash.length; i++) {
          hash = ((hash << 5) - hash) + tx.hash.charCodeAt(i);
          hash = hash & hash;
        }
        const totalCount = validators.reduce((sum, v) => sum + v.count, 0);
        const target = Math.abs(hash) % totalCount;
        let cumulative = 0;
        for (const v of validators) {
          cumulative += v.count;
          if (target < cumulative) {
            validator = v;
            break;
          }
        }
        if (!validator) validator = validators[0];
      }
      
      let color = new THREE.Color("#00d9ff");
      if (tx.type === "Transfer") color = new THREE.Color("#00ff88");
      if (tx.type === "Swap") color = new THREE.Color("#ff6b00");
      if (tx.type === "Stake") color = new THREE.Color("#bf00ff");
      if (tx.type === "NFT") color = new THREE.Color("#ffcc00");
      if (tx.type === "Contract") color = new THREE.Color("#00aaff");

      newPulses.push({
        id: tx.hash,
        validatorCity: validator.city,
        lat: validator.lat,
        lng: validator.lng,
        progress: 0,
        color,
        type: tx.type,
        proposer: tx.proposer,
      });
    }
    
    if (newPulses.length > 0) {
      pulsesRef.current = [...newPulses, ...pulsesRef.current].slice(0, 25);
    }
    
    // Clean up old processed transactions
    if (processedTxRef.current.size > 200) {
      const txHashes = new Set(transactions.map(t => t.hash));
      processedTxRef.current = new Set(
        [...processedTxRef.current].filter(h => txHashes.has(h))
      );
    }
  }, [transactions, validators, getValidatorLocation]);

  useFrame((_, delta) => {
    let needsUpdate = false;
    
    pulsesRef.current = pulsesRef.current
      .map((pulse) => {
        const newProgress = pulse.progress + delta * 0.8;
        if (newProgress !== pulse.progress) needsUpdate = true;
        return { ...pulse, progress: newProgress };
      })
      .filter((pulse) => pulse.progress < 2);
    
    if (needsUpdate) forceUpdate(n => n + 1);
  });

  return (
    <group>
      {pulsesRef.current.map((pulse) => {
        const position = latLngToVector3(pulse.lat, pulse.lng, 1.02);
        const opacity = Math.max(0, 1 - pulse.progress * 0.5);
        const scale = 1 + pulse.progress * 2;
        
        return (
          <group key={pulse.id}>
            {/* Expanding ring pulse */}
            <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.015 * scale, 0.02 * scale, 24]} />
              <meshBasicMaterial
                color={pulse.color}
                transparent
                opacity={opacity * 0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Center flash */}
            {pulse.progress < 0.5 && (
              <mesh position={position}>
                <sphereGeometry args={[0.012, 12, 12]} />
                <meshBasicMaterial
                  color={pulse.color}
                  transparent
                  opacity={(0.5 - pulse.progress) * 2}
                />
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
  const maxCount = Math.max(...validators.map((v) => v.count));

  return (
    <group>
      {validators.map((validator) => {
        const position = latLngToVector3(validator.lat, validator.lng, 1.02);
        const isHovered = hovered === validator.city;

        const baseSize = 0.011;
        const scaleFactor = validator.count / maxCount;
        const size = baseSize + scaleFactor * 0.013;

        const intensity = 0.6 + scaleFactor * 0.4;

        const dotColor = isHovered
          ? "hsl(0, 0%, 100%)"
          : "hsl(168, 100%, 50%)";

        const ringColor = "hsl(190, 100%, 50%)";

        return (
          <group key={validator.city}>
            {/* Validator node dot */}
            <mesh
              position={position}
              onPointerOver={() => setHovered(validator.city)}
              onPointerOut={() => setHovered(null)}
            >
              <sphereGeometry args={[size, 12, 12]} />
              <meshBasicMaterial
                color={dotColor}
                transparent
                opacity={isHovered ? 1 : intensity}
              />
            </mesh>

            {/* Halo ring */}
            {validator.count <= 2 && (
              <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[size * 1.6, size * 2.4, 28]} />
                <meshBasicMaterial
                  color={ringColor}
                  transparent
                  opacity={isHovered ? 0.85 : 0.28}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {validator.count > 2 && (
              <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[size * 1.5, size * 2, 24]} />
                <meshBasicMaterial
                  color={ringColor}
                  transparent
                  opacity={isHovered ? 0.8 : 0.22}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Label on hover */}
            {isHovered && (
              <Html position={position} center style={{ pointerEvents: "none" }}>
                <div className="bg-card/95 backdrop-blur-sm border border-primary/50 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap transform -translate-y-8">
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

export function GlobeScene({ transactions, validators, onTransactionSelect, getValidatorLocation }: GlobeSceneProps) {
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
      
      {/* Transaction pulse effects on validators - now uses real proposer data */}
      <TransactionPulses 
        transactions={transactions} 
        validators={validators}
        getValidatorLocation={getValidatorLocation}
      />
    </group>
  );
}
