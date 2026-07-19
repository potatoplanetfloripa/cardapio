function obterApiPushUrl() {
    return new Promise((resolve, reject) => {
        const urlAtual = String(
            window.API_CARDAPIO_URL || "",
        )
            .trim()
            .replace(/\/$/, "");

        // A configuração já foi carregada
        if (urlAtual) {
            resolve(urlAtual);
            return;
        }

        let finalizado = false;

        const timeout = setTimeout(() => {
            if (finalizado) return;

            finalizado = true;

            window.removeEventListener(
                "apiCardapioCarregada",
                receberApi,
            );

            reject(
                new Error(
                    "A URL da API não foi carregada da planilha.",
                ),
            );
        }, 15000);

        function receberApi(evento) {
            if (finalizado) return;

            const apiUrl = String(
                evento.detail?.apiUrl || "",
            )
                .trim()
                .replace(/\/$/, "");

            if (!apiUrl) return;

            finalizado = true;
            clearTimeout(timeout);

            window.removeEventListener(
                "apiCardapioCarregada",
                receberApi,
            );

            resolve(apiUrl);
        }

        window.addEventListener(
            "apiCardapioCarregada",
            receberApi,
        );
    });
}

const COOKIE_PUSH = "pushPermissaoCardapio";

function obterCookie(nome) {
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
        const [chave, valor] = cookie.trim().split("=");

        if (chave === nome) {
            return decodeURIComponent(valor);
        }
    }

    return null;
}

function salvarCookie(nome, valor, dias = 365) {
    const data = new Date();

    data.setTime(
        data.getTime() +
        dias * 24 * 60 * 60 * 1000
    );

    const secure =
        location.protocol === "https:"
            ? ";Secure"
            : "";

    document.cookie =
        `${nome}=${encodeURIComponent(valor)};` +
        `expires=${data.toUTCString()};` +
        "path=/;SameSite=Lax" +
        secure;
}

function exibirPopupPushCardapio() {
    return new Promise((resolve) => {
        if (document.getElementById("push-cardapio-popup")) {
            resolve(false);
            return;
        }

        const popup = document.createElement("div");
        popup.id = "push-cardapio-popup";
        popup.className = "push-cardapio-popup";

        popup.innerHTML = `
      <div class="push-cardapio-icone">🔔</div>

      <div class="push-cardapio-texto">
        <strong>Receber novidades?</strong>
        <span>Promoções e avisos deste cardápio.</span>
      </div>

      <div class="push-cardapio-acoes">
        <button type="button" id="push-negar">Agora não</button>
        <button type="button" id="push-aceitar">Permitir</button>
      </div>
    `;

        document.body.appendChild(popup);

        setTimeout(() => {
            popup.classList.add("visivel");
        }, 100);

        document.getElementById("push-negar").addEventListener(
            "click",
            () => {
                resolve(false);

                popup.classList.remove("visivel");

                setTimeout(() => {
                    popup.remove();
                }, 250);
            },
            { once: true },
        );

        document.getElementById("push-aceitar").addEventListener(
            "click",
            () => {
                /*
                 * Precisa resolver imediatamente para que
                 * Notification.requestPermission() ainda seja
                 * considerado consequência direta do clique.
                 */
                resolve(true);

                popup.classList.remove("visivel");

                setTimeout(() => {
                    popup.remove();
                }, 250);
            },
            { once: true },
        );
    });
}

