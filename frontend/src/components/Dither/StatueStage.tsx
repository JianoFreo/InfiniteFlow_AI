import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prefersReducedMotion } from "../../lib/dither";

/** Pixel size of one dither dot on screen. */
const DOT = 3;

const DITHER_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Ordered 8×8 Bayer dither of the lit 3D render: lit pixels become ink dots, the rest is transparent. */
const DITHER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform vec3 uInk;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec4 s = texture2D(tScene, vUv);
  float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
  lum = clamp((lum - 0.5) * 1.35 + 0.5, 0.0, 1.0);
  float on = step(bayer8(vUv * uRes), lum) * s.a;
  gl_FragColor = vec4(uInk * on, on);
}
`;

interface StatueStageProps {
  modelUrls: string[];
}

/**
 * One fixed, full-viewport WebGL canvas behind the page. Real 3D sculpture scans (one per page section) are lit by a moving light
 * and turned by page scroll (true 3D rotation, with parallax drift left/right), then dithered in a shader.
 */
const StatueStage = ({ modelUrls }: StatueStageProps) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = prefersReducedMotion();

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(2, 2, 3);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(-3, 1, -2);
    scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));

    // One pivot per statue; the page scroll picks which one is on stage.
    const pivots: Array<{ group: THREE.Group; base: number }> = modelUrls.map(() => ({ group: new THREE.Group(), base: 0 }));
    pivots.forEach(({ group }) => {
      group.visible = false;
      scene.add(group);
    });

    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const loader = new GLTFLoader().setDRACOLoader(draco);
    modelUrls.forEach((url, i) => {
      loader.load(url, (gltf) => {
        const model = gltf.scene;
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const old = mesh.material as THREE.MeshStandardMaterial;
          mesh.material = new THREE.MeshStandardMaterial({ color: 0xefece4, roughness: 0.6, metalness: 0, normalMap: old.normalMap ?? null });
        });
        // centre, and fit inside a ~2.8-unit box whatever the model's own units are
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(box.getCenter(new THREE.Vector3()));
        pivots[i].base = 2.3 / Math.max(size.x, size.y, size.z);
        pivots[i].group.add(model);
        console.info("[StatueStage] loaded", url, size.toArray().map((v) => +v.toFixed(2)));
      }, undefined, (err) => console.error("[StatueStage] failed to load", url, err));
    });
    const smooth = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // offscreen lit render -> dither pass
    const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const ditherMat = new THREE.ShaderMaterial({
      vertexShader: DITHER_VERT,
      fragmentShader: DITHER_FRAG,
      transparent: true,
      uniforms: {
        tScene: { value: target.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uInk: { value: new THREE.Color(0xece9e2) },
      },
    });
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ditherMat));

    let w = 1;
    let h = 1;
    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth / DOT));
      h = Math.max(1, Math.floor(window.innerHeight / DOT));
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      target.setSize(w, h);
      ditherMat.uniforms.uRes.value.set(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let rotY = 0;
    let rotX = 0;
    let posX = 0;
    let posY = 0;
    let settled = false;
    const clock = new THREE.Clock();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const override = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get("stage")) : NaN;
      const s = Number.isFinite(override) && override > 0 ? Math.min(0.999, override) : window.scrollY / max; // 0..1 over the whole page

      // scroll turns the head a full 3D rotation and a half, and sweeps it across the page
      const targetRotY = reduced ? 0.4 : -0.5 + s * Math.PI * 3 + mouse.x * 0.35;
      const targetRotX = reduced ? 0 : 0.08 + mouse.y * 0.15 + Math.sin(s * Math.PI * 2) * 0.12;
      const aspect = camera.aspect;
      const targetX = aspect > 1 ? 0.75 + Math.cos(s * Math.PI * 3) * 1.05 : 0;
      const targetY = Math.sin(s * Math.PI * 2) * 0.3;
      if (!settled) {
        rotY = targetRotY;
        rotX = targetRotX;
        posX = targetX;
        posY = targetY;
        settled = true;
      }
      rotY += (targetRotY - rotY) * 0.08;
      rotX += (targetRotX - rotX) * 0.08;
      posX += (targetX - posX) * 0.06;
      posY += (targetY - posY) * 0.06;
      // statue i is on stage for its slice of the page; it grows in and shrinks out at the seams
      const n = pivots.length;
      const slot = Math.min(n - 1, Math.floor(s * n));
      const u = s * n - slot;
      // the first statue is already fully there at the top of the page, the last stays until the bottom
      const ease = (slot === 0 ? 1 : smooth(0, 0.16, u)) * (slot === n - 1 ? 1 : 1 - smooth(0.84, 1, u));
      pivots.forEach(({ group, base }, i) => {
        const k = i === slot && base > 0 ? ease : 0;
        group.visible = k > 0.01;
        group.scale.setScalar(Math.max(0.0001, base * k));
        group.rotation.set(rotX, rotY + i * 1.3, 0);
        group.position.set(posX, posY + Math.sin(t * 0.8) * 0.04, 0);
      });

      // slowly orbiting light so the scan's surface detail keeps shifting
      key.position.set(Math.cos(t * 0.6) * 3, 2, Math.sin(t * 0.6) * 3 + 1.5);

      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(quadScene, quadCam);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      target.dispose();
      ditherMat.dispose();
      draco.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrls.join("|")]);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-1 opacity-[0.8]" />;
};

export default StatueStage;
