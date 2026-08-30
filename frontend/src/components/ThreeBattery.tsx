// src/components/ThreeBattery.tsx
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ThreeBatteryProps {
  soh: number; // state of health between 0.7 and 1.0
  isLoading: boolean;
}

export const ThreeBattery: React.FC<ThreeBatteryProps> = ({ soh, isLoading }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sohRef = useRef<number>(1.0);
  const targetSohRef = useRef<number>(soh);
  const isLoadingRef = useRef<boolean>(isLoading);

  // Keep refs up-to-date to avoid re-triggering useEffect
  useEffect(() => {
    targetSohRef.current = soh;
  }, [soh]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 140;
    const height = containerRef.current.clientHeight || 260;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // 4. Create Group for rotation
    const batteryGroup = new THREE.Group();
    scene.add(batteryGroup);

    // 5. Battery Outer Shell (Glass Cylinder)
    const shellGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.0, 32, 1, true);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    batteryGroup.add(shellMesh);

    // 6. Top Metal Cap (Positive Terminal)
    const capGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.85,
      roughness: 0.2,
    });
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.y = 2.15;
    batteryGroup.add(capMesh);

    // 7. Bottom Metal Cap (Negative Base)
    const baseGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.15, 32);
    const baseMesh = new THREE.Mesh(baseGeo, capMat);
    baseMesh.position.y = -2.075;
    batteryGroup.add(baseMesh);

    // 8. Liquid Fill (Cylinder)
    const maxLiquidHeight = 3.8;
    const liquidGeo = new THREE.CylinderGeometry(1.1, 1.1, maxLiquidHeight, 32);
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      emissive: 0x0033aa,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2,
      metalness: 0.1,
    });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    // Move origin to bottom of liquid cylinder for scaling
    liquidGeo.translate(0, maxLiquidHeight / 2, 0);
    liquidMesh.position.y = -1.9; // Align bottom with glass shell bottom
    batteryGroup.add(liquidMesh);

    // 9. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Pulsing Blue Glow Point Light
    const glowLight = new THREE.PointLight(0x00c2ff, 1.5, 10);
    glowLight.position.set(0, 0, 2);
    scene.add(glowLight);

    // 10. Animation Loop
    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Continuous Idle Y-axis Rotation
      batteryGroup.rotation.y += 0.002;

      // Smooth SOH Linear Interpolation over 1 second (lerp)
      const targetSoh = targetSohRef.current;
      sohRef.current = THREE.MathUtils.lerp(sohRef.current, targetSoh, 0.05);

      // Map SOH (1.0 -> 0.7) to Liquid fill height (100% -> 30%)
      const fillRatio = 0.3 + ((sohRef.current - 0.7) / 0.3) * 0.7;
      liquidMesh.scale.y = THREE.MathUtils.clamp(fillRatio, 0.3, 1.0);

      // Glow pulse animation during loading
      if (isLoadingRef.current) {
        const elapsed = clock.getElapsedTime();
        glowLight.intensity = 2.0 + Math.sin(elapsed * 10) * 1.5;
        // Subtle blue hue change to liquid when loading
        liquidMat.emissive.setHex(0x0066ff);
      } else {
        glowLight.intensity = THREE.MathUtils.lerp(glowLight.intensity, 1.0, 0.1);
        liquidMat.emissive.setHex(0x0033aa);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      shellGeo.dispose();
      shellMat.dispose();
      capGeo.dispose();
      capMat.dispose();
      baseGeo.dispose();
      liquidGeo.dispose();
      liquidMat.dispose();
    };
  }, []);

  return (
    <div className="relative w-[140px] h-[260px] flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
