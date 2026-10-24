const quizSteps = [
  {
    key: "Тип сайта",
    question: "Какой сайт нужен?",
    options: ["Лендинг с ИИ", "Корпоративный сайт", "Магазин или сервис", "Доработка текущего сайта"],
  },
  {
    key: "Цель",
    question: "Что должно произойти после запуска?",
    options: ["Больше заявок", "Запуск продукта", "Пересобрать старый сайт", "Квалифицировать лиды автоматически"],
  },
  {
    key: "Бюджет",
    question: "Какой бюджет рассматриваете?",
    options: ["до 90 000 ₽", "90–180 000 ₽", "180–320 000 ₽", "от 320 000 ₽"],
  },
  {
    key: "Срок",
    question: "Когда нужен результат?",
    options: ["до 2 недель", "3–4 недели", "1–2 месяца", "пока прикидываем"],
  },
];

const demoScript = [
  { role: "guest", text: "Нужен лендинг под запуск курса. Успеете за две недели?" },
  {
    role: "luma",
    text: "Да. Собираем структуру, квиз и форму за 10–14 дней. После коротких вопросов пришлём план в Telegram.",
  },
  { role: "guest", text: "И заявки куда падают?" },
  { role: "luma", text: "В админку и копией в группу команды. Ночью пришло — утром уже созвон." },
];

const quizAnswers = {};
let quizIndex = 0;
const chatMessages = [];
let assistantTurns = 0;

const widget = document.getElementById("ai-widget");
const quizView = document.getElementById("quiz-view");
const chatView = document.getElementById("chat-view");
const chatLog = document.getElementById("chat-log");
const quizQuestion = document.getElementById("quiz-question");
const quizOptions = document.getElementById("quiz-options");
const quizProgress = document.getElementById("quiz-progress");
const quizTrack = document.querySelector("#quiz-track span");
const chatLeadForm = document.getElementById("chat-lead-form");
const chatChips = document.getElementById("chat-chips");
const subtitle = document.getElementById("ai-subtitle");

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playDemo() {
  const log = document.getElementById("demo-log");
  if (!log) return;
  log.innerHTML = "";
  demoScript.forEach((item, index) => {
    const line = document.createElement("p");
    line.className = `line ${item.role}`;
    line.textContent = item.text;
    log.append(line);
    const delay = prefersReducedMotion() ? 0 : 700 + index * 1100;
    window.setTimeout(() => line.classList.add("is-on"), delay);
  });
}

function initMotion() {
  const title = document.getElementById("hero-title");
  if (title && !prefersReducedMotion() && typeof gsap !== "undefined") {
    gsap.from(title, { y: 28, opacity: 0, duration: 1.1, ease: "power3.out" });
  }

  if (prefersReducedMotion() || typeof gsap === "undefined") {
    document.querySelectorAll(".path-step").forEach((node) => node.classList.add("is-on"));
    return;
  }

  try {
    gsap.registerPlugin(ScrollTrigger);

    if (window.Lenis) {
      const lenis = new Lenis({ lerp: 0.08 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    gsap.to(".giant", {
      y: () => window.innerHeight * 0.25,
      ease: "none",
      scrollTrigger: { scrub: true },
    });

    gsap.utils.toArray(".orb").forEach((node, index) => {
      gsap.to(node, {
        y: (index + 1) * 80,
        ease: "none",
        scrollTrigger: { scrub: 1.2 },
      });
    });

    gsap.from(".stage", {
      x: 40,
      opacity: 0,
      duration: 1,
      delay: 0.2,
      ease: "power2.out",
    });

    gsap.utils.toArray(".section-head, .quote, .faq-item").forEach((node) => {
      gsap.from(node, {
        y: 28,
        duration: 0.85,
        ease: "power2.out",
        scrollTrigger: { trigger: node, start: "top 88%", once: true },
      });
    });

    gsap.utils.toArray(".path-step").forEach((node) => {
      ScrollTrigger.create({
        trigger: node,
        start: "top 78%",
        onEnter: () => node.classList.add("is-on"),
      });
    });

    window.addEventListener("mousemove", (event) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      document.querySelectorAll("[data-float]").forEach((node) => {
        const intensity = Number(node.dataset.float) || 1;
        gsap.to(node, {
          x: x * 36 * intensity,
          y: y * 24 * intensity,
          duration: 1.4,
          ease: "power2.out",
          overwrite: "auto",
        });
      });
    });
  } catch (error) {
    console.warn(error);
  }
}

function openAi() {
  widget.hidden = false;
  document.body.style.overflow = "hidden";
  if (!Object.keys(quizAnswers).length) renderQuiz();
}

function closeAi() {
  widget.hidden = true;
  document.body.style.overflow = "";
}

function renderQuiz() {
  const step = quizSteps[quizIndex];
  quizProgress.textContent = `Шаг ${quizIndex + 1} из ${quizSteps.length}`;
  quizQuestion.textContent = step.question;
  quizTrack.style.width = `${(quizIndex / quizSteps.length) * 100}%`;
  quizOptions.innerHTML = "";
  step.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", () => {
      quizAnswers[step.key] = option;
      quizIndex += 1;
      quizTrack.style.width = `${(quizIndex / quizSteps.length) * 100}%`;
      if (quizIndex >= quizSteps.length) {
        startChat();
      } else {
        renderQuiz();
      }
    });
    quizOptions.append(button);
  });
}

