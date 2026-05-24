let content = null;

const loginPanel = document.querySelector("#login-panel");
const adminPanel = document.querySelector("#admin-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const saveMessage = document.querySelector("#save-message");
const categoryList = document.querySelector("#category-list");
const itemEditorList = document.querySelector("#item-editor-list");
const categoryTemplate = document.querySelector("#category-editor-template");
const itemTemplate = document.querySelector("#item-editor-template");

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || "操作失敗。");
  return payload;
}

async function loadContent() {
  content = await api("/api/content");
}

function bindSiteFields() {
  document.querySelector("#site-title-input").value = content.site.title || "";
  document.querySelector("#site-subtitle-input").value = content.site.subtitle || "";

  document.querySelector("#site-title-input").addEventListener("input", (event) => {
    content.site.title = event.target.value;
  });
  document.querySelector("#site-subtitle-input").addEventListener("input", (event) => {
    content.site.subtitle = event.target.value;
  });
}

function renderCategories() {
  const editors = content.categories.map((category) => {
    const editor = categoryTemplate.content.firstElementChild.cloneNode(true);
    editor.querySelector('[data-field="name"]').value = category.name;
    editor.querySelector('[data-field="description"]').value = category.description || "";

    editor.querySelector('[data-field="name"]').addEventListener("input", (event) => {
      category.name = event.target.value;
      renderItems();
    });
    editor.querySelector('[data-field="description"]').addEventListener("input", (event) => {
      category.description = event.target.value;
    });
    editor.querySelector('[data-action="delete-category"]').addEventListener("click", () => {
      const used = content.items.some((item) => item.categoryId === category.id);
      if (used) {
        setMessage(saveMessage, "這個分類仍有內容，請先移動或刪除那些內容。", "error");
        return;
      }
      content.categories = content.categories.filter((item) => item.id !== category.id);
      renderCategories();
      renderItems();
    });
    return editor;
  });
  categoryList.replaceChildren(...editors);
}

function makeCategoryOptions(selectedId) {
  return content.categories.map((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === selectedId;
    return option;
  });
}

function renderItems() {
  const editors = content.items.map((item) => {
    const editor = itemTemplate.content.firstElementChild.cloneNode(true);
    editor.querySelector("h3").textContent = item.title || "未命名內容";

    const titleInput = editor.querySelector('[data-field="title"]');
    const categorySelect = editor.querySelector('[data-field="categoryId"]');
    const urlInput = editor.querySelector('[data-field="url"]');
    const descriptionInput = editor.querySelector('[data-field="description"]');
    const promptInput = editor.querySelector('[data-field="prompt"]');
    const tagsInput = editor.querySelector('[data-field="tags"]');

    titleInput.value = item.title || "";
    categorySelect.replaceChildren(...makeCategoryOptions(item.categoryId));
    urlInput.value = item.url || "";
    descriptionInput.value = item.description || "";
    promptInput.value = item.prompt || "";
    tagsInput.value = (item.tags || []).join(", ");

    titleInput.addEventListener("input", (event) => {
      item.title = event.target.value;
      editor.querySelector("h3").textContent = item.title || "未命名內容";
    });
    categorySelect.addEventListener("change", (event) => {
      item.categoryId = event.target.value;
    });
    urlInput.addEventListener("input", (event) => {
      item.url = event.target.value;
    });
    descriptionInput.addEventListener("input", (event) => {
      item.description = event.target.value;
    });
    promptInput.addEventListener("input", (event) => {
      item.prompt = event.target.value;
    });
    tagsInput.addEventListener("input", (event) => {
      item.tags = event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean);
    });
    editor.querySelector('[data-action="delete-item"]').addEventListener("click", () => {
      content.items = content.items.filter((candidate) => candidate.id !== item.id);
      renderItems();
    });

    return editor;
  });
  itemEditorList.replaceChildren(...editors);
}

function addCategory() {
  const category = {
    id: uid("category"),
    name: "新分類",
    description: ""
  };
  content.categories.push(category);
  renderCategories();
  renderItems();
}

function addItem() {
  if (content.categories.length === 0) addCategory();
  content.items.unshift({
    id: uid("item"),
    categoryId: content.categories[0].id,
    title: "新內容",
    description: "",
    url: "https://example.com/",
    prompt: "",
    tags: []
  });
  renderItems();
}

async function saveAll() {
  setMessage(saveMessage, "正在儲存...");
  try {
    content = await api("/api/admin/content", {
      method: "PUT",
      body: JSON.stringify(content)
    });
    setMessage(saveMessage, "已儲存，前台會立即更新。", "success");
  } catch (error) {
    setMessage(saveMessage, error.message, "error");
  }
}

async function showAdmin() {
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  await loadContent();
  bindSiteFields();
  renderCategories();
  renderItems();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "正在登入...");
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: document.querySelector("#password-input").value })
    });
    setMessage(loginMessage, "");
    await showAdmin();
  } catch (error) {
    setMessage(loginMessage, error.message, "error");
  }
});

document.querySelector("#save-button").addEventListener("click", saveAll);
document.querySelector("#add-category-button").addEventListener("click", addCategory);
document.querySelector("#add-item-button").addEventListener("click", addItem);
document.querySelector("#logout-button").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.reload();
});

(async function boot() {
  const session = await api("/api/admin/session");
  if (session.authenticated) await showAdmin();
})();
