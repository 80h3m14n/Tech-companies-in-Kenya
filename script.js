const README_CANDIDATES = ["./Readme.md", "./README.md"];
const KENYA_VIEW = { center: [-0.0236, 37.9062], zoom: 6 };
const LOCATION_COORDINATES = {
  nairobi: { lat: -1.286389, lng: 36.817223 },
  westlands: { lat: -1.2676, lng: 36.8108 },
  runda: { lat: -1.2197, lng: 36.7999 },
  nyeri: { lat: -0.4201, lng: 36.9476 },
  kisumu: { lat: -0.0917, lng: 34.768 },
  mombasa: { lat: -4.0435, lng: 39.6682 },
  eldoret: { lat: 0.5143, lng: 35.2698 },
  nakuru: { lat: -0.3031, lng: 36.08 },
  thika: { lat: -1.0332, lng: 37.0692 },
  kiambu: { lat: -1.1714, lng: 36.8356 },
  kenya: { lat: -0.0236, lng: 37.9062 },
  "country wide": { lat: -0.0236, lng: 37.9062 },
  east_africa: { lat: -1.2921, lng: 36.8219 },
  nigeria: { lat: 9.082, lng: 8.6753 },
};

const state = {
  allItems: [],
  filteredItems: [],
  map: null,
  markersLayer: null,
};

function normalizeText(value) {
  return (value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSorted(values) {
  return [
    ...new Set(values.filter(Boolean).map((item) => normalizeText(item))),
  ].sort((a, b) => a.localeCompare(b));
}

function parseMarkdownLink(text) {
  const normalized = normalizeText(text);
  const primary = normalized.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
  if (primary) {
    return { label: normalizeText(primary[1]), url: primary[2].trim() };
  }

  const relaxed = normalized.match(
    /\[([^\]]+)\]\)?\(?((?:https?:\/\/)[^\s)]+)\)?/i,
  );
  if (relaxed) {
    return { label: normalizeText(relaxed[1]), url: relaxed[2].trim() };
  }

  return null;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => normalizeText(cell));
}

function isDividerRow(line) {
  return /^\s*\|?\s*[:-]+(?:\s*\|\s*[:-]+)+\s*\|?\s*$/.test(line);
}

function buildCategoryPath(headings) {
  const parts = [headings.h1, headings.h2, headings.h3]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value) => value !== "Kenya Tech Directory")
    .filter((value) => !/^\d+\.?$/.test(value));
  return parts.join(" › ");
}

function headerTypeForCell(header) {
  const value = header.toLowerCase();
  if (
    value.includes("portfolio") ||
    value.includes("company") ||
    value.includes("project")
  )
    return "name";
  if (value.includes("type")) return "type";
  if (value.includes("location")) return "location";
  if (value.includes("description")) return "description";
  return "other";
}

function parseReadme(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = { h1: "Kenya Tech Directory", h2: "", h3: "" };
  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      if (level === 1) {
        headings.h1 = title;
        headings.h2 = "";
        headings.h3 = "";
      } else if (level === 2) {
        headings.h2 = title;
        headings.h3 = "";
      } else if (level === 3) {
        headings.h3 = title;
      }
      continue;
    }

    if (
      trimmed.startsWith("|") &&
      index + 1 < lines.length &&
      isDividerRow(lines[index + 1])
    ) {
      const headers = splitTableRow(trimmed);
      index += 2;

      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const cells = splitTableRow(lines[index]);
        const cellTypes = headers.map(headerTypeForCell);
        const nameCellIndex = Math.max(cellTypes.indexOf("name"), 0);
        const link = parseMarkdownLink(cells[nameCellIndex] || "");

        if (link && /^https?:\/\//i.test(link.url)) {
          const item = {
            name: link.label,
            url: link.url,
            categories: [buildCategoryPath(headings)],
            types: [],
            locations: [],
            descriptions: [],
          };

          cells.forEach((cell, cellIndex) => {
            const type = cellTypes[cellIndex] || "other";
            if (!cell || cellIndex === nameCellIndex) return;
            if (type === "type") item.types.push(cell);
            if (type === "location") item.locations.push(cell);
            if (type === "description") item.descriptions.push(cell);
          });

          entries.push(item);
        }

        index += 1;
      }

      index -= 1;
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      const link = parseMarkdownLink(listMatch[1]);
      if (link && /^https?:\/\//i.test(link.url)) {
        entries.push({
          name: link.label,
          url: link.url,
          categories: [buildCategoryPath(headings)],
          types: [],
          locations: [],
          descriptions: [],
        });
      }
    }
  }

  return entries;
}