async function iniciarPushCardapio() {
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    const API_PUSH_URL = await obterApiPushUrl();

    console.log(
        "API usada pelo Push:",
        API_PUSH_URL,
    );

    /*
     * O popup só deixa de aparecer quando
     * o cookie de aceite existir.
     */
    const permissaoSalva = obterCookie(COOKIE_PUSH);

    if (permissaoSalva === "permitido") {
        if (Notification.permission !== "granted") {
            return;
        }

        try {
            const registro =
                await navigator.serviceWorker.register("./sw.js");

            await navigator.serviceWorker.ready;

            let subscription =
                await registro.pushManager.getSubscription();

            /*
             * Se a permissão existe, mas a assinatura
             * desapareceu, cria uma nova.
             */
            if (!subscription) {
                const respostaChave = await fetch(
                    `${API_PUSH_URL}/push/public-key`,
                    {
                        cache: "no-store",
                    },
                );

                const dadosChave =
                    await respostaChave.json();

                if (
                    !respostaChave.ok ||
                    !dadosChave.publicKey
                ) {
                    throw new Error(
                        dadosChave.erro ||
                        "Não foi possível obter a chave pública Push.",
                    );
                }

                subscription =
                    await registro.pushManager.subscribe({
                        userVisibleOnly: true,

                        applicationServerKey:
                            converterBase64ParaUint8Array(
                                dadosChave.publicKey,
                            ),
                    });
            }

            /*
             * Reenvia para a API mesmo quando a
             * assinatura já existia.
             */
            const respostaRegistro = await fetch(
                `${API_PUSH_URL}/push/registrar-dispositivo`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        loja:
                            document
                                .getElementById("nome-loja-cardapio")
                                ?.textContent?.trim() ||
                            document.title ||
                            "Loja",

                        subscription: subscription.toJSON(),
                    }),
                },
            );

            const retornoRegistro =
                await respostaRegistro.json();

            if (
                !respostaRegistro.ok ||
                retornoRegistro.sucesso !== true
            ) {
                throw new Error(
                    retornoRegistro.erro ||
                    "Não foi possível revalidar o dispositivo Push.",
                );
            }

            console.log(
                "Dispositivo Push revalidado com sucesso.",
            );
        } catch (erro) {
            console.warn(
                "Não foi possível revalidar o dispositivo Push:",
                erro,
            );
        }

        return;
    }

    try {
        /*
         * Sem cookie, mostra o popup personalizado,
         * mesmo que a permissão do navegador já
         * esteja concedida.
         */
        const aceitou = await exibirPopupPushCardapio();

        /*
         * "Agora não" não grava cookie.
         * Assim o popup reaparece na próxima visita.
         */
        if (!aceitou) {
            return;
        }

        /*
         * Se o navegador ainda não recebeu uma decisão,
         * solicita a permissão oficial.
         */
        if (Notification.permission === "default") {
            const permissao =
                await Notification.requestPermission();

            if (permissao !== "granted") {
                /*
                 * Não salva cookie, pois o aceite não
                 * foi concluído com sucesso.
                 */
                return;
            }
        }

        /*
         * Se já estiver bloqueado, não é possível
         * solicitar novamente pelo JavaScript.
         */
        if (Notification.permission === "denied") {
            if (
                typeof exibirAvisoNotificacaoBloqueada ===
                "function"
            ) {
                exibirAvisoNotificacaoBloqueada();
            } else {
                alert(
                    "As notificações estão bloqueadas. Permita-as nas configurações deste site.",
                );
            }

            return;
        }

        const registro =
            await navigator.serviceWorker.register(
                "./sw.js",
            );

        await navigator.serviceWorker.ready;

        /*
         * Reutiliza a assinatura existente.
         * Cria uma nova somente se necessário.
         */
        let subscription =
            await registro.pushManager.getSubscription();

        if (!subscription) {
            const respostaChave = await fetch(
                `${API_PUSH_URL}/push/public-key`,
                {
                    cache: "no-store",
                },
            );

            const dadosChave =
                await respostaChave.json();

            if (
                !respostaChave.ok ||
                !dadosChave.publicKey
            ) {
                throw new Error(
                    dadosChave.erro ||
                    "Não foi possível obter a chave pública Push.",
                );
            }

            subscription =
                await registro.pushManager.subscribe({
                    userVisibleOnly: true,

                    applicationServerKey:
                        converterBase64ParaUint8Array(
                            dadosChave.publicKey,
                        ),
                });
        }

        console.log(
            "Push subscription:",
            subscription,
        );

        /*
         * Envia a assinatura, inclusive quando
         * ela já existia no navegador.
         */
        const respostaRegistro = await fetch(
            `${API_PUSH_URL}/push/registrar-dispositivo`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    loja:
                        document
                            .getElementById(
                                "nome-loja-cardapio",
                            )
                            ?.textContent?.trim() ||
                        document.title ||
                        "Loja",

                    subscription:
                        subscription.toJSON(),
                }),
            },
        );

        const retornoRegistro =
            await respostaRegistro.json();

        console.log(
            "Retorno registro push:",
            retornoRegistro,
        );

        if (
            !respostaRegistro.ok ||
            retornoRegistro.sucesso !== true
        ) {
            throw new Error(
                retornoRegistro.erro ||
                "Não foi possível registrar o dispositivo Push.",
            );
        }

        /*
         * O cookie só é criado depois de:
         * 1. clicar em Permitir;
         * 2. conceder a permissão;
         * 3. salvar o dispositivo na planilha.
         */
        salvarCookie(
            COOKIE_PUSH,
            "permitido",
        );

        console.log(
            "Dispositivo Push registrado com sucesso.",
        );
    } catch (erro) {
        console.error(
            "Erro ao configurar notificações Push:",
            erro,
        );
    }
}

function converterBase64ParaUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

window.addEventListener("load", () => {
    setTimeout(() => {
        iniciarPushCardapio();
    }, 4000);
});
