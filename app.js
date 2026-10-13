const categoriesElement = document.querySelector("#category-list");
const categoryTotal = document.querySelector("#category-total");
const resourceGrid = document.querySelector("#resource-grid");
const resultTotal = document.querySelector("#result-total");
const searchInput = document.querySelector("#search");
const loadError = document.querySelector("#load-error");
const activeCategoryElement = document.querySelector("#active-category");
const heroResourceCount = document.querySelector("#hero-resource-count");
const heroPickLink = document.querySelector("#hero-pick-link");
const heroPickCategory = document.querySelector("#hero-pick-category");
const heroCategoryCount = document.querySelector("#hero-category-count");
const heroFeaturedLinks = document.querySelector("#hero-featured-links");
const heroSearchInput = document.querySelector("#hero-search");
const shufflePick = document.querySelector("#shuffle-pick");

let resources = [];
let activeCategory = "all";
let lastSpotlightIndex = -1;

function splitTableRow(row) {
  let brackets = 0;
  let parentheses = 0;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === "\\" && row[index + 1] === "|") {
      index += 1;
    } else if (character === "[" && parentheses === 0) {
      brackets += 1;
    } else if (character === "]" && brackets > 0) {
      brackets -= 1;
    } else if (character === "(" && brackets === 0) {
      parentheses += 1;
    } else if (character === ")" && parentheses > 0) {
      parentheses -= 1;
    } else if (character === "|" && brackets === 0 && parentheses === 0) {
      if (index === 0) continue;
      let description = row.slice(index + 1).trim();
      if (description.endsWith("|")) description = description.slice(0, -1).trimEnd();
      return [row.slice(1, index).trim(), description.replace(/\\\|/g, "|")];
    }
  }
  return [];
}

function parseResourceLink(markdown) {
  const match = markdown.match(/^\[([^\]]+)\]\((https?:\/\/.+)\)$/);
  if (!match) return null;
  try {
    const url = new URL(match[2]);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return { name: match[1].trim(), href: url.href };
  } catch {
    return null;
  }
}

function renderDescription(markdown, element) {
  const links = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let offset = 0;
  let match;
  while ((match = links.exec(markdown)) !== null) {
    element.append(document.createTextNode(markdown.slice(offset, match.index)));
    const link = document.createElement("a");
    link.href = match[2];
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = match[1];
    element.append(link);
    offset = links.lastIndex;
  }
  element.append(document.createTextNode(markdown.slice(offset)));
}

function parseCatalog(markdown) {
  const entries = [];
  let category = "";
  let categoryDescription = "";
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (.+?)\s*$/);
    if (heading) {
      category = heading[1];
      categoryDescription = "";
      continue;
    }
    if (!category || category === "Table of Contents") continue;
    if (line.startsWith(">")) {
      categoryDescription = line.slice(1).trim();
      continue;
    }
    if (!line.startsWith("|") || /^\|\s*:?-{3,}/.test(line)) continue;
    const [nameCell, description] = splitTableRow(line);
    const resource = parseResourceLink(nameCell ?? "");
    if (!resource || description === undefined) continue;
    entries.push({ ...resource, category, categoryDescription, description: description.trim() });
  }
  if (entries.length === 0) throw new Error("No resource tables were found in readme.md.");
  return entries;
}

function setCategory(name) {
  activeCategory = name;
  for (const button of categoriesElement.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.category === name));
  }
  renderResources();
}

function addCategory(name, count) {
  const button = document.createElement("button");
  button.className = "category-button";
  button.type = "button";
  button.dataset.category = name;
  button.setAttribute("aria-pressed", String(activeCategory === name));
  const label = document.createElement("span");
  label.textContent = name === "all" ? "All resources" : name;
  const total = document.createElement("span");
  total.className = "category-count";
  total.textContent = count;
  button.append(label, total);
  button.addEventListener("click", () => setCategory(name));
  categoriesElement.append(button);
}

function renderCategories() {
  const counts = new Map();
  for (const resource of resources) {
    counts.set(resource.category, (counts.get(resource.category) ?? 0) + 1);
  }
  categoriesElement.replaceChildren();
  addCategory("all", resources.length);
  for (const [category, count] of counts) addCategory(category, count);
  categoryTotal.textContent = counts.size;
  heroCategoryCount.textContent = counts.size;
  animateHeroCount(resources.length);
  chooseSpotlightResource();
  renderHeroFeaturedLinks();
  shufflePick.disabled = false;
}

function renderHeroFeaturedLinks() {
  const featured = [
    resources.find((resource) => new URL(resource.href).hostname.replace(/^www\./, "") === "uiverse.io"),
    resources.find((resource) => new URL(resource.href).hostname.replace(/^www\./, "") === "magicui.design"),
    resources.find((resource) => resource.category === "Design Inspiration"),
    resources.find((resource) => resource.category === "UI Components & Kits"),
  ].filter((resource, index, list) => resource && list.findIndex((item) => item.href === resource.href) === index);

  heroFeaturedLinks.replaceChildren();
  for (const [index, resource] of featured.entries()) {
    const link = document.createElement("a");
    link.className = "showcase-resource";
    link.href = resource.href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.style.setProperty("--showcase-index", index);
    const number = document.createElement("span");
    number.className = "showcase-resource-index";
    number.textContent = `0${index + 1}`;
    const name = document.createElement("strong");
    name.textContent = resource.name;
    const category = document.createElement("span");
    category.className = "showcase-resource-category";
    category.textContent = resource.category;
    const arrow = document.createElement("span");
    arrow.className = "showcase-resource-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(number, name, category, arrow);
    heroFeaturedLinks.append(link);
  }
}

