import { NATIVE_ATLAS_BYTES } from "../lib/native-overview.mjs";

export async function loadNativeAtlas(atlas, signal) {
  if (new URL(atlas.url, location.href).origin !== location.origin) throw Error("Native atlas must be same-origin");
  const response = await fetch(atlas.url, { signal, mode: "same-origin", redirect: "error", credentials: "omit" });
  if (!response.ok) throw Error("Native atlas unavailable");
  if (Number(response.headers.get("Content-Length")) > NATIVE_ATLAS_BYTES) throw Error("Native atlas exceeds byte budget");
  const reader = response.body.getReader(), parts = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > NATIVE_ATLAS_BYTES) throw Error("Native atlas exceeds byte budget");
      parts.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const blob = new Blob(parts, { type: response.headers.get("Content-Type") || "image/png" });
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, "0")).join("");
  if (digest !== atlas.sha256) throw Error("Native atlas checksum mismatch");
  const image = await createImageBitmap(blob);
  if (signal.aborted || image.width !== atlas.width || image.height !== atlas.height) {
    image.close(); throw Error("Native atlas dimensions changed or load cancelled");
  }
  return image;
}

// Only paints explicitly declared captured UI. No app scripts, event replay,
// flow model or running-frame lifetime belongs to this disposable layer.
export function createNativeRenderer(canvas, atlas) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
  if (!gl || Math.max(atlas.width, atlas.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw Error("Native GPU preview unavailable");
  const shaders = [], program = gl.createProgram(), buffer = gl.createBuffer(), texture = gl.createTexture();
  const dispose = () => { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); for (const shader of shaders) gl.deleteShader(shader); };
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, `#version 300 es
        in vec2 position; in vec2 uv; out vec2 tex; uniform vec2 size;
        void main(){ gl_Position=vec4(position.x/size.x*2.-1.,1.-position.y/size.y*2.,0.,1.);tex=uv; }`],
      [gl.FRAGMENT_SHADER, `#version 300 es
        precision highp float; in vec2 tex; out vec4 color; uniform sampler2D atlas;
        void main(){ color=texture(atlas,tex); }`],
    ]) {
      const shader = gl.createShader(type); shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error("Native GPU shader unavailable");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error("Native GPU program unavailable");
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, offset] of [["position", 0], ["uv", 8]]) {
      const attribute = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 16, offset);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } catch (error) { dispose(); throw error; }
  const size = gl.getUniformLocation(program, "size");
  return {
    upload(image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      if (gl.getError() !== gl.NO_ERROR) throw Error("Native GPU texture unavailable");
    },
    draw(items, camera, area) {
      const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / Math.max(1, area.width * area.height)));
      const width = Math.max(1, Math.round(area.width * ratio)), height = Math.max(1, Math.round(area.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(size, area.width, area.height);
      const vertices = []; let drawn = 0;
      for (const { node, rect } of items) {
        const x = node.position.x * camera.zoom + camera.x, y = (node.position.y + 4) * camera.zoom + camera.y;
        const w = 390 * camera.zoom, h = node.data.height * camera.zoom;
        if (x + w < 0 || y + h < 0 || x > area.width || y > area.height) continue;
        const u = rect.x / atlas.width, v = rect.y / atlas.height, r = (rect.x + rect.width) / atlas.width, b = (rect.y + rect.height) / atlas.height;
        vertices.push(x,y,u,v, x+w,y,r,v, x,y+h,u,b, x,y+h,u,b, x+w,y,r,v, x+w,y+h,r,b); drawn++;
      }
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);
      return drawn;
    },
    dispose,
  };
}
