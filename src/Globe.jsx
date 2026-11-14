import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Drag to rotate. Colour = current note's value on the colour scale.
export default function Globe({ color, active }) {
  const mount = useRef(null);
  const api = useRef({ scale: 1 });

  useEffect(() => {
    const el = mount.current;
    const w = el.clientWidth || 280, h = el.clientHeight || 280;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    cam.position.set(0, 0.4, 4.4);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(3, 2, 4);
    scene.add(sun);

    const mat = new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.55 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.4, 64, 64), mat);
    const grid = new THREE.Mesh(new THREE.SphereGeometry(1.41, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.14 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.58, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x2ee6c5, transparent: true, opacity: 0.14, side: THREE.BackSide }));
    scene.add(globe, grid, halo);

    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableZoom = false; controls.enablePan = false;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.9;

    let raf, s = 1;
    const loop = () => {
      s += ((api.current.scale) - s) * 0.15; // smooth pulse while playing
      globe.scale.setScalar(s);
      controls.update();
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    api.current.mat = mat; api.current.halo = halo;

    return () => {
      cancelAnimationFrame(raf); controls.dispose(); renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    api.current.mat?.color.set(color);
    api.current.halo?.material.color.set(color);
    api.current.scale = active ? 1.05 : 1;
  }, [color, active]);

  return <div ref={mount} className="globe" role="img"
    aria-label="Rotating 3D globe. Its colour shows the current value on the colour scale. It is a visual cue, not a map." />;
}
