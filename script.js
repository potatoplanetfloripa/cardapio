document.addEventListener('DOMContentLoaded', () => {
    const adicionarEnderecoBtn = document.getElementById('adicionar-endereco');
    const cepCliente = document.getElementById('cep-cliente');
    const nomeCliente = document.getElementById('nome-cliente');
    const ruaCliente = document.getElementById('rua-cliente');
    const numeroCliente = document.getElementById('numero-cliente');
    const complementoCliente = document.getElementById('complemento-cliente');
    const bairroCliente = document.getElementById('bairro-cliente');
    const cidadeCliente = document.getElementById('cidade-cliente');
    const pedidoItens = document.getElementById('pedido-itens');

    const bloquearCamposEndereco = () => {
        nomeCliente.disabled = true;
        cepCliente.disabled = true;
        ruaCliente.disabled = true;
        numeroCliente.disabled = true;
        complementoCliente.disabled = true;
        bairroCliente.disabled = true;
        cidadeCliente.disabled = true;
        adicionarEnderecoBtn.disabled = true;
    };

    const liberarCamposEndereco = () => {
        nomeCliente.disabled = false;
        cepCliente.disabled = false;
        ruaCliente.disabled = false;
        numeroCliente.disabled = false;
        complementoCliente.disabled = false;
        bairroCliente.disabled = false;
        cidadeCliente.disabled = false;
        adicionarEnderecoBtn.disabled = false;
    };

    adicionarEnderecoBtn.addEventListener('click', () => {
        if (nomeCliente.value && cepCliente.value && ruaCliente.value && numeroCliente.value && bairroCliente.value && cidadeCliente.value) {
            const enderecoResumo = document.createElement('div');
            enderecoResumo.className = 'endereco-item';
            enderecoResumo.innerHTML = `
                <h4>Endereço de Entrega</h4>
                <p>${nomeCliente.value}</p>
                <p>${ruaCliente.value}, ${numeroCliente.value}</p>
                <p>${complementoCliente.value ? complementoCliente.value + ', ' : ''}${bairroCliente.value}, ${cidadeCliente.value}</p>
                <button class="excluir-endereco">Excluir Endereço</button>
            `;
            pedidoItens.appendChild(enderecoResumo);

            bloquearCamposEndereco();

            enderecoResumo.querySelector('.excluir-endereco').addEventListener('click', () => {
                enderecoResumo.remove();
                liberarCamposEndereco();
            });
        } else {
            alert('Por favor, preencha todos os campos obrigatórios do endereço.');
        }
    });

    const dishes = document.querySelectorAll('.dish');
    const drinks = document.querySelectorAll('.drink');
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const closeModal = document.querySelector('.close');

    dishes.forEach(dish => {
        dish.addEventListener('click', () => {
            const name = dish.getAttribute('data-name');
            const price = parseFloat(dish.getAttribute('data-price'));
            let modalContent = `<h3>${name}</h3><p>R$${price.toFixed(2)}</p>`;
            
            if (name.includes('Rosti')) {
                modalContent += `
                    <fieldset>
                        <legend>Escolha o queijo</legend>
                        <ul class="option-list">
                            <li class="option" data-value="Mussarela">Mussarela</li>
                            <li class="option" data-value="Cheddar">Cheddar</li>
                            <li class="option" data-value="Requeijão">Requeijão</li>
                        </ul>
                    </fieldset>
                    <fieldset>
                        <legend>Escolha o sabor</legend>
                        <ul class="option-list">
                            <li class="option" data-value="Bacon">Bacon (R$34,90)</li>
                            <li class="option" data-value="Bolonhesa">Bolonhesa (R$34,90)</li>
                            <li class="option" data-value="Calabresa">Calabresa (R$35,90)</li>
                            <li class="option" data-value="Estrogonofe de Frango">Estrogonofe de Frango (R$35,90)</li>
                            <li class="option" data-value="Estrogonofe de Grão de Bico">Estrogonofe de Grão de Bico (R$29,90)</li>
                            <li class="option" data-value="Frango Desfiado">Frango Desfiado (R$34,90)</li>
                        </ul>
                    </fieldset>
                `;
            } else {
                modalContent += `
                    <fieldset>
                        <legend>Escolha o queijo</legend>
                        <ul class="option-list">
                            <li class="option" data-value="Requeijão Cremoso">Requeijão Cremoso</li>
                            <li class="option" data-value="Cheddar">Cheddar</li>
                        </ul>
                    </fieldset>
                `;
            }

            modalContent += `
                <fieldset>
                    <legend>Adicionais (opcional)</legend>
                    <ul class="adicionais-lista">
                        <li><input type="checkbox" id="alho-crocante" value="Alho crocante" data-price="1.00"><label for="alho-crocante">Alho crocante (R$1,00)</label></li>
                        <li><input type="checkbox" id="azeitona" value="Azeitona" data-price="1.50"><label for="azeitona">Azeitona (R$1,50)</label></li>
                        <li><input type="checkbox" id="bacon" value="Bacon" data-price="5.00"><label for="bacon">Bacon (R$5,00)</label></li>
                        <li><input type="checkbox" id="cheddar" value="Cheddar" data-price="3.00"><label for="cheddar">Cheddar (R$3,00)</label></li>
                        <li><input type="checkbox" id="ervilha" value="Ervilha" data-price="1.50"><label for="ervilha">Ervilha (R$1,50)</label></li>
                        <li><input type="checkbox" id="milho" value="Milho" data-price="1.50"><label for="milho">Milho (R$1,50)</label></li>
                        <li><input type="checkbox" id="mussarela" value="Mussarela" data-price="3.00"><label for="mussarela">Mussarela (R$3,00)</label></li>
                        <li><input type="checkbox" id="presunto" value="Presunto" data-price="2.00"><label for="presunto">Presunto (R$2,00)</label></li>
                        <li><input type="checkbox" id="requeijao" value="Requeijão" data-price="3.00"><label for="requeijao">Requeijão (R$3,00)</label></li>
                        <li><input type="checkbox" id="tomate" value="Tomate" data-price="1.00"><label for="tomate">Tomate (R$1,00)</label></li>
                        <li><input type="checkbox" id="batata-palha" value="Batata Palha" data-price="2.00"><label for="batata-palha">Batata Palha (R$2,00)</label></li>
                    </ul>
                </fieldset>
                <button id="add-${name}" class="add-pedido">Adicionar ao Pedido</button>
            `;

            modalBody.innerHTML = modalContent;
            modal.style.display = "block";
            modal.scrollTop = 0; // Garantir que o scroll comece do topo

            document.querySelectorAll('.option, .drink-option').forEach(option => {
                option.addEventListener('click', () => {
                    option.parentElement.querySelectorAll('.option, .drink-option').forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                });
            });

            document.getElementById(`add-${name}`).addEventListener('click', () => {
                const queijo = modalBody.querySelector('fieldset:nth-of-type(1) .option.selected')?.dataset.value || '';
                const sabor = name.includes('Rosti') ? modalBody.querySelector('fieldset:nth-of-type(2) .option.selected')?.dataset.value : '';

                if (!queijo) {
                    alert('Por favor, selecione uma opção de queijo.');
                    return;
                }

                if (name.includes('Rosti') && !sabor) {
                    alert('Por favor, selecione uma opção de sabor.');
                    return;
                }

                const adicionais = Array.from(modalBody.querySelectorAll('.adicionais-lista input[type="checkbox"]:checked')).map(adicional => adicional.value);

                const adicionaisPrecos = Array.from(modalBody.querySelectorAll('.adicionais-lista input[type="checkbox"]:checked')).map(adicional => parseFloat(adicional.dataset.price));

                const totalPrice = adicionaisPrecos.reduce((total, preco) => total + preco, price);

                addPedido(name, price, sabor, queijo, '', adicionais, totalPrice);
                modal.style.display = "none";
            });
        });
    });

    drinks.forEach(drink => {
        const addButton = drink.querySelector('.add-drink');
        addButton.addEventListener('click', () => {
            const name = drink.getAttribute('data-name');
            const price = parseFloat(drink.getAttribute('data-price'));

            addPedido(name, price, '', '', name, [], price);
        });
    });

    closeModal.onclick = () => {
        modal.style.display = "none";
    }

    window.onclick = event => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    document.getElementById('cep-cliente').addEventListener('blur', async () => {
        const cep = document.getElementById('cep-cliente').value;
        await preencherEndereco(cep);
    });

    document.getElementById('confirmar-pedido').addEventListener('click', confirmarPedido);
});

