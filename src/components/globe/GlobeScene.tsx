import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sphere, Line } from "@react-three/drei";
import type { Transaction } from "@/hooks/useRealtimeTransactions";

interface GlobeSceneProps {
  transactions: Transaction[];
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
    
    // Quadratic bezier curve
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

function TransactionArcs({ transactions, onTransactionSelect }: GlobeSceneProps) {
  const [arcs, setArcs] = useState<TransactionArc[]>([]);
  const particlesRef = useRef<THREE.Points>(null);
  
  // Create arcs for new transactions
  useEffect(() => {
    const newArcs = transactions.slice(0, 20).map((tx) => {
      const start = latLngToVector3(tx.fromLat, tx.fromLng);
      const end = latLngToVector3(tx.toLat, tx.toLng);
      const points = generateArcPoints(start, end);
      
      // Color based on transaction type
      let color = new THREE.Color("#00d9ff"); // Default teal
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
  
  // Animate arcs
  useFrame((_, delta) => {
    setArcs((prev) =>
      prev.map((arc) => ({
        ...arc,
        progress: Math.min(arc.progress + delta * 0.5, 1),
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
            {/* Arc line */}
            <Line
              points={displayPoints}
              color={arc.color}
              lineWidth={2}
              transparent
              opacity={1 - arc.progress * 0.5}
            />
            
            {/* Start point glow */}
            <mesh position={arc.startPoint}>
              <sphereGeometry args={[0.015, 16, 16]} />
              <meshBasicMaterial 
                color={arc.color} 
                transparent 
                opacity={0.8 - arc.progress * 0.5}
              />
            </mesh>
            
            {/* End point pulse */}
            {arc.progress > 0.8 && (
              <mesh position={arc.endPoint}>
                <sphereGeometry args={[0.02 + (arc.progress - 0.8) * 0.1, 16, 16]} />
                <meshBasicMaterial 
                  color={arc.color} 
                  transparent 
                  opacity={(1 - arc.progress) * 2}
                />
              </mesh>
            )}
            
            {/* Moving particle along arc */}
            {visiblePoints > 0 && visiblePoints < arc.points.length && (
              <mesh position={arc.points[visiblePoints - 1]}>
                <sphereGeometry args={[0.02, 16, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function GlobeScene({ transactions, onTransactionSelect }: GlobeSceneProps) {
  const globeRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.LineSegments>(null);
  
  // Create globe texture with grid pattern
  const globeTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Dark base
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle noise
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillStyle = `rgba(0, 217, 255, ${Math.random() * 0.03})`;
      ctx.fillRect(x, y, 1, 1);
    }
    
    // Latitude lines
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.15)';
    ctx.lineWidth = 1;
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
    
    // Add some "hot spots" for major cities
    const hotspots = [
      { x: 0.7, y: 0.35 }, // Tokyo
      { x: 0.05, y: 0.4 },  // New York
      { x: 0.5, y: 0.38 },  // London
      { x: 0.75, y: 0.6 },  // Sydney
      { x: 0.15, y: 0.55 }, // São Paulo
      { x: 0.55, y: 0.32 }, // Berlin
      { x: 0.72, y: 0.42 }, // Hong Kong
    ];
    
    hotspots.forEach((spot) => {
      const gradient = ctx.createRadialGradient(
        spot.x * canvas.width, spot.y * canvas.height, 0,
        spot.x * canvas.width, spot.y * canvas.height, 30
      );
      gradient.addColorStop(0, 'rgba(0, 217, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 217, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Subtle rotation animation
  useFrame((_, delta) => {
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group>
      {/* Main globe */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshStandardMaterial
          map={globeTexture}
          transparent
          opacity={0.95}
          metalness={0.1}
          roughness={0.8}
        />
      </Sphere>
      
      {/* Inner glow */}
      <Sphere args={[0.99, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Outer atmosphere glow */}
      <Sphere ref={atmosphereRef} args={[1.05, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Second atmosphere layer */}
      <Sphere args={[1.15, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Transaction arcs */}
      <TransactionArcs 
        transactions={transactions} 
        onTransactionSelect={onTransactionSelect}
      />
    </group>
  );
}
