const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const webpush = require("web-push");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const app = express();

app.set("trust proxy", 1);

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: {
            policy: "cross-origin",
        },
    }),
);

const ORIGENS_PERMITIDAS = String(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean);

const configuracaoCors = {
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        if (ORIGENS_PERMITIDAS.includes(origin)) {
            return callback(null, true);
        }

        console.warn("Origem bloqueada pelo CORS:", origin);
        return callback(new Error("Origem não autorizada pelo CORS."));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    optionsSuccessStatus: 204,
};

app.use(cors(configuracaoCors));
app.options("*", cors(configuracaoCors));

app.use(
    express.json({
        limit: "100kb",
        strict: true,
    }),
);

const limiteGeral = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro: "Muitas solicitações. Aguarde alguns minutos e tente novamente.",
    },
});

const limiteCriarPagamento = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro: "Muitas tentativas de pagamento. Aguarde alguns minutos.",
    },
});

const limiteVerificarPagamento = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro: "Muitas consultas de pagamento. Aguarde um momento.",
    },
});

const limiteCancelarPedido = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro:
            "Muitas tentativas de cancelamento. Aguarde alguns minutos.",
    },
});

const limiteRegistroPush = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro: "Muitas tentativas de registro de notificações.",
    },
});

const limiteEnvioPush = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro: "Limite de envio de notificações atingido.",
    },
});

const limiteGerarVapid = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        sucesso: false,
        erro: "Muitas tentativas de geração de chaves. Aguarde alguns minutos.",
    },
});

app.use(limiteGeral);

const CARDAPIO_URL = process.env.CARDAPIO_URL || "https://www.google.com";
const NOME_API = process.env.NOME_API || "API de Pagamento";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL =
    process.env.VAPID_EMAIL || "mailto:contato@cardapio.com";

const variaveisObrigatorias = [
    "MP_ACCESS_TOKEN",
    "CARDAPIO_URL",
    "APPS_SCRIPT_URL",
    "PUSH_ADMIN_KEY",
];

const variaveisAusentes = variaveisObrigatorias.filter(
    (nome) => !String(process.env[nome] || "").trim(),
);

if (variaveisAusentes.length > 0) {
    console.error(
        "Variáveis obrigatórias ausentes:",
        variaveisAusentes.join(", "),
    );
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_EMAIL,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
    );
} else {
    console.warn(
        "VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configurada. O envio Push ficará indisponível.",
    );
}

app.get("/", (req, res) => {
    res.send(`${NOME_API} online 🚀`);
});

app.get("/ping", (req, res) => {
    res.status(200).json({
        ok: true,
        mensagem: "API ativa",
        horario: new Date().toISOString(),
    });
});

