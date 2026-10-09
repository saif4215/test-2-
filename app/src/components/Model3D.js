// Phones without a web view cannot draw the 3D models, so the native app skips them (the web app, Model3D.web.js, draws them).
export const supported = false;
export default function Model3D() { return null; }
