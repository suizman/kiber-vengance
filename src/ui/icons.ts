const paths = {
  play: "M8 5v14l11-7z",
  pause: "M7 5h3v14H7zM14 5h3v14h-3z",
  stop: "M6 6h12v12H6z",
  rewind: "M5 5h2v14H5zM18 5v14L8 12z",
  record: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
};
export function controlIcon(
  id: string,
  kind: keyof typeof paths,
  label: string,
) {
  const button = document.getElementById(id);
  if (!button) return;
  button.setAttribute("aria-label", label);
  button.title = label;
  if (
    button.dataset.icon === kind &&
    button.firstElementChild?.tagName === "svg"
  )
    return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[kind]);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  button.replaceChildren(svg);
  button.dataset.icon = kind;
}
