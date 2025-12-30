import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
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
        const size = Math.min(0.02 + validator.count * 0.003, 0.05);
        
        return (
          <group key={validator.city}>
            {/* Outer glow */}
            <mesh position={position}>
              <sphereGeometry args={[size * 1.8, 16, 16]} />
              <meshBasicMaterial 
                color="#00d9ff" 
                transparent 
                opacity={isHovered ? 0.5 : 0.2}
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
  
  // Create Earth texture with visible continents
  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    
    // Ocean - dark blue background
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGradient.addColorStop(0, '#0c1929');
    oceanGradient.addColorStop(0.5, '#0a1525');
    oceanGradient.addColorStop(1, '#0c1929');
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Continent colors - brighter teal/cyan for visibility
    const landColor = '#1a4a5a';
    const landBorder = '#2a7a8a';
    const landHighlight = '#3a9aaa';
    
    ctx.fillStyle = landColor;
    ctx.strokeStyle = landBorder;
    ctx.lineWidth = 3;
    
    // Helper function to draw filled landmass
    const drawLand = (path: () => void) => {
      ctx.beginPath();
      path();
      ctx.fill();
      ctx.stroke();
    };
    
    // North America (more detailed shape)
    drawLand(() => {
      ctx.moveTo(120, 200);
      ctx.lineTo(100, 240);
      ctx.lineTo(80, 300);
      ctx.lineTo(100, 380);
      ctx.lineTo(140, 420);
      ctx.lineTo(200, 440);
      ctx.lineTo(280, 420);
      ctx.lineTo(340, 380);
      ctx.lineTo(380, 340);
      ctx.lineTo(400, 280);
      ctx.lineTo(380, 220);
      ctx.lineTo(340, 180);
      ctx.lineTo(280, 150);
      ctx.lineTo(220, 140);
      ctx.lineTo(160, 160);
      ctx.closePath();
    });
    
    // Greenland
    drawLand(() => {
      ctx.moveTo(420, 120);
      ctx.lineTo(400, 160);
      ctx.lineTo(420, 220);
      ctx.lineTo(480, 240);
      ctx.lineTo(520, 200);
      ctx.lineTo(500, 140);
      ctx.lineTo(460, 100);
      ctx.closePath();
    });
    
    // South America
    drawLand(() => {
      ctx.moveTo(280, 480);
      ctx.lineTo(240, 520);
      ctx.lineTo(220, 600);
      ctx.lineTo(240, 700);
      ctx.lineTo(280, 780);
      ctx.lineTo(340, 840);
      ctx.lineTo(380, 820);
      ctx.lineTo(400, 740);
      ctx.lineTo(420, 640);
      ctx.lineTo(400, 560);
      ctx.lineTo(360, 500);
      ctx.lineTo(320, 470);
      ctx.closePath();
    });
    
    // Europe
    drawLand(() => {
      ctx.moveTo(940, 200);
      ctx.lineTo(920, 240);
      ctx.lineTo(900, 300);
      ctx.lineTo(920, 360);
      ctx.lineTo(980, 380);
      ctx.lineTo(1060, 380);
      ctx.lineTo(1120, 360);
      ctx.lineTo(1160, 320);
      ctx.lineTo(1180, 260);
      ctx.lineTo(1160, 200);
      ctx.lineTo(1100, 160);
      ctx.lineTo(1020, 160);
      ctx.lineTo(960, 180);
      ctx.closePath();
    });
    
    // UK/Ireland
    drawLand(() => {
      ctx.moveTo(880, 220);
      ctx.lineTo(870, 260);
      ctx.lineTo(880, 300);
      ctx.lineTo(910, 300);
      ctx.lineTo(920, 260);
      ctx.lineTo(910, 220);
      ctx.closePath();
    });
    
    // Africa
    drawLand(() => {
      ctx.moveTo(940, 420);
      ctx.lineTo(900, 480);
      ctx.lineTo(880, 560);
      ctx.lineTo(900, 660);
      ctx.lineTo(960, 760);
      ctx.lineTo(1040, 800);
      ctx.lineTo(1120, 780);
      ctx.lineTo(1180, 700);
      ctx.lineTo(1200, 600);
      ctx.lineTo(1180, 500);
      ctx.lineTo(1120, 440);
      ctx.lineTo(1040, 400);
      ctx.lineTo(980, 400);
      ctx.closePath();
    });
    
    // Asia (main block)
    drawLand(() => {
      ctx.moveTo(1200, 180);
      ctx.lineTo(1160, 240);
      ctx.lineTo(1180, 320);
      ctx.lineTo(1220, 400);
      ctx.lineTo(1300, 460);
      ctx.lineTo(1400, 500);
      ctx.lineTo(1520, 500);
      ctx.lineTo(1640, 460);
      ctx.lineTo(1720, 400);
      ctx.lineTo(1780, 320);
      ctx.lineTo(1800, 240);
      ctx.lineTo(1780, 180);
      ctx.lineTo(1700, 120);
      ctx.lineTo(1580, 100);
      ctx.lineTo(1460, 100);
      ctx.lineTo(1340, 120);
      ctx.lineTo(1260, 160);
      ctx.closePath();
    });
    
    // India
    drawLand(() => {
      ctx.moveTo(1340, 420);
      ctx.lineTo(1300, 480);
      ctx.lineTo(1320, 560);
      ctx.lineTo(1380, 600);
      ctx.lineTo(1440, 560);
      ctx.lineTo(1460, 480);
      ctx.lineTo(1420, 420);
      ctx.closePath();
    });
    
    // Southeast Asia/Indonesia
    drawLand(() => {
      ctx.moveTo(1520, 520);
      ctx.lineTo(1500, 560);
      ctx.lineTo(1520, 620);
      ctx.lineTo(1600, 640);
      ctx.lineTo(1680, 620);
      ctx.lineTo(1720, 560);
      ctx.lineTo(1680, 520);
      ctx.lineTo(1600, 500);
      ctx.closePath();
    });
    
    // Japan
    drawLand(() => {
      ctx.moveTo(1760, 300);
      ctx.lineTo(1740, 340);
      ctx.lineTo(1760, 400);
      ctx.lineTo(1800, 420);
      ctx.lineTo(1840, 380);
      ctx.lineTo(1840, 320);
      ctx.lineTo(1800, 280);
      ctx.closePath();
    });
    
    // Australia
    drawLand(() => {
      ctx.moveTo(1580, 640);
      ctx.lineTo(1540, 700);
      ctx.lineTo(1560, 780);
      ctx.lineTo(1640, 840);
      ctx.lineTo(1760, 840);
      ctx.lineTo(1840, 780);
      ctx.lineTo(1860, 700);
      ctx.lineTo(1820, 640);
      ctx.lineTo(1740, 620);
      ctx.lineTo(1660, 620);
      ctx.closePath();
    });
    
    // New Zealand
    drawLand(() => {
      ctx.moveTo(1920, 760);
      ctx.lineTo(1900, 800);
      ctx.lineTo(1920, 860);
      ctx.lineTo(1960, 880);
      ctx.lineTo(1980, 840);
      ctx.lineTo(1960, 780);
      ctx.closePath();
    });
    
    // Add highlight/glow to continents
    ctx.fillStyle = landHighlight;
    ctx.globalAlpha = 0.3;
    
    // Highlight major regions
    const highlights = [
      { x: 280, y: 300 }, // NA
      { x: 320, y: 620 }, // SA
      { x: 1040, y: 280 }, // Europe
      { x: 1060, y: 580 }, // Africa
      { x: 1500, y: 320 }, // Asia
      { x: 1700, y: 720 }, // Australia
    ];
    
    highlights.forEach(h => {
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 120);
      gradient.addColorStop(0, 'rgba(42, 122, 138, 0.5)');
      gradient.addColorStop(1, 'rgba(42, 122, 138, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    
    ctx.globalAlpha = 1;
    
    // Add grid lines
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.12)';
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
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Subtle rotation for atmosphere
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <group>
      {/* Main globe */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshBasicMaterial map={earthTexture} />
      </Sphere>
      
      {/* Atmosphere glow - inner */}
      <Sphere args={[1.02, 32, 32]}>
        <meshBasicMaterial
          color="#00b4dc"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Atmosphere glow - outer */}
      <Sphere args={[1.08, 32, 32]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Wireframe overlay for tech look */}
      <Sphere ref={cloudsRef} args={[1.01, 24, 24]}>
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.03}
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
