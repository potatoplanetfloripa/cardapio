self.addEventListener("push", (event) => {
  let dados = {};

  try {
    dados = event.data ? event.data.json() : {};
  } catch (erro) {
    dados = {};
  }

  const titulo = dados.titulo || dados.loja || "Nova notificação";

  const opcoes = {
    body: dados.mensagem || "",
    icon: dados.icone || dados.logo || "./icon.png",
    badge: dados.icone || dados.logo || "./icon.png",
    image: dados.imagem || undefined,
    data: {
      url: dados.link || "./",
    },
  };

  if (dados.botao && dados.botao.texto && dados.botao.link) {
    opcoes.actions = [
      {
        action: "abrir",
        title: dados.botao.texto,
      },
    ];

    opcoes.data.url = dados.botao.link;
  }

  event.waitUntil(
    self.registration.showNotification(titulo, opcoes)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "./";

  event.waitUntil(
    clients.openWindow(url)
  );
});
