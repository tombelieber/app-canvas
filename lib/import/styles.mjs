import parse from "css-tree/parser";
import walk from "css-tree/walker";
import generate from "css-tree/generator";

// Capture resolved values, never arbitrary stylesheets or selectors.
export const styleProperties = (`display position pointer-events top right bottom left z-index float clear box-sizing width height min-width min-height max-width max-height
margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left
overflow overflow-x overflow-y overflow-wrap overscroll-behavior clip clip-path contain content-visibility
flex flex-basis flex-direction flex-grow flex-shrink flex-wrap align-items align-content align-self justify-content justify-items justify-self order gap row-gap column-gap
grid-template-columns grid-template-rows grid-auto-columns grid-auto-rows grid-auto-flow grid-column-start grid-column-end grid-row-start grid-row-end
font-family font-size font-weight font-style font-stretch font-variant font-variation-settings font-feature-settings line-height letter-spacing word-spacing text-align text-transform text-decoration text-decoration-color text-decoration-line text-decoration-style text-underline-offset text-indent text-overflow text-shadow white-space word-break vertical-align direction writing-mode
color background-color background-image background-size background-position background-repeat background-origin background-clip background-attachment
border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius border-collapse border-spacing
box-shadow opacity visibility transform translate rotate scale transform-origin transform-style perspective perspective-origin filter backdrop-filter isolation mix-blend-mode object-fit object-position aspect-ratio appearance accent-color list-style-type list-style-position list-style-image
fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit paint-order vector-effect stop-color stop-opacity color-interpolation text-anchor dominant-baseline shape-rendering image-rendering`).split(/\s+/);
const properties = new Set([...styleProperties, "margin", "padding", "border", "border-radius", "background", "mask"]);
const validated = new Map();
export const editableProperties = new Set(["font-size", "font-weight", "color", "background-color", "border", "border-radius", "opacity", "fill", "stroke", "stroke-width", "stop-color"]);
const functions = new Set((`rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient calc min max clamp repeat minmax fit-content matrix matrix3d translate translateX translateY translateZ translate3d scale scaleX scaleY scaleZ scale3d rotate rotateX rotateY rotateZ rotate3d skew skewX skewY perspective rect inset circle ellipse polygon path blur brightness contrast drop-shadow grayscale hue-rotate invert saturate sepia`).toLowerCase().split(" "));
export const assetId = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export function transformCss(value, mapUrl = url => url) {
  const ast = parse(value, { context: "value" });
  walk(ast, node => {
    if (["Raw", "Atrule", "Declaration"].includes(node.type)) throw Error("Unsupported CSS syntax");
    if (node.type === "Function" && !functions.has(node.name.toLowerCase())) throw Error("Unsupported CSS function");
    if (node.type === "Url") node.value = mapUrl(node.value);
  });
  return generate(ast);
}
export function validateStyle(property, value) {
  if (!properties.has(property) || typeof value !== "string" || value.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error("Invalid style property or value");
  const key = `${property}\u0000${value}`; if (validated.has(key)) return value;
  transformCss(value, url => {
    if (!(url.startsWith("asset:") && assetId(url.slice(6))) && !/^#[a-zA-Z0-9_:-]+$/.test(url)) throw Error("CSS resource must be a local asset");
    return url;
  });
  if (validated.size >= 20000) validated.delete(validated.keys().next().value);
  validated.set(key, true);
  return value;
}
export function translated(base = "none", x = 0, y = 0) {
  const values = []; let depth = 0, start = 0;
  for (let i = 0; i <= base.length; i++) { if (base[i] === "(") depth++; if (base[i] === ")") depth--; if (i === base.length || /\s/.test(base[i]) && depth === 0) { if (i > start) values.push(base.slice(start, i)); start = i + 1; } }
  if (values[0] === "none") values.length = 0;
  return `calc(${values[0] || "0px"} + ${x}px) calc(${values[1] || "0px"} + ${y}px)${values[2] ? ` ${values[2]}` : ""}`;
}
