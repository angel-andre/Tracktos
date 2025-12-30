import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, Line, Html } from "@react-three/drei";
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
  const [arcs, setArcs] = useState<TransactionArc[]>([]);
  
  useEffect(() => {
    const newArcs = transactions.slice(0, 15).map((tx) => {
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
    
    setArcs(newArcs);
  }, [transactions]);
  
  useFrame((_, delta) => {
    setArcs((prev) =>
      prev.map((arc) => ({
        ...arc,
        progress: Math.min(arc.progress + delta * 0.4, 1),
      })).filter((arc) => arc.progress < 1)
    );
  });

  return (
    <group>
      {arcs.map((arc) => {
        const visiblePoints = Math.floor(arc.points.length * arc.progress);
        const displayPoints = arc.points.slice(0, Math.max(visiblePoints, 2));
        
        return (
          <group key={arc.id}>
            <Line
              points={displayPoints}
              color={arc.color}
              lineWidth={1.5}
              transparent
              opacity={1 - arc.progress * 0.5}
            />
            <mesh position={arc.startPoint}>
              <sphereGeometry args={[0.012, 12, 12]} />
              <meshBasicMaterial color={arc.color} transparent opacity={0.8 - arc.progress * 0.5} />
            </mesh>
            {arc.progress > 0.8 && (
              <mesh position={arc.endPoint}>
                <sphereGeometry args={[0.015 + (arc.progress - 0.8) * 0.08, 12, 12]} />
                <meshBasicMaterial color={arc.color} transparent opacity={(1 - arc.progress) * 2} />
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
  
  return (
    <group>
      {validators.map((validator) => {
        const position = latLngToVector3(validator.lat, validator.lng, 1.02);
        const isHovered = hovered === validator.city;
        const size = Math.min(0.02 + validator.count * 0.004, 0.06);
        
        return (
          <group key={validator.city}>
            {/* Outer glow */}
            <mesh position={position}>
              <sphereGeometry args={[size * 1.5, 16, 16]} />
              <meshBasicMaterial 
                color="#00d9ff" 
                transparent 
                opacity={isHovered ? 0.4 : 0.15}
              />
            </mesh>
            {/* Inner marker */}
            <mesh 
              position={position}
              onPointerOver={() => setHovered(validator.city)}
              onPointerOut={() => setHovered(null)}
            >
              <sphereGeometry args={[size, 16, 16]} />
              <meshBasicMaterial 
                color={isHovered ? "#ffffff" : "#00d9ff"}
              />
            </mesh>
            {/* Label on hover */}
            {isHovered && (
              <Html position={position} center style={{ pointerEvents: 'none' }}>
                <div className="bg-card/95 backdrop-blur-sm border border-primary/50 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                  <p className="text-sm font-semibold text-foreground">{validator.city}</p>
                  <p className="text-xs text-primary">{validator.count} validator{validator.count > 1 ? 's' : ''}</p>
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
  
  // Create Earth texture with continents
  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    
    // Ocean base - dark blue
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw simplified continents
    ctx.fillStyle = '#1a2d4a';
    ctx.strokeStyle = '#2a4a6a';
    ctx.lineWidth = 2;
    
    // North America
    ctx.beginPath();
    ctx.moveTo(180, 180);
    ctx.bezierCurveTo(150, 200, 120, 280, 140, 350);
    ctx.bezierCurveTo(160, 400, 200, 420, 280, 400);
    ctx.bezierCurveTo(340, 380, 380, 320, 360, 260);
    ctx.bezierCurveTo(340, 200, 300, 160, 260, 140);
    ctx.bezierCurveTo(220, 120, 200, 140, 180, 180);
    ctx.fill();
    ctx.stroke();
    
    // South America
    ctx.beginPath();
    ctx.moveTo(320, 480);
    ctx.bezierCurveTo(280, 520, 260, 600, 280, 700);
    ctx.bezierCurveTo(300, 780, 340, 820, 380, 780);
    ctx.bezierCurveTo(400, 720, 400, 620, 380, 540);
    ctx.bezierCurveTo(360, 480, 340, 460, 320, 480);
    ctx.fill();
    ctx.stroke();
    
    // Europe
    ctx.beginPath();
    ctx.moveTo(980, 180);
    ctx.bezierCurveTo(940, 200, 920, 260, 940, 320);
    ctx.bezierCurveTo(960, 360, 1020, 380, 1080, 360);
    ctx.bezierCurveTo(1140, 340, 1180, 280, 1160, 220);
    ctx.bezierCurveTo(1140, 180, 1080, 160, 1020, 160);
    ctx.bezierCurveTo(1000, 160, 990, 170, 980, 180);
    ctx.fill();
    ctx.stroke();
    
    // Africa
    ctx.beginPath();
    ctx.moveTo(980, 400);
    ctx.bezierCurveTo(920, 420, 900, 500, 920, 600);
    ctx.bezierCurveTo(940, 700, 1000, 760, 1080, 740);
    ctx.bezierCurveTo(1140, 720, 1180, 640, 1160, 540);
    ctx.bezierCurveTo(1140, 460, 1080, 400, 1020, 380);
    ctx.bezierCurveTo(1000, 380, 990, 390, 980, 400);
    ctx.fill();
    ctx.stroke();
    
    // Asia
    ctx.beginPath();
    ctx.moveTo(1200, 160);
    ctx.bezierCurveTo(1160, 180, 1140, 240, 1160, 320);
    ctx.bezierCurveTo(1180, 400, 1240, 460, 1340, 480);
    ctx.bezierCurveTo(1480, 500, 1600, 460, 1680, 380);
    ctx.bezierCurveTo(1760, 300, 1780, 220, 1720, 160);
    ctx.bezierCurveTo(1640, 100, 1500, 80, 1400, 100);
    ctx.bezierCurveTo(1300, 120, 1240, 140, 1200, 160);
    ctx.fill();
    ctx.stroke();
    
    // Australia
    ctx.beginPath();
    ctx.moveTo(1600, 600);
    ctx.bezierCurveTo(1560, 620, 1540, 680, 1560, 740);
    ctx.bezierCurveTo(1580, 780, 1640, 800, 1720, 780);
    ctx.bezierCurveTo(1780, 760, 1820, 700, 1800, 640);
    ctx.bezierCurveTo(1780, 600, 1720, 580, 1660, 580);
    ctx.bezierCurveTo(1630, 580, 1610, 590, 1600, 600);
    ctx.fill();
    ctx.stroke();
    
    // Add grid lines
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.08)';
    ctx.lineWidth = 1;
    
    // Latitude lines
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = (90 - lat) / 180 * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Longitude lines
    for (let lng = 0; lng < 360; lng += 20) {
      const x = lng / 360 * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Add subtle glow spots for major tech hubs
    const glowSpots = [
      { x: 0.12, y: 0.38 }, // Silicon Valley
      { x: 0.15, y: 0.35 }, // NYC
      { x: 0.50, y: 0.32 }, // London
      { x: 0.52, y: 0.34 }, // Frankfurt
      { x: 0.56, y: 0.30 }, // Helsinki
      { x: 0.85, y: 0.36 }, // Tokyo
      { x: 0.82, y: 0.42 }, // Hong Kong
      { x: 0.80, y: 0.38 }, // Seoul
      { x: 0.87, y: 0.65 }, // Sydney
    ];
    
    glowSpots.forEach((spot) => {
      const gradient = ctx.createRadialGradient(
        spot.x * canvas.width, spot.y * canvas.height, 0,
        spot.x * canvas.width, spot.y * canvas.height, 40
      );
      gradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 217, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Subtle rotation for clouds layer
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.015;
    }
  });

  return (
    <group>
      {/* Main globe */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshStandardMaterial
          map={earthTexture}
          metalness={0.1}
          roughness={0.7}
        />
      </Sphere>
      
      {/* Atmosphere inner glow */}
      <Sphere args={[0.995, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Atmosphere outer glow */}
      <Sphere args={[1.08, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Second atmosphere layer */}
      <Sphere ref={cloudsRef} args={[1.02, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.02}
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
