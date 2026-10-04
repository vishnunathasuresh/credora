import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragment = `
precision mediump float;
varying vec2 uv;
void main() {
  vec3 ink = vec3(0.035, 0.10, 0.15);
  vec3 teal = vec3(0.10, 0.43, 0.43);
  vec3 gold = vec3(0.75, 0.55, 0.29);
  float glow = exp(-5.0 * distance(uv, vec2(0.82, 0.78)));
  float line = smoothstep(0.0, 0.02, sin((uv.x + uv.y * 0.28) * 18.0) * 0.5 + 0.5);
  vec3 color = mix(ink, teal, smoothstep(0.05, 0.95, uv.x) * 0.58);
  color = mix(color, gold, glow * 0.62);
  color += vec3(0.035, 0.10, 0.11) * line * (1.0 - uv.y) * 0.32;
  gl_FragColor = vec4(color, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create credential-card shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error || 'Could not compile credential-card shader.');
  }
  return shader;
}

export function CredentialArt() {
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    try {
      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      if (!buffer) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endFrameEXP();
    } catch {
      // Keep the native card usable if a device cannot compile the decorative shader.
    }
  }, []);

  return (
    <View style={styles.art} accessible={false}>
      <GLView
        onContextCreate={onContextCreate}
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 116, width: '100%', backgroundColor: '#0b3038', overflow: 'hidden' },
});