function animateHeroCount(total) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    heroResourceCount.textContent = total.toLocaleString();
    return;
  }
  const duration = 900;
  const start = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    heroResourceCount.textContent = Math.round(total * eased).toLocaleString();
    if (progress < 1) window.requestAnimationFrame(update);
  }
  window.requestAnimationFrame(update);
}

function chooseSpotlightResource() {
  if (resources.length === 0) return;
  let index = Math.floor(Math.random() * resources.length);
  if (resources.length > 1 && index === lastSpotlightIndex) {
    index = (index + 1) % resources.length;
  }
  lastSpotlightIndex = index;
  const resource = resources[index];
  heroPickLink.href = resource.href;
  heroPickLink.textContent = resource.name;
  heroPickLink.setAttribute("aria-label", `Open ${resource.name} in a new tab`);
  heroPickCategory.textContent = resource.category;
  heroPickLink.classList.remove("is-changing");
  void heroPickLink.offsetWidth;
  heroPickLink.classList.add("is-changing");
}

shufflePick.addEventListener("click", chooseSpotlightResource);

function createCard(resource) {
  const card = document.createElement("article");
  card.className = "resource-card";
  const pattern = [...resource.name].reduce((total, character) => total + character.charCodeAt(0), 0) % 6;
  const tone = [...resource.category].reduce((total, character) => total + character.charCodeAt(0), 0) % 5;
  card.dataset.pattern = pattern;
  const cover = document.createElement("div");
  cover.className = "resource-preview";
  cover.dataset.pattern = pattern;
  cover.dataset.tone = tone;
  cover.setAttribute("aria-hidden", "true");
  const preview = document.createElement("img");
  preview.className = "resource-preview-image";
  preview.src = `https://image.thum.io/get/width/720/crop/600/${resource.href}`;
  preview.alt = "";
  preview.loading = "lazy";
  preview.decoding = "async";
  preview.referrerPolicy = "no-referrer";
  preview.addEventListener("load", () => cover.classList.add("has-preview"), { once: true });
  preview.addEventListener("error", () => preview.remove(), { once: true });
  const coverGlyph = document.createElement("span");
  coverGlyph.className = "preview-glyph";
  coverGlyph.textContent = ["✳", "◌", "◈", "✣", "△", "✷"][pattern];
  const coverCaption = document.createElement("span");
  coverCaption.className = "preview-caption";
  coverCaption.textContent = resource.category;
  const coverLabel = document.createElement("span");
  coverLabel.className = "preview-label";
  coverLabel.textContent = resource.name;
  cover.append(preview, coverGlyph, coverCaption, coverLabel);
  const category = document.createElement("p");
  category.className = "resource-category";
  category.textContent = resource.category;
  const heading = document.createElement("h3");
  heading.className = "resource-name";
  const source = document.createElement("a");
  source.className = "resource-link";
  source.href = resource.href;
  source.target = "_blank";
  source.rel = "noreferrer";
  source.textContent = resource.name;
  heading.append(source);
  const description = document.createElement("p");
  description.className = "resource-description";
  renderDescription(resource.description, description);
  const domain = document.createElement("div");
  domain.className = "resource-domain";
  const arrow = document.createElement("span");
  arrow.className = "external-mark";
  arrow.textContent = "↗";
  const domainText = document.createElement("span");
  domainText.textContent = new URL(resource.href).hostname.replace(/^www\./, "");
  domain.append(arrow, domainText);
  card.append(cover, category, heading, description, domain);
  return card;
}

function renderResources() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const selectedCategory = resources.find((resource) => resource.category === activeCategory);
  activeCategoryElement.textContent =
    activeCategory === "all" ? "" : selectedCategory?.categoryDescription ?? "";
  const visible = resources.filter((resource) => {
    if (activeCategory !== "all" && resource.category !== activeCategory) return false;
    return [resource.name, resource.description, resource.category, resource.categoryDescription, resource.href]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
  resourceGrid.replaceChildren();
  if (visible.length) {
    resourceGrid.append(...visible.map(createCard));
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No resources found. Try another search or category.";
    resourceGrid.append(empty);
  }
  resultTotal.textContent = `${visible.length} ${visible.length === 1 ? "resource" : "resources"}`;
  resourceGrid.setAttribute("aria-busy", "false");
}

searchInput.addEventListener("input", () => {
  heroSearchInput.value = searchInput.value;
  renderResources();
});
heroSearchInput.addEventListener("input", () => {
  searchInput.value = heroSearchInput.value;
  renderResources();
});
document.querySelector("#hero-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  searchInput.value = heroSearchInput.value;
  renderResources();
  resourceGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  searchInput.focus({ preventScroll: true });
});
document.addEventListener("keydown", (event) => {
  const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !typing) {
    event.preventDefault();
    searchInput.focus();
  } else if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    renderResources();
    searchInput.blur();
  }
});

fetch("./readme.md")
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load readme.md (${response.status}).`);
    return response.text();
  })
  .then((markdown) => {
    resources = parseCatalog(markdown);
    renderCategories();
    renderResources();
  })
  .catch((error) => {
    console.error("Unable to load the design resources catalog.", error);
    categoriesElement.replaceChildren();
    resourceGrid.replaceChildren();
    resourceGrid.setAttribute("aria-busy", "false");
    loadError.hidden = false;
  });