function dedupeItems(items) {
  const byKey = new Map();

  items.forEach((item) => {
    const key = item.url ? item.url.toLowerCase() : slugify(item.name);
    const existing = byKey.get(key) || {
      id: key,
      name: item.name,
      url: item.url,
      categories: new Set(),
      types: new Set(),
      locations: new Set(),
      descriptions: new Set(),
    };

    if (item.name.length > existing.name.length) existing.name = item.name;
    if (!existing.url && item.url) existing.url = item.url;
    item.categories.forEach((value) => existing.categories.add(value));
    item.types.forEach((value) => existing.types.add(value));
    item.locations.forEach((value) => existing.locations.add(value));
    item.descriptions.forEach((value) => existing.descriptions.add(value));
    byKey.set(key, existing);
  });

  return [...byKey.values()]
    .map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      categories: uniqueSorted([...item.categories]).filter(Boolean),
      types: uniqueSorted([...item.types]),
      locations: uniqueSorted([...item.locations]),
      descriptions: uniqueSorted([...item.descriptions]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findCoordinates(locationText) {
  const normalized = normalizeText(locationText).toLowerCase();
  if (!normalized) return null;

  const aliases = [
    normalized,
    normalized.replace(/&/g, "and"),
    normalized.replace(/,/g, " "),
    normalized.replace(/\s+/g, " "),
  ];

  for (const candidate of aliases) {
    for (const [key, coords] of Object.entries(LOCATION_COORDINATES)) {
      const normalizedKey = key.replace(/_/g, " ");
      if (candidate.includes(normalizedKey)) return coords;
    }
  }

  return null;
}

function enrichItem(item) {
  const location = item.locations[0] || "Unspecified";
  const coordinates =
    item.locations.map(findCoordinates).find(Boolean) ||
    findCoordinates(location);
  return {
    ...item,
    categoryLabel: item.categories[0] || "Uncategorized",
    typeLabel: item.types[0] || "Unspecified",
    locationLabel: location,
    description:
      item.descriptions[0] ||
      "Profile information was extracted from the repository markdown. Visit the official link for more details.",
    coordinates,
    searchText: [
      item.name,
      item.url,
      ...item.categories,
      ...item.types,
      ...item.locations,
      ...item.descriptions,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

async function fetchReadmeText() {
  for (const path of README_CANDIDATES) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (response.ok) return await response.text();
    } catch (error) {
      // Try the next candidate.
    }
  }
  throw new Error("Unable to fetch the repository markdown file.");
}

function populateSelect(select, values, label) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = label;
  select.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function formatCount(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function updateStats(allItems, visibleItems) {
  const mapped = visibleItems.filter((item) => item.coordinates).length;
  document.querySelector('[data-stat="total"]').textContent =
    allItems.length.toString();
  document.querySelector('[data-stat="visible"]').textContent =
    visibleItems.length.toString();
  document.querySelector('[data-stat="categories"]').textContent = new Set(
    allItems.flatMap((item) => item.categories),
  ).size.toString();
  document.querySelector('[data-stat="mapped"]').textContent =
    mapped.toString();
}

function renderActiveFilters(filters) {
  const container = document.getElementById("activeFilters");
  container.innerHTML = "";

  const entries = [
    ["Search", filters.search],
    ["Sector", filters.category],
    ["Type", filters.type],
    ["Location", filters.location],
  ].filter(([, value]) => value);

  if (!entries.length) return;

  entries.forEach(([label, value]) => {
    const tag = document.createElement("span");
    tag.className = "pill";
    tag.textContent = `${label}: ${value}`;
    container.append(tag);
  });
}

function renderCards(items) {
  const container = document.getElementById("cardsContainer");
  const resultsHeading = document.getElementById("resultsHeading");
  container.innerHTML = "";
  resultsHeading.textContent = `${formatCount(items.length, "profile")}`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML =
      "<strong>No matching profiles.</strong><br />Try broadening the search or clearing filters.";
    container.append(empty);
    return;
  }

  const template = document.getElementById("cardTemplate");

  items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".profile-card__title").textContent = item.name;
    fragment.querySelector(".profile-card__url").textContent = item.url.replace(
      /^https?:\/\//,
      "",
    );
    fragment.querySelector(".profile-card__description").textContent =
      item.description;

    const visitLink = fragment.querySelector(".button--small");
    visitLink.href = item.url;
    visitLink.setAttribute("aria-label", `Visit ${item.name}`);

    const meta = fragment.querySelector(".profile-card__meta");
    [
      ["Primary sector", item.categoryLabel],
      ["Type", item.typeLabel],
      ["Location", item.locationLabel],
      ["Extra sectors", item.categories.slice(1).join(", ") || "—"],
    ].forEach(([term, value]) => {
      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = value;
      wrapper.append(dt, dd);
      meta.append(wrapper);
    });

    const chips = fragment.querySelector(".profile-card__chips");
    item.categories.slice(0, 4).forEach((category) => {
      const chip = document.createElement("span");
      chip.className = "pill";
      chip.textContent = category;
      chips.append(chip);
    });
    if (item.categories.length > 4) {
      const more = document.createElement("span");
      more.className = "pill";
      more.textContent = `+${item.categories.length - 4} more`;
      chips.append(more);
    }

    container.append(fragment);
  });
}

