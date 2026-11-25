
const usersContainer = document.querySelector("#users");
const summary = document.querySelector("#summary");
const cancelButton = document.querySelector("#cancel");

function getParams() {
    const params = new URLSearchParams(window.location.search);

    const rawIds = params.get("ids") ?? "1,2,3";
    const rawDelay = params.get("delay") ?? "0";

    const ids = rawIds.split(",");

    if (
        ids.length > 5 ||
        ids.some(id =>
            !/^\d+$/.test(id) ||
            !Number.isSafeInteger(Number(id)) ||
            Number(id) <= 0
        )
    ) {
        throw new Error(
            "Параметр ids должен содержать от 1 до 5 положительных целых чисел"
        );
    }

    const delay = Number(rawDelay);

    if (
        !/^\d+$/.test(rawDelay) ||
        !Number.isInteger(delay) ||
        delay < 0 ||
        delay > 5000
    ) {
        throw new Error(
            "Параметр delay должен быть целым числом от 0 до 5000"
        );
    }

    return {
        ids: ids.map(Number),
        delay
    };
}

function setSummary(state, message) {
    summary.dataset.state = state;
    summary.textContent = message;
}

async function fetchUser(id, delay, signal) {
    const url = `https://dummyjson.com/users/${id}?delay=${delay}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    element.className = className;
    element.textContent = text;

    return element;
}

function createUserCard(id, result) {
    const article = document.createElement("article");

    article.dataset.id = String(id);

    if (result.status === "fulfilled") {
        const user = result.value;

        article.dataset.state = "success";

        const name = createElement(
            "h2",
            "name",
            `${user.firstName} ${user.lastName}`
        );

        const email = createElement(
            "a",
            "email",
            user.email
        );

        email.href = `mailto:${user.email}`;

        const city = createElement(
            "span",
            "city",
            user.address.city
        );

        const company = createElement(
            "span",
            "company",
            user.company.name
        );

        article.append(name, email, city, company);
    } else {
        const isAborted = result.reason?.name === "AbortError";

        article.dataset.state = isAborted
            ? "aborted"
            : "error";

        const message = createElement(
            "span",
            "message",
            isAborted
                ? "Запрос отменён"
                : result.reason?.message ?? "Неизвестная ошибка"
        );

        article.append(message);
    }

    return article;
}

async function loadUsers() {
    cancelButton.disabled = true;

    let params;

    try {
        params = getParams();
    } catch (error) {
        setSummary("error", error.message);
        return;
    }

    const { ids, delay } = params;

    const controller = new AbortController();

    cancelButton.disabled = false;

    cancelButton.addEventListener("click", () => {
        controller.abort();
        cancelButton.disabled = true;
    }, { once: true });

    setSummary("loading", "Загрузка...");

    // Запускаем все запросы параллельно.
    const promises = ids.map(id =>
        fetchUser(id, delay, controller.signal)
    );

    // Ожидаем завершения всех запросов, включая неудачные.
    const results = await Promise.allSettled(promises);

    let successCount = 0;
    let errorCount = 0;
    let abortedCount = 0;

    results.forEach((result, index) => {
        const card = createUserCard(ids[index], result);

        usersContainer.append(card);

        if (result.status === "fulfilled") {
            successCount++;
        } else if (result.reason?.name === "AbortError") {
            abortedCount++;
        } else {
            errorCount++;
        }
    });

    let state;

    if (abortedCount > 0) {
        state = "aborted";
    } else if (successCount === ids.length) {
        state = "success";
    } else if (successCount === 0) {
        state = "error";
    } else {
        state = "partial";
    }

    const message = [
        `Загружено: ${successCount}`,
        `ошибок: ${errorCount}`,
        `отменено: ${abortedCount}`
    ].join("; ");

    setSummary(state, message);

    cancelButton.disabled = true;
}

loadUsers();
