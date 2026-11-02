# Open Source Licenses & Asset Attributions

All 3D assets, libraries, and audio modules utilized in the **AI Avatar Website Assistant** are strictly 100% free, open-source, and permissive for commercial web embedding.

---

## 1. 3D Avatar Models & Morph Sets

### Realistic 3D Humanoid Avatar (`avatar.glb`)
- **Source:** [TalkingHead Open Source Project](https://github.com/met4citizen/TalkingHead)
- **License:** **MIT License**
- **Copyright:** (c) 2023 met4citizen
- **Features Included:**
  - 10-mesh humanoid skeleton (Mixamo-compatible bone hierarchy)
  - Full 15 Oculus Speech Visemes (`viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`, `viseme_PP`, `viseme_FF`, `viseme_SS`, etc.)
  - Full 52 Apple ARKit blendshapes (`browInnerUp`, `eyeBlinkLeft`/`Right`, `mouthSmileLeft`/`Right`, `jawOpen`, `eyeLook`, `cheekSquint`, etc.)
  - Optimized PBR textures (< 5 MB, well below the 6 MB target)

### Three.js ARKit Morph Reference (`facecap.glb`)
- **Source:** [Three.js GLTF Examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)
- **License:** **MIT License**
- **Copyright:** (c) 2010-2024 Three.js authors

---

## 2. Image-Based Studio Lighting (HDRI)

### Studio Environment (`studio.hdr` / `ferndale_studio_04_1k.hdr`)
- **Source:** [Poly Haven](https://polyhaven.com/) / Three.js Equirectangular Textures
- **License:** **CC0 1.0 Universal (Public Domain Dedication)**
- **Attribution:** Poly Haven artists. Free for commercial, personal, and embedded web applications without royalties or fees.

---

## 3. Libraries & Software

### Three.js (`three` ^0.170.0)
- **License:** **MIT License**
- **Copyright:** (c) 2010-2024 Three.js authors
- **Usage:** WebGL rendering, PMREM IBL generator, AnimationMixer, PBR shaders.

### @pixiv/three-vrm (^3.3.4)
- **License:** **MIT License**
- **Copyright:** (c) 2019-2024 Pixiv Inc.
- **Usage:** VRM format parser and humanoid bone mapping.

### Draco 3D Geometry Decoder
- **License:** **Apache License 2.0**
- **Copyright:** (c) 2016-2024 Google LLC
- **Usage:** On-the-fly mesh decompression.

### Web Speech API / Web Audio API
- **License:** W3C Recommendation / Native Browser Standard
- **Usage:** Speech synthesis, boundary synchronization, microphone capture, FFT spectrum analysis. Zero third-party fees or telemetry.