function addBubble(role, text, extraClass) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}${extraClass ? ` ${extraClass}` : ""}`;
  bubble.textContent = text;
  chatLog.append(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function maybeShowLead() {
  if (assistantTurns >= 2) {
    chatLeadForm.hidden = false;
  }
}

function renderChips() {
  const suggestions = ["Сроки под мой квиз", "Что входит в работу", "Как устроены заявки"];
  chatChips.innerHTML = "";
  suggestions.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      document.getElementById("chat-input").value = label;
      document.getElementById("chat-form").requestSubmit();
    });
    chatChips.append(button);
  });
}

async function askAssistant(userText, hideUserBubble) {
  if (!hideUserBubble) {
    chatMessages.push({ role: "user", text: userText });
    addBubble("user", userText);
  } else {
    chatMessages.push({ role: "user", text: userText });
  }

  const thinking = addBubble("assistant", "Думаю…", "typing");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages, quiz: quizAnswers }),
    });
    const data = await response.json();
    const reply =
      data.text ||
      data.error ||
      "Не получилось ответить. Оставьте заявку — менеджер напишет сам.";
    thinking.remove();
    chatMessages.push({ role: "assistant", text: reply });
    addBubble("assistant", reply);
    assistantTurns += 1;
    maybeShowLead();
  } catch {
    thinking.classList.remove("typing");
    thinking.textContent = "Связь с ИИ не прошла. Оставьте заявку — менеджер ответит сам.";
    chatLeadForm.hidden = false;
  }
}

async function startChat() {
  quizView.hidden = true;
  chatView.hidden = false;
  subtitle.textContent = "Ответы квиза уже с вами в диалоге";
  renderChips();
  const summary = `Я прошёл квиз. Тип: ${quizAnswers["Тип сайта"]}. Цель: ${quizAnswers["Цель"]}. Бюджет: ${quizAnswers["Бюджет"]}. Срок: ${quizAnswers["Срок"]}. Коротко скажи, что Luma может сделать под эти ответы, и предложи задать вопрос или оставить заявку.`;
  await askAssistant(summary, true);
}

async function sendChat(event) {
  event.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await askAssistant(text, false);
}

async function submitLead(form, statusNode, source) {
  const payload = {
    name: form.name.value.trim(),
    contact: form.contact.value.trim(),
    message: form.message ? form.message.value.trim() : "",
    projectType: form.projectType ? form.projectType.value : quizAnswers["Тип сайта"] || "",
    source,
    quiz: Object.keys(quizAnswers).length ? quizAnswers : null,
  };

  statusNode.textContent = "Отправляем…";
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      statusNode.textContent = data.error || "Не удалось отправить";
      return;
    }
    form.reset();
    const extra = data.telegram?.sent ? " и в Telegram-группу" : "";
    statusNode.textContent = `Заявка ушла в админку${extra}.`;
  } catch {
    statusNode.textContent = "Сеть недоступна. Попробуйте ещё раз.";
  }
}

document.querySelectorAll("[data-open-ai]").forEach((node) => {
  node.addEventListener("click", openAi);
});
document.querySelector("[data-close-ai]")?.addEventListener("click", closeAi);
widget?.addEventListener("click", (event) => {
  if (event.target === widget) closeAi();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && widget && !widget.hidden) closeAi();
});

document.getElementById("chat-form")?.addEventListener("submit", sendChat);
document.getElementById("show-chat-lead")?.addEventListener("click", () => {
  chatLeadForm.hidden = false;
  chatLeadForm.querySelector("input")?.focus();
});

document.getElementById("lead-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitLead(event.target, document.getElementById("lead-status"), "form");
});

document.getElementById("chat-lead-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const source = assistantTurns ? "chat" : "quiz";
  await submitLead(event.target, document.getElementById("chat-lead-status"), source);
});

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.getElementById("nav-links");
navToggle?.addEventListener("click", () => {
  const open = navLinks.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(open));
});
navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => navLinks.classList.remove("is-open"));
});

playDemo();
initMotion();
