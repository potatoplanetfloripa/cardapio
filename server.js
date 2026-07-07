const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());
app.use(express.json());

const CARDAPIO_URL =
    process.env.CARDAPIO_URL || "https://www.google.com";

const NOME_API =
    process.env.NOME_API || "API de Pagamento";

app.get("/", (req, res) => {
    res.send(`${NOME_API} online 🚀`);
});

app.get("/ping", (req, res) => {
    res.status(200).json({
        ok: true,
        mensagem: "API ativa",
        horario: new Date().toISOString()
    });
});

function gerarPedidoId() {
    return "pedido_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

app.post("/criar-pagamento", async (req, res) => {
    try {
        const { titulo, quantidade, valor } = req.body;

        if (!titulo || !quantidade || !valor) {
            return res.status(400).json({
                erro: "Título, quantidade e valor são obrigatórios."
            });
        }

        const pedidoId = gerarPedidoId();

        const response = await fetch(
            "https://api.mercadopago.com/checkout/preferences",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    items: [
                        {
                            title: titulo,
                            quantity: Number(quantidade),
                            unit_price: Number(valor),
                            currency_id: "BRL"
                        }
                    ],

                    external_reference: pedidoId,

                    payment_methods: {
                        excluded_payment_types: [
                            {
                                id: "ticket"
                            }
                        ],
                        installments: 1
                    },

                    expires: true,
                    expiration_date_from: new Date().toISOString(),
                    expiration_date_to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),

                    back_urls: {
                        success: CARDAPIO_URL,
                        failure: CARDAPIO_URL,
                        pending: CARDAPIO_URL
                    },

                    auto_return: "approved"
                })
            }
        );

        const data = await response.json();

        if (!data.init_point) {
            return res.status(400).json({
                erro: "Mercado Pago não retornou link",
                detalhe: data
            });
        }

        res.json({
            link: data.init_point,
            preferenceId: data.id,
            pedidoId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: "Erro ao criar pagamento"
        });
    }
});

app.get("/verificar-pagamento/:pedidoId", async (req, res) => {
    try {
        const { pedidoId } = req.params;

        if (!pedidoId) {
            return res.status(400).json({
                erro: "pedidoId não informado."
            });
        }

        const url =
            "https://api.mercadopago.com/v1/payments/search" +
            `?external_reference=${encodeURIComponent(pedidoId)}` +
            "&sort=date_created" +
            "&criteria=desc";

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(400).json({
                erro: "Erro ao consultar pagamento no Mercado Pago",
                detalhe: data
            });
        }

        const pagamento =
            data.results && data.results.length > 0 ? data.results[0] : null;

        if (!pagamento) {
            return res.json({
                encontrado: false,
                aprovado: false,
                status: "not_found"
            });
        }

        return res.json({
            encontrado: true,
            aprovado: pagamento.status === "approved",
            status: pagamento.status,
            status_detail: pagamento.status_detail || "",
            payment_id: pagamento.id,
            pedidoId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: "Erro ao verificar pagamento"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
