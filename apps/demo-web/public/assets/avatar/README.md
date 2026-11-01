# Avatar Assets Directory

This directory is intended for licensed VRM avatar models (e.g. `avatar.vrm`) and custom animation clips.

NovaAI also includes a built-in procedural 3D stylized avatar rig that renders automatically if no external `.vrm` URL is supplied.

To use a custom VRM:
1. Place your licensed `.vrm` file in this directory (e.g., `/assets/avatar/model.vrm`).
2. Pass `avatarAssetUrl: "/assets/avatar/model.vrm"` to `SiteGuide.init({...})`.