function addPedido(name, price, sabor, queijo, bebida, adicionais, totalPrice) {
    const pedido = {
        name,
        price,
        sabor: sabor || '',
        queijo: queijo || '',
        adicionais: adicionais.length ? adicionais.join(', ') : '',
        bebida: bebida || '',
        totalPrice: totalPrice.toFixed(2)
    };

    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    pedidos.push(pedido);
    localStorage.setItem('pedidos', JSON.stringify(pedidos));

    atualizarResumoPedido();
}

function atualizarResumoPedido() {
    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    const pedidoItens = document.getElementById('pedido-itens');
    pedidoItens.innerHTML = '';

    let totalGeral = 0;

    pedidos.forEach((pedido, index) => {
        totalGeral += parseFloat(pedido.totalPrice);

        const item = document.createElement('div');
        item.className = 'pedido-item';
        item.innerHTML = `<h4>${pedido.name} - R$${pedido.totalPrice}</h4>`;
        
        if (pedido.sabor) {
            item.innerHTML += `<p>Sabor: ${pedido.sabor}</p>`;
        }
        if (pedido.queijo) {
            item.innerHTML += `<p>Queijo: ${pedido.queijo}</p>`;
        }
        if (pedido.adicionais) {
            item.innerHTML += `<p>Adicionais: ${pedido.adicionais}</p>`;
        }
        if (pedido.bebida) {
            item.innerHTML += `<p>Bebida: ${pedido.bebida}</p>`;
        }
        
        item.innerHTML += `<button class="excluir-item" data-index="${index}">Excluir</button>`;
        pedidoItens.appendChild(item);
    });

    document.getElementById('total-pedido').textContent = `Total: R$${totalGeral.toFixed(2)}`;

    document.querySelectorAll('.excluir-item').forEach(button => {
        button.addEventListener('click', (event) => {
            const index = event.target.getAttribute('data-index');
            excluirPedido(index);
        });
    });
}

