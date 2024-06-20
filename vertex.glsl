varying vec2 vSt;
varying vec2 vUv;
uniform float imageAspect; // new added

void main() {
  vec3 posToCam = cameraPosition - position;
  vec3 nDir = normalize(posToCam);
  float zRatio = posToCam.z / nDir.z;
  vec3 uvPoint = zRatio * nDir;
  
  vUv = uvPoint.xy + 0.5;
  vUv.x = 1.0 - vUv.x;

  // Adjust vUv according to the image aspect ratio
  if (imageAspect > 1.0) {
    vUv.y = vUv.y * imageAspect;
  } else {
    vUv.x = vUv.x / imageAspect;
  }

  vSt = uv;
  vSt.x = 1.0 - vSt.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
