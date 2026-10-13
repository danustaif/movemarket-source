(() => {
  if (window.__curInit) return; window.__curInit = true;
  const svg = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><path d="M3 2l17 9.5-7.4 1.9L9 21z" fill="white" stroke="black" stroke-width="1.6" stroke-linejoin="round"/></svg>');
  let x = -50, y = -50;
  const add = () => {
    const c = document.createElement("div");
    c.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:26px;height:26px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;background:url('${svg}') no-repeat;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))`;
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; c.style.left = x + "px"; c.style.top = y + "px"; }, true);
    addEventListener("mousedown", () => { c.style.scale = "0.82"; }, true);
    addEventListener("mouseup", () => { c.style.scale = "1"; }, true);
  };
  if (document.documentElement) add(); else addEventListener("DOMContentLoaded", add);
})();