function ensureMap() {
  if (state.map || typeof L === "undefined") return;
  state.map = L.map("map", { scrollWheelZoom: false }).setView(
    KENYA_VIEW.center,
    KENYA_VIEW.zoom,
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);
}

function updateMap(items) {
  ensureMap();
  if (!state.map || !state.markersLayer) return;

  state.markersLayer.clearLayers();
  const bounds = [];

  items.forEach((item) => {
    if (!item.coordinates) return;
    const { lat, lng } = item.coordinates;
    bounds.push([lat, lng]);
    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      weight: 1,
      color: "#56ccf2",
      fillColor: "#4f46e5",
      fillOpacity: 0.88,
    });
    marker.bindPopup(`
      <strong>${item.name}</strong><br />
      ${item.locationLabel}<br />
      ${item.categoryLabel}<br />
      <a href="${item.url}" target="_blank" rel="noreferrer">Open profile</a>
    `);
    marker.addTo(state.markersLayer);
  });

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 9 });
  } else {
    state.map.setView(KENYA_VIEW.center, KENYA_VIEW.zoom);
  }
}

function readFilters() {
  return {
    search: document.getElementById("searchInput").value.trim().toLowerCase(),
    category: document.getElementById("categoryFilter").value,
    type: document.getElementById("typeFilter").value,
    location: document.getElementById("locationFilter").value,
  };
}

function applyFilters() {
  const filters = readFilters();
  state.filteredItems = state.allItems.filter((item) => {
    const matchesSearch =
      !filters.search || item.searchText.includes(filters.search);
    const matchesCategory =
      !filters.category || item.categories.includes(filters.category);
    const matchesType = !filters.type || item.types.includes(filters.type);
    const matchesLocation =
      !filters.location || item.locations.includes(filters.location);
    return matchesSearch && matchesCategory && matchesType && matchesLocation;
  });

  renderActiveFilters(filters);
  renderCards(state.filteredItems);
  updateStats(state.allItems, state.filteredItems);
  updateMap(state.filteredItems);
}

function setupFilters(items) {
  populateSelect(
    document.getElementById("categoryFilter"),
    uniqueSorted(items.flatMap((item) => item.categories)),
    "All sectors",
  );
  populateSelect(
    document.getElementById("typeFilter"),
    uniqueSorted(items.flatMap((item) => item.types)),
    "All types",
  );
  populateSelect(
    document.getElementById("locationFilter"),
    uniqueSorted(items.flatMap((item) => item.locations)),
    "All locations",
  );
}

async function init() {
  ensureMap();
  const status = document.getElementById("dataStatus");

  try {
    const markdown = await fetchReadmeText();
    const parsed = parseReadme(markdown);
    const items = dedupeItems(parsed).map(enrichItem);

    state.allItems = items;
    setupFilters(items);
    applyFilters();
    status.textContent = `Loaded ${items.length} unique profiles from the repository markdown.`;
  } catch (error) {
    console.error(error);
    status.textContent =
      "Could not load the markdown data automatically. Keep the README file next to this page when publishing.";
    renderCards([]);
    updateStats([], []);
    updateMap([]);
  }

  document
    .getElementById("filtersForm")
    .addEventListener("input", applyFilters);
  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("filtersForm").reset();
    applyFilters();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", init);
  window.__TECH_DIRECTORY__ = {
    parseReadme,
    dedupeItems,
    enrichItem,
    findCoordinates,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseReadme, dedupeItems, enrichItem, findCoordinates };
}