function gerarPedidoId() {
    return `pedido_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function protegerRotaAdministrativa(req, res, next) {
    const chaveConfigurada = String(
        process.env.ADMIN_API_KEY ||
        process.env.PUSH_ADMIN_KEY ||
        "",
    ).trim();

    const chaveRecebida = String(
        req.get("X-Admin-Key") || "",
    ).trim();

    if (!chaveConfigurada) {
        console.error(
            "ADMIN_API_KEY não configurada no servidor.",
        );

        return res.status(503).json({
            sucesso: false,
            erro: "Acesso administrativo não configurado.",
        });
    }

    if (!chaveRecebida) {
        return res.status(401).json({
            sucesso: false,
            erro: "Chave administrativa não informada.",
        });
    }

    const chaveConfiguradaBuffer =
        Buffer.from(chaveConfigurada);

    const chaveRecebidaBuffer =
        Buffer.from(chaveRecebida);

    const chavesMesmoTamanho =
        chaveConfiguradaBuffer.length ===
        chaveRecebidaBuffer.length;

    const chaveValida =
        chavesMesmoTamanho &&
        crypto.timingSafeEqual(
            chaveConfiguradaBuffer,
            chaveRecebidaBuffer,
        );

    if (!chaveValida) {
        console.warn(
            "Tentativa de acesso não autorizado à rota administrativa.",
        );

        return res.status(403).json({
            sucesso: false,
            erro: "Acesso administrativo negado.",
        });
    }

    next();
}

function normalizarValorMonetario(valor) {
    if (
        typeof valor === "string"
    ) {
        valor = valor
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim();
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return null;
    }

    return (
        Math.round(
            (numero + Number.EPSILON) * 100,
        ) / 100
    );
}

function paymentIdValido(paymentId) {
    return /^[0-9]+$/.test(
        String(paymentId || "").trim(),
    );
}

async function consultarPagamentoMercadoPago(
    paymentId,
) {
    const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
            paymentId,
        )}`,
        {
            method: "GET",
            headers: {
                Authorization:
                    `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                "Content-Type":
                    "application/json",
            },
        },
    );

    let data;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok || !data) {
        const erro = new Error(
            data?.message ||
            "Não foi possível consultar o pagamento no Mercado Pago.",
        );

        erro.statusHttp =
            response.status === 404 ? 404 : 502;

        erro.detalhes = data;

        throw erro;
    }

    return data;
}

async function consultarEstornosMercadoPago(
    paymentId,
) {
    const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
            paymentId,
        )}/refunds`,
        {
            method: "GET",
            headers: {
                Authorization:
                    `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                "Content-Type":
                    "application/json",
            },
        },
    );

    let data;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const erro = new Error(
            data?.message ||
            "Não foi possível consultar os estornos anteriores.",
        );

        erro.statusHttp = 502;
        erro.detalhes = data;

        throw erro;
    }

    return Array.isArray(data) ? data : [];
}

function calcularTotalJaEstornado(estornos) {
    return estornos.reduce(
        (total, estorno) => {
            const valor =
                normalizarValorMonetario(
                    estorno?.amount,
                ) || 0;

            /*
             * Consideramos apenas estornos que não
             * foram recusados ou cancelados.
             */
            const status = String(
                estorno?.status || "",
            )
                .trim()
                .toLowerCase();

            if (
                status === "rejected" ||
                status === "cancelled"
            ) {
                return total;
            }

            return total + valor;
        },
        0,
    );
}

app.post(
    "/criar-pagamento",
    limiteCriarPagamento,
    async (req, res) => {
        try {
            const titulo = String(
                req.body?.titulo || ""
            ).trim();

            const itens = req.body?.itens;

            const tipoEntrega = String(
                req.body?.tipoEntrega || ""
            )
                .trim()
                .toLowerCase();

            const bairro = String(
                req.body?.bairro || ""
            ).trim();

            const cupom = String(
                req.body?.cupom || ""
            )
                .trim()
                .toUpperCase();

            /*
             * O valor enviado pelo navegador não é lido.
             *
             * Mesmo que alguém envie:
             * valor: 0.01
             *
             * essa informação será ignorada.
             */

            if (!titulo) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Título do pagamento não informado.",
                });
            }

            if (titulo.length > 120) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Título do pagamento muito longo.",
                });
            }

            if (
                !Array.isArray(itens) ||
                itens.length === 0
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "O pedido não possui itens.",
                });
            }

            if (itens.length > 100) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "O pedido possui itens demais.",
                });
            }

            if (
                tipoEntrega !== "entrega" &&
                tipoEntrega !== "retirada"
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Tipo de entrega inválido.",
                });
            }

            if (
                tipoEntrega === "entrega" &&
                !bairro
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Bairro não informado.",
                });
            }

            if (!process.env.APPS_SCRIPT_URL) {
                console.error(
                    "APPS_SCRIPT_URL não configurada."
                );

                return res.status(503).json({
                    sucesso: false,
                    erro:
                        "Não foi possível calcular o pedido.",
                });
            }

            if (!process.env.MP_ACCESS_TOKEN) {
                console.error(
                    "MP_ACCESS_TOKEN não configurado."
                );

                return res.status(503).json({
                    sucesso: false,
                    erro:
                        "Pagamento temporariamente indisponível.",
                });
            }

            /*
             * Envia somente a estrutura do pedido.
             * Os preços presentes nos itens serão
             * ignorados pelo Apps Script.
             */
            const parametrosCalculo =
                new URLSearchParams({
                    acao: "calcularPedidoSeguro",
                    itens: JSON.stringify(itens),
                    tipoEntrega,
                    bairro:
                        tipoEntrega === "entrega"
                            ? bairro
                            : "",
                    cupom,
                    t: Date.now().toString(),
                });

            const respostaCalculo =
                await fetch(
                    `${process.env.APPS_SCRIPT_URL}?${parametrosCalculo.toString()}`,
                    {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                        },
                    },
                );

            const textoCalculo =
                await respostaCalculo.text();

            let calculo;

            try {
                calculo =
                    JSON.parse(textoCalculo);
            } catch (erro) {
                console.error(
                    "Apps Script não retornou JSON válido ao calcular o pedido:",
                    textoCalculo.slice(0, 300),
                );

                return res.status(502).json({
                    sucesso: false,
                    erro:
                        "Não foi possível validar o valor do pedido.",
                });
            }

            if (
                !respostaCalculo.ok ||
                !calculo ||
                calculo.sucesso !== true
            ) {
                console.error(
                    "Erro ao calcular pedido no Apps Script:",
                    respostaCalculo.status,
                    calculo,
                );

                return res.status(400).json({
                    sucesso: false,
                    erro:
                        calculo?.erro ||
                        "Não foi possível validar o pedido.",
                });
            }

            if (
                calculo.calculoSeguro !== true
            ) {
                console.error(
                    "Resposta do cálculo sem confirmação de segurança:",
                    calculo,
                );

                return res.status(502).json({
                    sucesso: false,
                    erro:
                        "Não foi possível confirmar o valor do pedido.",
                });
            }

            const subtotal = Number(
                calculo.subtotal
            );

            const frete = Number(
                calculo.frete
            );

            const desconto = Number(
                calculo.desconto
            );

            const totalSeguro = Number(
                calculo.total
            );

            if (
                !Number.isFinite(subtotal) ||
                subtotal < 0 ||
                !Number.isFinite(frete) ||
                frete < 0 ||
                !Number.isFinite(desconto) ||
                desconto < 0 ||
                !Number.isFinite(totalSeguro) ||
                totalSeguro <= 0 ||
                totalSeguro > 10000
            ) {
                console.error(
                    "Valores inválidos recebidos do cálculo seguro:",
                    calculo,
                );

                return res.status(502).json({
                    sucesso: false,
                    erro:
                        "O valor calculado do pedido é inválido.",
                });
            }

            const totalConferido =
                Math.round(
                    (
                        subtotal +
                        frete -
                        desconto +
                        Number.EPSILON
                    ) * 100,
                ) / 100;

            const totalSeguroArredondado =
                Math.round(
                    (
                        totalSeguro +
                        Number.EPSILON
                    ) * 100,
                ) / 100;

            if (
                totalConferido !==
                totalSeguroArredondado
            ) {
                console.error(
                    "Divergência no total calculado:",
                    {
                        subtotal,
                        frete,
                        desconto,
                        totalInformado:
                            totalSeguroArredondado,
                        totalConferido,
                    },
                );

                return res.status(502).json({
                    sucesso: false,
                    erro:
                        "Foi encontrada uma divergência no valor do pedido.",
                });
            }

            const pedidoId =
                gerarPedidoId();

            const response = await fetch(
                "https://api.mercadopago.com/checkout/preferences",
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        items: [
                            {
                                title: titulo,
                                quantity: 1,
                                unit_price:
                                    totalSeguroArredondado,
                                currency_id: "BRL",
                            },
                        ],
                        external_reference:
                            pedidoId,
                        payment_methods: {
                            excluded_payment_types: [
                                {
                                    id: "ticket",
                                },
                            ],
                            installments: 1,
                        },
                        expires: true,
                        expiration_date_from:
                            new Date().toISOString(),
                        expiration_date_to:
                            new Date(
                                Date.now() +
                                60 * 60 * 1000,
                            ).toISOString(),
                        back_urls: {
                            success: CARDAPIO_URL,
                            failure: CARDAPIO_URL,
                            pending: CARDAPIO_URL,
                        },
                        auto_return: "approved",
                    }),
                },
            );

            let data;

            try {
                data = await response.json();
            } catch (erro) {
                console.error(
                    "Mercado Pago retornou uma resposta inválida."
                );

                return res.status(502).json({
                    sucesso: false,
                    erro:
                        "Não foi possível gerar o pagamento.",
                });
            }

            if (
                !response.ok ||
                !data.init_point
            ) {
                console.error(
                    "Erro retornado pelo Mercado Pago:",
                    response.status,
                    data,
                );

                return res.status(502).json({
                    sucesso: false,
                    erro:
                        "Não foi possível gerar o pagamento.",
                });
            }

            return res.status(201).json({
                sucesso: true,
                link: data.init_point,
                preferenceId: data.id,
                pedidoId,

                /*
                 * Retornamos o cálculo oficial para
                 * o frontend salvar exatamente os
                 * valores usados no pagamento.
                 */
                calculo: {
                    itens: Array.isArray(calculo.itens)
                        ? calculo.itens
                        : [],
                    subtotal,
                    frete,
                    desconto,
                    total: totalSeguroArredondado,
                    cupom: calculo.cupom || "",
                },
            });
        } catch (error) {
            console.error(
                "Erro ao criar pagamento:",
                error,
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao criar pagamento.",
            });
        }
    },
);

app.get(
    "/verificar-pagamento/:pedidoId",
    limiteVerificarPagamento,
    async (req, res) => {
        try {
            const pedidoIdLimpo = String(req.params?.pedidoId || "").trim();

            if (
                !pedidoIdLimpo ||
                pedidoIdLimpo.length > 100 ||
                !/^[a-zA-Z0-9_-]+$/.test(pedidoIdLimpo)
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Identificador do pedido inválido.",
                });
            }

            if (!process.env.MP_ACCESS_TOKEN) {
                return res.status(503).json({
                    sucesso: false,
                    erro: "Consulta de pagamento temporariamente indisponível.",
                });
            }

            const url =
                "https://api.mercadopago.com/v1/payments/search" +
                `?external_reference=${encodeURIComponent(pedidoIdLimpo)}` +
                "&sort=date_created" +
                "&criteria=desc";

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(
                    "Erro do Mercado Pago ao consultar pagamento:",
                    response.status,
                    data,
                );

                return res.status(502).json({
                    sucesso: false,
                    erro: "Não foi possível consultar o pagamento.",
                });
            }

            const pagamento =
                data.results && data.results.length > 0 ? data.results[0] : null;

            if (!pagamento) {
                return res.json({
                    sucesso: true,
                    encontrado: false,
                    aprovado: false,
                    status: "not_found",
                    pedidoId: pedidoIdLimpo,
                });
            }

            return res.json({
                sucesso: true,
                encontrado: true,
                aprovado: pagamento.status === "approved",
                status: pagamento.status,
                status_detail: pagamento.status_detail || "",
                payment_id: pagamento.id,
                pedidoId: pedidoIdLimpo,
            });
        } catch (error) {
            console.error("Erro ao verificar pagamento:", error);
            return res.status(500).json({
                sucesso: false,
                erro: "Erro interno ao verificar pagamento.",
            });
        }
    },
);

app.post(
    "/pagamentos/cancelar",
    limiteCancelarPedido,
    protegerRotaAdministrativa,
    async (req, res) => {
        try {
            const pedidoId = String(
                req.body?.pedidoId || "",
            ).trim();

            const paymentId = String(
                req.body?.paymentId || "",
            ).trim();

            const tipo = String(
                req.body?.tipo || "",
            )
                .trim()
                .toLowerCase();

            const motivo = String(
                req.body?.motivo || "",
            ).trim();

            const chaveIdempotencia = String(
                req.body?.chaveIdempotencia || "",
            ).trim();

            const tiposPermitidos = [
                "total",
                "parcial",
                "sem_estorno",
            ];

            if (
                !pedidoId ||
                pedidoId.length > 100 ||
                !/^[a-zA-Z0-9_-]+$/.test(
                    pedidoId,
                )
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro:
                        "Identificador do pedido inválido.",
                });
            }

            if (
                tipo !== "sem_estorno" &&
                !paymentIdValido(paymentId)
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro:
                        "PaymentId inválido ou não informado.",
                });
            }

            if (
                !tiposPermitidos.includes(tipo)
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro:
                        "Tipo de cancelamento inválido.",
                });
            }

            if (
                !motivo ||
                motivo.length < 3 ||
                motivo.length > 500
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro:
                        "Informe um motivo válido para o cancelamento.",
                });
            }

            if (
                tipo !== "sem_estorno" &&
                (
                    !chaveIdempotencia ||
                    chaveIdempotencia.length > 100
                )
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro:
                        "Chave de idempotência não informada.",
                });
            }

            if (
                !process.env.MP_ACCESS_TOKEN
            ) {
                return res.status(503).json({
                    sucesso: false,
                    erro:
                        "Estorno temporariamente indisponível.",
                });
            }

            /*
             * Primeiro consultamos o pagamento diretamente
             * no Mercado Pago. Não confiamos apenas nos
             * dados enviados pelo Admin.
             */
            const pagamento =
                await consultarPagamentoMercadoPago(
                    paymentId,
                );

            const referenciaPagamento = String(
                pagamento.external_reference || "",
            ).trim();

            if (
                referenciaPagamento !== pedidoId
            ) {
                console.warn(
                    "Pedido e pagamento não correspondem:",
                    {
                        pedidoId,
                        paymentId,
                        referenciaPagamento,
                    },
                );

                return res.status(409).json({
                    sucesso: false,
                    erro:
                        "O pagamento informado não pertence a este pedido.",
                });
            }

            const statusPagamento = String(
                pagamento.status || "",
            )
                .trim()
                .toLowerCase();

            const valorPago =
                normalizarValorMonetario(
                    pagamento.transaction_amount,
                );

            if (
                valorPago === null ||
                valorPago <= 0
            ) {
                return res.status(409).json({
                    sucesso: false,
                    erro:
                        "O Mercado Pago retornou um valor de pagamento inválido.",
                });
            }

            /*
             * Cancelar sem estorno não chama a API
             * de reembolso.
             */
            if (tipo === "sem_estorno") {
                return res.status(200).json({
                    sucesso: true,
                    cancelado: true,
                    estornoRealizado: false,

                    pedidoId,
                    paymentId,

                    tipoEstorno:
                        "Sem estorno",

                    valorPago,
                    valorEstornado: 0,

                    motivo,

                    statusPagamento,
                    statusEstorno:
                        "Não solicitado",

                    refundId: "",
                    chaveIdempotencia: "",
                    dataCancelamento:
                        new Date().toISOString(),

                    mensagem:
                        "Cancelamento autorizado sem estorno.",
                });
            }

            /*
             * Para estornar, o pagamento precisa ter
             * sido aprovado.
             */
            if (
                statusPagamento !== "approved"
            ) {
                return res.status(409).json({
                    sucesso: false,
                    erro:
                        `O pagamento não pode ser estornado porque está com status "${statusPagamento}".`,
                    statusPagamento,
                });
            }

            const estornosAnteriores =
                await consultarEstornosMercadoPago(
                    paymentId,
                );

            const totalJaEstornado =
                normalizarValorMonetario(
                    calcularTotalJaEstornado(
                        estornosAnteriores,
                    ),
                ) || 0;

            const valorDisponivel =
                normalizarValorMonetario(
                    valorPago -
                    totalJaEstornado,
                ) || 0;

            if (valorDisponivel <= 0) {
                return res.status(409).json({
                    sucesso: false,
                    erro:
                        "Este pagamento já foi totalmente estornado.",
                    valorPago,
                    totalJaEstornado,
                    valorDisponivel,
                });
            }

            let valorSolicitado = null;

            if (tipo === "parcial") {
                valorSolicitado =
                    normalizarValorMonetario(
                        req.body?.valor,
                    );

                if (
                    valorSolicitado === null ||
                    valorSolicitado <= 0
                ) {
                    return res.status(400).json({
                        sucesso: false,
                        erro:
                            "Informe um valor válido para o estorno parcial.",
                    });
                }

                if (
                    valorSolicitado >
                    valorDisponivel
                ) {
                    return res.status(400).json({
                        sucesso: false,
                        erro:
                            "O valor solicitado ultrapassa o saldo disponível para estorno.",
                        valorPago,
                        totalJaEstornado,
                        valorDisponivel,
                    });
                }
            }

            /*
             * No estorno total, devolvemos todo o saldo
             * ainda disponível. Se não existe estorno
             * anterior, o corpo fica vazio conforme a API.
             */
            const estornoTotalSemAnterior =
                tipo === "total" &&
                totalJaEstornado === 0;

            if (
                tipo === "total" &&
                totalJaEstornado > 0
            ) {
                valorSolicitado =
                    valorDisponivel;
            }

            const corpoEstorno =
                estornoTotalSemAnterior
                    ? {}
                    : {
                        amount:
                            valorSolicitado,
                    };

            const responseEstorno =
                await fetch(
                    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
                        paymentId,
                    )}/refunds`,
                    {
                        method: "POST",
                        headers: {
                            Authorization:
                                `Bearer ${process.env.MP_ACCESS_TOKEN}`,

                            "Content-Type":
                                "application/json",

                            "X-Idempotency-Key":
                                chaveIdempotencia,
                        },

                        body:
                            JSON.stringify(
                                corpoEstorno,
                            ),
                    },
                );

            let estorno;

            try {
                estorno =
                    await responseEstorno.json();
            } catch {
                estorno = null;
            }

            if (
                !responseEstorno.ok ||
                !estorno
            ) {
                console.error(
                    "Erro do Mercado Pago ao estornar:",
                    responseEstorno.status,
                    estorno,
                );

                const mensagemMercadoPago =
                    estorno?.message ||
                    estorno?.error ||
                    estorno?.cause?.[0]
                        ?.description ||
                    "";

                return res
                    .status(
                        responseEstorno.status >= 400 &&
                            responseEstorno.status < 500
                            ? 409
                            : 502,
                    )
                    .json({
                        sucesso: false,
                        erro:
                            mensagemMercadoPago ||
                            "O Mercado Pago não autorizou o estorno.",
                        codigoMercadoPago:
                            estorno?.error || "",
                        detalhes:
                            estorno?.cause || [],
                    });
            }

            const valorEstornado =
                normalizarValorMonetario(
                    estorno.amount,
                ) ||
                valorSolicitado ||
                valorDisponivel;

            const statusEstorno = String(
                estorno.status || "",
            ).trim();

            const refundId = String(
                estorno.id || "",
            ).trim();

            return res.status(200).json({
                sucesso: true,
                cancelado: true,
                estornoRealizado: true,

                pedidoId,
                paymentId,

                tipoEstorno:
                    tipo === "total"
                        ? "Total"
                        : "Parcial",

                valorPago,
                totalJaEstornado,
                valorDisponivelAntes:
                    valorDisponivel,
                valorEstornado,

                motivo,

                statusPagamento,
                statusEstorno,
                refundId,

                chaveIdempotencia,
                dataCancelamento:
                    new Date().toISOString(),

                mensagem:
                    tipo === "total"
                        ? "Estorno total realizado com sucesso."
                        : "Estorno parcial realizado com sucesso.",
            });
        } catch (error) {
            console.error(
                "Erro ao cancelar pedido:",
                error,
            );

            return res
                .status(
                    error.statusHttp || 500,
                )
                .json({
                    sucesso: false,
                    erro:
                        error.message ||
                        "Erro interno ao cancelar o pedido.",
                });
        }
    },
);

app.get("/push/public-key", (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
        return res.status(503).json({
            sucesso: false,
            erro: "VAPID_PUBLIC_KEY não configurada.",
        });
    }

    return res.json({
        sucesso: true,
        publicKey: VAPID_PUBLIC_KEY,
    });
});

