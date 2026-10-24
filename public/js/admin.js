const loginForm = document.getElementById("login-form");
const board = document.getElementById("board");
const leadsBody = document.getElementById("leads-body");
const loginStatus = document.getElementById("login-status");
const stats = document.getElementById("stats");

const statusLabel = {
  new: "новая",
  in_progress: "в работе",
  closed: "закрыта",
};

const sourceLabel = {
  form: "форма",
  quiz: "квиз",
  chat: "чат",
};

let currentFilter = "all";
let cache = [];

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function quizText(quiz) {
  if (!quiz) return "";
  return Object.entries(quiz)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

function render() {
  leadsBody.replaceChildren();
  const list = cache.filter((lead) => currentFilter === "all" || lead.status === currentFilter);

  stats.textContent = "";
  const counts = {
    all: cache.length,
    new: cache.filter((item) => item.status === "new").length,
    in_progress: cache.filter((item) => item.status === "in_progress").length,
    closed: cache.filter((item) => item.status === "closed").length,
  };
  stats.textContent = `${counts.new} новых · ${counts.in_progress} в работе · ${counts.closed} закрытых`;

  if (!list.length) {
    const empty = document.createElement("p");
    empty.textContent = "Заявок в этом фильтре нет";
    leadsBody.append(empty);
    return;
  }

  list.forEach((lead) => {
    const card = document.createElement("article");
    card.className = "lead-card";

    const title = document.createElement("h3");
    title.textContent = lead.name;

    const meta = document.createElement("p");
    meta.className = "lead-meta";
    meta.textContent = [
      formatDate(lead.createdAt),
      lead.contact,
      lead.projectType,
      sourceLabel[lead.source] || lead.source,
      statusLabel[lead.status],
    ]
      .filter(Boolean)
      .join(" · ");

    const message = document.createElement("p");
    message.textContent = lead.message || quizText(lead.quiz) || "Без комментария";

    const actions = document.createElement("p");
    [
      ["in_progress", "В работе"],
      ["closed", "Закрыта"],
      ["new", "Вернуть в новые"],
    ].forEach(([status, label]) => {
      const button = document.createElement("button");
      button.className = "btn btn-ghost status-btn";
      button.type = "button";
      button.dataset.id = lead.id;
      button.dataset.status = status;
      button.textContent = label;
      actions.append(button);
    });

    card.append(title, meta, message, actions);
    leadsBody.append(card);
  });
}

async function loadLeads() {
  const response = await fetch("/api/leads");
  if (response.status === 401) {
    loginForm.hidden = false;
    board.hidden = true;
    return;
  }
  const data = await response.json();
  cache = data.leads || [];
  loginForm.hidden = true;
  board.hidden = false;
  render();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = event.target.password.value;
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await response.json();
  if (!response.ok) {
    loginStatus.textContent = data.error || "Ошибка входа";
    return;
  }
  await loadLeads();
});

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  loginForm.hidden = false;
  board.hidden = true;
});

document.getElementById("filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  currentFilter = button.dataset.filter;
  document.querySelectorAll("#filters button").forEach((node) => {
    node.setAttribute("aria-pressed", String(node === button));
  });
  render();
});

leadsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-status]");
  if (!button) return;
  await fetch(`/api/leads/${button.dataset.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: button.dataset.status }),
  });
  await loadLeads();
});

loadLeads();