function excluirPedido(index) {
    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    pedidos.splice(index, 1);
    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    atualizarResumoPedido();
}

function confirmarPedido() {
    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    if (pedidos.length === 0 || pedidos.every(pedido => !pedido.name.includes('Batata'))) {
        alert('Por favor, adicione ao menos um prato ao pedido.');
        return;
    }

    const nome = document.getElementById('nome-cliente').value;
    const rua = document.getElementById('rua-cliente').value;
    const numero = document.getElementById('numero-cliente').value;
    const complemento = document.getElementById('complemento-cliente').value;
    const bairro = document.getElementById('bairro-cliente').value;
    const cidade = document.getElementById('cidade-cliente').value;

    if (!nome || !rua || !numero || !bairro || !cidade) {
        alert('Por favor, preencha todos os campos obrigatórios do endereço.');
        return;
    }

    let mensagem = 'Gostaria de realizar meu pedido!\n\n';

    pedidos.forEach(pedido => {
        mensagem += `1x ${pedido.name}\n`;
        if (pedido.sabor) {
            mensagem += `    Sabor: ${pedido.sabor}\n`;
        }
        if (pedido.queijo) {
            mensagem += `    Queijo: ${pedido.queijo}\n`;
        }
        if (pedido.adicionais) {
            mensagem += `    Adicionais: ${pedido.adicionais}\n`;
        }
        if (pedido.bebida) {
            mensagem += `    Bebida: ${pedido.bebida}\n`;
        }
        mensagem += `    Total: R$${pedido.totalPrice}\n\n`;
    });

    const totalGeral = document.getElementById('total-pedido').textContent;
    mensagem += `${totalGeral}\n\n`;

    mensagem += `Endereço de Entrega:\n`;
    mensagem += `Nome: ${nome}\n`;
    mensagem += `Rua: ${rua}, Número: ${numero}\n`;
    if (complemento) mensagem += `Complemento: ${complemento}\n`;
    mensagem += `Bairro: ${bairro}\n`;
    mensagem += `Cidade: ${cidade}\n`;

    const telefone = '48991354876';
    const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

async function preencherEndereco(cep) {
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
            alert('CEP inválido');
            return '';
        }
        document.getElementById('rua-cliente').value = data.logradouro;
        document.getElementById('bairro-cliente').value = data.bairro;
        document.getElementById('cidade-cliente').value = data.localidade;
    } catch (error) {
        console.error('Erro ao buscar o CEP:', error);
    }
}