app.post(
    "/push/registrar-dispositivo",
    limiteRegistroPush,
    async (req, res) => {
        try {
            const { loja, subscription } = req.body || {};
            const lojaLimpa = String(loja || "").trim();

            if (!lojaLimpa || lojaLimpa.length > 100) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Identificação da loja inválida.",
                });
            }

            if (
                !subscription ||
                !subscription.endpoint ||
                !subscription.keys ||
                !subscription.keys.p256dh ||
                !subscription.keys.auth
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Inscrição Push inválida.",
                });
            }

            if (
                String(subscription.endpoint).length > 2000 ||
                String(subscription.keys.p256dh).length > 500 ||
                String(subscription.keys.auth).length > 500
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Dados da inscrição Push inválidos.",
                });
            }

            if (!process.env.APPS_SCRIPT_URL) {
                return res.status(503).json({
                    sucesso: false,
                    erro: "Registro Push temporariamente indisponível.",
                });
            }

            const params = new URLSearchParams({
                acao: "salvarDispositivoPush",
                loja: lojaLimpa,
                endpoint: String(subscription.endpoint),
                p256dh: String(subscription.keys.p256dh),
                auth: String(subscription.keys.auth),
                t: Date.now().toString(),
            });

            const resposta = await fetch(
                `${process.env.APPS_SCRIPT_URL}?${params.toString()}`,
            );

            const texto = await resposta.text();
            let dados;

            try {
                dados = JSON.parse(texto);
            } catch (erro) {
                console.error(
                    "Apps Script não retornou JSON válido ao registrar Push:",
                    texto.slice(0, 300),
                );

                return res.status(502).json({
                    sucesso: false,
                    erro: "Não foi possível registrar as notificações.",
                });
            }

            if (!resposta.ok || !dados?.sucesso) {
                return res.status(502).json({
                    sucesso: false,
                    erro: dados?.erro || "Não foi possível registrar as notificações.",
                });
            }

            return res.json(dados);
        } catch (error) {
            console.error("Erro ao registrar dispositivo Push:", error);
            return res.status(500).json({
                sucesso: false,
                erro: "Erro ao registrar dispositivo Push.",
            });
        }
    },
);

