let content = null;
let activeCategory = "all";
let activeTag = "all";
let activeType = "all";
let query = "";

const elements = {
  title: document.querySelector("#site-title"),
  subtitle: document.querySelector("#site-subtitle"),
  viewCount: document.querySelector("#view-count"),
  search: document.querySelector("#search-input"),
  categorySelect: document.querySelector("#category-select"),
  tagChips: document.querySelector("#tag-chips"),
  resetFilters: document.querySelector("#reset-filters"),
  typeButtons: document.querySelectorAll(".type-button"),
  grid: document.querySelector("#content-grid"),
  empty: document.querySelector("#empty-state"),
  template: document.querySelector("#card-template")
};

function formatNumber(value) {
  return new Intl.NumberFormat("zh-Hant").format(Number(value || 0));
}

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function itemHasPrompt(item) {
  return Boolean(normalize(item.prompt));
}

function matchesItem(item) {
  const categoryMatch = activeCategory === "all" || item.categoryId === activeCategory;
  const tagMatch = activeTag === "all" || (item.tags || []).includes(activeTag);
  const typeMatch =
    activeType === "all" ||
    (activeType === "prompt" && itemHasPrompt(item)) ||
    (activeType === "link" && !itemHasPrompt(item));

  const haystack = normalize([
    item.title,
    item.description,
    item.prompt,
    item.url,
    ...(item.tags || [])
  ].join(" "));

  return categoryMatch && tagMatch && typeMatch && haystack.includes(normalize(query));
}

function renderCategorySelect() {
  const options = [
    ["all", "全部分類"],
    ...content.categories.map((category) => [category.id, category.name])
  ].map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === activeCategory;
    return option;
  });

  elements.categorySelect.replaceChildren(...options);
}

function renderTagChips() {
  const tags = [...new Set(content.items.flatMap((item) => item.tags || []))];
  const chips = ["all", ...tags].map((tag) => {
    const button = document.createElement("button");
    button.className = "chip-button";
    button.type = "button";
    button.textContent = tag === "all" ? "全部標籤" : `#${tag}`;
    button.setAttribute("aria-pressed", String(activeTag === tag));
    button.addEventListener("click", () => {
      activeTag = tag;
      render();
    });
    return button;
  });

  elements.tagChips.replaceChildren(...chips);
}

function renderCards() {
  const categories = new Map(content.categories.map((category) => [category.id, category]));
  const items = content.items.filter(matchesItem);
  const cards = items.map((item) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const category = categories.get(item.categoryId);
    card.querySelector(".category-pill").textContent = category ? category.name : "未分類";
    card.querySelector("h2").textContent = item.title;
    card.querySelector(".description").textContent = item.description || "尚未填寫說明。";

    const tagList = card.querySelector(".tag-list");
    tagList.textContent = (item.tags || []).map((tag) => `#${tag}`).join(" ");

    const promptPreview = card.querySelector(".prompt-preview");
    promptPreview.textContent = item.prompt || "這筆內容主要提供外部連結。";

    const link = card.querySelector("a");
    link.href = item.url;

    const copyButton = card.querySelector(".copy-button");
    if (!item.prompt) {
      copyButton.disabled = true;
      copyButton.textContent = "無提示詞";
    } else {
      copyButton.addEventListener("click", async () => {
        await navigator.clipboard.writeText(item.prompt);
        copyButton.textContent = "已複製";
        setTimeout(() => {
          copyButton.textContent = "複製提示詞";
        }, 1400);
      });
    }

    return card;
  });

  elements.grid.replaceChildren(...cards);
  elements.empty.hidden = items.length > 0;
}

function render() {
  elements.title.textContent = content.site.title;
  elements.subtitle.textContent = content.site.subtitle;
  renderCategorySelect();
  renderTagChips();
  renderCards();
}

function renderStats(stats) {
  elements.viewCount.textContent = formatNumber(stats.totalViews);
}

function bindTopbarScroll() {
  const topbar = document.querySelector("#topbar");
  if (!topbar) return;

  const syncTopbar = () => {
    topbar.classList.toggle("is-compact", window.scrollY > 24);
  };

  syncTopbar();
  window.addEventListener("scroll", syncTopbar, { passive: true });
}

function resetFilters() {
  activeCategory = "all";
  activeTag = "all";
  activeType = "all";
  query = "";
  elements.search.value = "";
  elements.typeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.type === "all"));
  });
  render();
}

async function boot() {
  const [contentResponse, statsResponse] = await Promise.all([
    fetch("/api/content"),
    fetch("/api/stats/visit", { method: "POST" })
  ]);
  content = await contentResponse.json();
  const stats = await statsResponse.json();
  document.title = content.site.title;

  elements.search.addEventListener("input", (event) => {
    query = event.target.value;
    renderCards();
  });

  elements.categorySelect.addEventListener("change", (event) => {
    activeCategory = event.target.value;
    renderCards();
  });

  elements.typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeType = button.dataset.type;
      elements.typeButtons.forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });
      renderCards();
    });
  });

  elements.resetFilters.addEventListener("click", resetFilters);
  bindTopbarScroll();
  render();
  renderStats(stats);
}

boot().catch(() => {
  elements.grid.innerHTML = "";
  elements.empty.hidden = false;
  elements.empty.querySelector("h2").textContent = "資料載入失敗";
  elements.empty.querySelector("p").textContent = "請確認網站伺服器是否正常啟動。";
});
