precision highp float;
precision highp int;

uniform sampler2DArray field;
uniform vec2 camArraySize;
uniform float aperture;
uniform float focus;

in vec2 vSt;
in vec2 vUv;

void main() {
    vec4 color = vec4(0.0);
    float colorCount = 0.0;

    // Check if the fragment is within the screen boundaries
    if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) {
        discard;
    }

    // Iterate over the camera array
    for (float i = 0.0; i < camArraySize.x; i++) {
        for (float j = 0.0; j < camArraySize.y; j++) {
            float dx = i - (vSt.x * camArraySize.x - 0.5);
            float dy = j - (vSt.y * camArraySize.y - 0.5);
            float sqDist = dx * dx + dy * dy;

            // Check if the current pixel is within the aperture
            if (sqDist < aperture) {
                float camOff = i + camArraySize.x * j;
                vec2 focOff = vec2(dx, dy) * focus;

                // Perform texture sampling
                vec3 texCoord = vec3(vUv + focOff, camOff);
                color += texture(field, texCoord);
                colorCount++;
            }
        }
    }

    // Output final color averaged over the number of samples
    gl_FragColor = vec4(color.rgb / colorCount, 1.0);
}