/*
 * Mantido por decisão do projeto para gerar novas chaves VAPID.
 * Continua protegido pela variável SENHA_GERAR_VAPID.
 */
app.get("/gerar-vapid", limiteGerarVapid, (req, res) => {
    const senhaConfigurada = String(
        process.env.SENHA_GERAR_VAPID || "",
    ).trim();
    const senhaRecebida = String(req.query?.senha || "").trim();

    if (!senhaConfigurada) {
        return res.status(503).json({
            sucesso: false,
            erro: "Geração de VAPID não configurada.",
        });
    }

    if (!senhaRecebida || senhaRecebida !== senhaConfigurada) {
        return res.status(403).json({
            sucesso: false,
            erro: "Acesso negado.",
        });
    }

    const chaves = webpush.generateVAPIDKeys();

    return res.json({
        sucesso: true,
        publicKey: chaves.publicKey,
        privateKey: chaves.privateKey,
    });
});

/*
* Mantida sem X-Admin-Key nesta etapa para não quebrar o painel atual.
* Na Parte 3, esta rota deve passar a ser chamada pelo Apps Script,
* que poderá guardar a chave administrativa sem expô-la no navegador.
*/
app.post(
    "/push/enviar",
    limiteEnvioPush,
    protegerRotaAdministrativa,
    async (req, res) => {
        try {
            const {
                titulo,
                mensagem,
                imagem,
                link,
                icone,
                filtro,
                botao,
            } = req.body || {};

            const tituloLimpo = String(titulo || "").trim();
            const mensagemLimpa = String(mensagem || "").trim();
            const filtroLimpo = String(filtro || "todos").trim();

            if (!tituloLimpo || tituloLimpo.length > 120) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Título inválido.",
                });
            }

            if (!mensagemLimpa || mensagemLimpa.length > 500) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Mensagem inválida.",
                });
            }

            if (!process.env.APPS_SCRIPT_URL) {
                return res.status(503).json({
                    sucesso: false,
                    erro: "Envio de notificações temporariamente indisponível.",
                });
            }

            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                return res.status(503).json({
                    sucesso: false,
                    erro: "Chaves VAPID não configuradas.",
                });
            }

            const resposta = await fetch(
                `${process.env.APPS_SCRIPT_URL}?acao=listarDispositivosPush&dias=${encodeURIComponent(filtroLimpo)}&t=${Date.now()}`,
            );

            const texto = await resposta.text();
            let dados;

            try {
                dados = JSON.parse(texto);
            } catch (erro) {
                console.error(
                    "Apps Script não retornou JSON válido ao listar dispositivos:",
                    texto.slice(0, 300),
                );

                return res.status(502).json({
                    sucesso: false,
                    erro: "Não foi possível carregar os dispositivos Push.",
                });
            }

            if (!resposta.ok || !dados?.sucesso) {
                return res.status(502).json({
                    sucesso: false,
                    erro: dados?.erro || "Erro ao listar dispositivos.",
                });
            }

            const payload = JSON.stringify({
                titulo: tituloLimpo,
                mensagem: mensagemLimpa,
                imagem: String(imagem || ""),
                link: String(link || CARDAPIO_URL),
                icone: String(icone || ""),
                logo: String(req.body?.logo || icone || ""),
                loja: String(req.body?.loja || ""),
                botao: botao || null,
            });

            let enviados = 0;
            let falhas = 0;

            for (const dispositivo of dados.dispositivos || []) {
                try {
                    await webpush.sendNotification(dispositivo.subscription, payload);
                    enviados++;
                } catch (erro) {
                    falhas++;

                    console.warn(
                        "Erro ao enviar Push:",
                        erro.statusCode || erro.message,
                    );

                    if (erro.statusCode === 404 || erro.statusCode === 410) {
                        try {
                            const params = new URLSearchParams({
                                acao: "desativarDispositivoPush",
                                endpoint: dispositivo.subscription.endpoint,
                            });

                            await fetch(
                                `${process.env.APPS_SCRIPT_URL}?${params.toString()}`,
                            );

                            console.log("Dispositivo marcado como INATIVO.");
                        } catch (erroApps) {
                            console.error(
                                "Erro ao desativar dispositivo:",
                                erroApps.message,
                            );
                        }
                    }
                }
            }

            return res.json({
                sucesso: true,
                total: dados.total || 0,
                enviados,
                falhas,
            });
        } catch (error) {
            console.error("Erro ao enviar notificação:", error);
            return res.status(500).json({
                sucesso: false,
                erro: "Erro ao enviar notificação.",
            });
        }
    });

app.use((req, res) => {
    return res.status(404).json({
        sucesso: false,
        erro: "Rota não encontrada.",
    });
});

app.use((erro, req, res, next) => {
    console.error("Erro não tratado:", erro);

    if (erro?.message === "Origem não autorizada pelo CORS.") {
        return res.status(403).json({
            sucesso: false,
            erro: "Origem não autorizada.",
        });
    }

    if (erro?.type === "entity.too.large") {
        return res.status(413).json({
            sucesso: false,
            erro: "Requisição muito grande.",
        });
    }

    if (erro instanceof SyntaxError && "body" in erro) {
        return res.status(400).json({
            sucesso: false,
            erro: "JSON inválido.",
        });
    }

    return res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor.",
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
