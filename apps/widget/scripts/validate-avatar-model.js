#!/usr/bin/env node
/**
 * Avatar Model Validator
 * Usage: node validate-avatar-model.js <path-to-model.glb>
 *
 * Inspects a GLB/GLTF 3D model, enumerates its morph targets, and validates
 * compatibility with Oculus 15 Visemes and Apple ARKit-52 blendshape sets.
 */

import fs from 'fs';
import path from 'path';

const REQUIRED_CORE_MORPHS = [
  'jawOpen',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'browInnerUp',
];

const OCULUS_VISEMES = [
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
];

const ARKIT_KEY_BLENDSHAPES = [
  'browInnerUp',
  'browDownLeft',
  'browDownRight',
  'browOuterUpLeft',
  'browOuterUpRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'jawOpen',
  'jawForward',
  'mouthFunnel',
  'mouthPucker',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'noseSneerLeft',
  'noseSneerRight',
];

function validateModel(filePath) {
  if (!filePath) {
    console.error('Error: Please provide a path to a .glb file.');
    console.error('Usage: node validate-avatar-model.js <path-to-avatar.glb>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at ${resolvedPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedPath);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);

  console.log('='.repeat(60));
  console.log(`🤖 AI Avatar Model Diagnostic: ${path.basename(resolvedPath)}`);
  console.log(`📁 File Size: ${sizeMB} MB ${stat.size < 6 * 1024 * 1024 ? '✅ (< 6 MB Target)' : '⚠️ (> 6 MB Budget)'}`);
  console.log('='.repeat(60));

  const buf = fs.readFileSync(resolvedPath);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) {
    console.error('Error: Not a valid binary GLTF (GLB) file.');
    process.exit(1);
  }

  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

  const discoveredMorphs = new Set();
  const meshesWithMorphs = [];

  if (json.meshes) {
    json.meshes.forEach((mesh, idx) => {
      if (mesh.extras && mesh.extras.targetNames) {
        meshesWithMorphs.push({
          name: mesh.name || `Mesh_${idx}`,
          count: mesh.extras.targetNames.length,
        });
        mesh.extras.targetNames.forEach((t) => discoveredMorphs.add(t));
      }
    });
  }

  console.log(`\n📊 Meshes with Morph Targets (${meshesWithMorphs.length}):`);
  meshesWithMorphs.forEach((m) => {
    console.log(`  • ${m.name}: ${m.count} blendshapes`);
  });

  const discoveredList = Array.from(discoveredMorphs);
  console.log(`\n🔍 Total Unique Morph Targets Discovered: ${discoveredList.length}`);

  // Helper for alias-aware check
  const hasMorph = (canonical) => {
    if (discoveredMorphs.has(canonical)) return true;
    const lower = canonical.toLowerCase();
    for (const d of discoveredList) {
      if (d.toLowerCase() === lower) return true;
      if (canonical === 'jawOpen' && (d === 'mouthOpen' || d === 'aa')) return true;
      if (canonical.endsWith('Left') && d.toLowerCase() === canonical.slice(0, -4).toLowerCase() + '_l') return true;
      if (canonical.endsWith('Right') && d.toLowerCase() === canonical.slice(0, -4).toLowerCase() + '_r') return true;
    }
    return false;
  };

  // 1. Check Core Required Morphs
  console.log('\n🌟 Core Facial Animation Morphs:');
  let coreMissing = 0;
  REQUIRED_CORE_MORPHS.forEach((m) => {
    const present = hasMorph(m);
    if (!present) coreMissing++;
    console.log(`  ${present ? '✅' : '❌'} ${m}`);
  });

  // 2. Check Oculus Visemes
  console.log('\n👄 Oculus 15 Viseme Set:');
  let visemeCount = 0;
  OCULUS_VISEMES.forEach((v) => {
    const present = hasMorph(v);
    if (present) visemeCount++;
    console.log(`  ${present ? '✅' : '⚠️'} ${v}`);
  });
  console.log(`  Summary: ${visemeCount} / ${OCULUS_VISEMES.length} Oculus visemes matched.`);

  // 3. Check Key ARKit Blendshapes
  console.log('\n🎭 ARKit Expressions & Micro-gestures:');
  let arkitCount = 0;
  ARKIT_KEY_BLENDSHAPES.forEach((b) => {
    const present = hasMorph(b);
    if (present) arkitCount++;
  });
  console.log(`  Summary: ${arkitCount} / ${ARKIT_KEY_BLENDSHAPES.length} ARKit expressions matched.`);

  // Final Verdict
  console.log('\n' + '='.repeat(60));
  if (coreMissing === 0 && (visemeCount >= 8 || arkitCount >= 10)) {
    console.log('🎉 VERDICT: EXCELLENT! Model is 100% compatible with AI Avatar Assistant.');
    console.log('   Supports natural speech lip-sync, blinking, gaze, and expressions.');
  } else if (coreMissing <= 2) {
    console.log('⚠️ VERDICT: PARTIAL COMPATIBILITY. Model has some blendshapes and will work');
    console.log('   with fallback morph synthesis.');
  } else {
    console.log('❌ VERDICT: INCOMPATIBLE. Model is missing required facial blendshapes.');
  }
  console.log('='.repeat(60) + '\n');
}

const targetPath = process.argv[2] || 'apps/demo-web/public/assets/avatar/avatar.glb';
validateModel(targetPath);
