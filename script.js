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
    
            // Condição para "Monta sua Batata Intergaláctica"
            if (name === 'Monta sua Batata Intergaláctica') {
                openCustomPotatoModal(name, price);
                return;
            }
    
            // Criar ID seguro para evitar problemas com espaços/acentos
            const safeId = name.replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
            let modalContent = `<h3>${name}</h3><p>R$${price.toFixed(2)}</p>`;
    
            if (name.includes('Rosti')) {
                modalContent += `
                    <fieldset data-role="queijo">
                        <legend>Escolha o queijo *</legend>
                        <ul class="option-list">
                            <li class="option" data-value="Mussarela">Mussarela</li>
                            <li class="option" data-value="Cheddar">Cheddar</li>
                            <li class="option" data-value="Requeijão">Requeijão</li>
                            <li class="option" data-value="Cream chesse">Cream chesse</li>
                        </ul>
                    </fieldset>
                    <fieldset data-role="sabor">
                        <legend>Escolha o sabor *</legend>
                        <ul class="option-list">
                            <li class="option" data-value="Pizza" data-price="39.90">Pizza (R$39,90)</li>
                            <li class="option" data-value="Queijo mussarela" data-price="39.90">Queijo mussarela (R$39,90)</li>
                            <li class="option" data-value="Bacon" data-price="41.90">Bacon (R$41,90)</li>
                            <li class="option" data-value="Carne de panela" data-price="43.90">Carne de panela (R$43,90)</li>
                            <li class="option" data-value="Bolonhesa" data-price="41.90">Bolonhesa (R$41,90)</li>
                            <li class="option" data-value="Calabresa" data-price="42.90">Calabresa (R$42,90)</li>
                            <li class="option" data-value="Estrogonofe de Frango" data-price="43.90">Estrogonofe de Frango (R$43,90)</li>
                            <li class="option" data-value="Estrogonofe de Carne" data-price="49.90">Estrogonofe de Carne (R$49,90)</li>
                            <li class="option" data-value="Estrogonofe de Grão de Bico" data-price="36.90">Estrogonofe de Grão de Bico (R$36,90)</li>
                            <li class="option" data-value="Frango Desfiado" data-price="41.90">Frango Desfiado (R$41,90)</li>
                        </ul>
                    </fieldset>
                `;
            } else {
                modalContent += `
                    <fieldset data-role="queijo">
                        <legend>Escolha a borda *</legend>
                        <ul class="option-list">
                            <li class="option" data-value="Requeijão Cremoso">Requeijão Cremoso</li>
                            <li class="option" data-value="Cheddar">Cheddar</li>
                        </ul>
                    </fieldset>
                `;
            }
    
            modalContent += `
                <fieldset>
                    <legend>Adicionais</legend>
                    <ul class="adicionais-lista">
                        <li><input type="checkbox" id="cebola-crispy" value="Cebola Crispy" data-price="4.00"><label for="cebola-crispy">Cebola Crispy (R$4,00)</label></li>
                        <li><input type="checkbox" id="alho-crocante" value="Alho crocante" data-price="3.00"><label for="alho-crocante">Alho crocante (R$3,00)</label></li>
                        <li><input type="checkbox" id="azeitona" value="Azeitona" data-price="3.00"><label for="azeitona">Azeitona (R$3,00)</label></li>
                        <li><input type="checkbox" id="bacon" value="Bacon" data-price="7.00"><label for="bacon">Bacon (R$7,00)</label></li>
                        <li><input type="checkbox" id="cheddar" value="Cheddar" data-price="6.00"><label for="cheddar">Cheddar (R$6,00)</label></li>
                        <li><input type="checkbox" id="ervilha" value="Ervilha" data-price="2.50"><label for="ervilha">Ervilha (R$2,50)</label></li>
                        <li><input type="checkbox" id="milho" value="Milho" data-price="2.50"><label for="milho">Milho (R$2,50)</label></li>
                        <li><input type="checkbox" id="mussarela" value="Mussarela" data-price="6.00"><label for="mussarela">Mussarela (R$6,00)</label></li>
                        <li><input type="checkbox" id="presunto" value="Presunto" data-price="3.00"><label for="presunto">Presunto (R$3,00)</label></li>
                        <li><input type="checkbox" id="requeijao" value="Requeijão" data-price="6.00"><label for="requeijao">Requeijão (R$6,00)</label></li>
                        <li><input type="checkbox" id="cream-chesse" value="Cream chesse" data-price="6.00"><label for="cream-chesse">Cream chesse (R$6,00)</label></li>
                        <li><input type="checkbox" id="tomate" value="Tomate" data-price="3.00"><label for="tomate">Tomate (R$3,00)</label></li>
                        <li><input type="checkbox" id="batata-palha" value="Batata Palha" data-price="4.00"><label for="batata-palha">Batata Palha (R$4,00)</label></li>
                    </ul>
                </fieldset>
                <button id="add-${safeId}" class="add-pedido">Adicionar ao Pedido</button>
                Campos que contem * são obrigatórios
            `;
    
            modalBody.innerHTML = modalContent;
            modal.style.display = "block";
            modal.scrollTop = 0;
    
            const adicionaisCheckboxes = modalBody.querySelectorAll('.adicionais-lista input[type="checkbox"]');
    
            adicionaisCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const selectedAdicionais = Array.from(adicionaisCheckboxes).filter(cb => cb.checked);
                    if (selectedAdicionais.length > 2) {
                        checkbox.checked = false;
                        alert('Você pode selecionar no máximo 2 adicionais.');
                    }
                });
            });
    
            document.querySelectorAll('.option, .drink-option').forEach(option => {
                option.addEventListener('click', () => {
                    option.parentElement.querySelectorAll('.option, .drink-option').forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                });
            });
    
            document.getElementById(`add-${safeId}`).addEventListener('click', () => {
                const queijo = modalBody.querySelector('[data-role="queijo"] .option.selected')?.dataset.value || '';
                const saborOption = name.includes('Rosti') 
                    ? modalBody.querySelector('[data-role="sabor"] .option.selected') 
                    : null;
    
                const sabor = saborOption?.dataset.value || '';
    
                if (!queijo) {
                    alert('Por favor, selecione uma opção de queijo.');
                    return;
                }
    
                if (name.includes('Rosti') && !sabor) {
                    alert('Por favor, selecione uma opção de sabor.');
                    return;
                }
    
                const saborPrice = saborOption ? parseFloat(saborOption.dataset.price) : price;
    
                const adicionais = Array.from(modalBody.querySelectorAll('.adicionais-lista input[type="checkbox"]:checked')).map(adicional => adicional.value);
                const adicionaisPrecos = Array.from(modalBody.querySelectorAll('.adicionais-lista input[type="checkbox"]:checked')).map(adicional => parseFloat(adicional.dataset.price));
    
                const totalPrice = adicionaisPrecos.reduce((total, preco) => total + preco, saborPrice);
    
                addPedido(name, saborPrice, sabor, queijo, '', adicionais, totalPrice);
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
    };

    window.onclick = event => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    document.getElementById('cep-cliente').addEventListener('blur', async () => {
        const cep = document.getElementById('cep-cliente').value;
        await preencherEndereco(cep);
    });

    document.getElementById('confirmar-pedido').addEventListener('click', confirmarPedido);

    function openCustomPotatoModal(name, basePrice) {
        modalBody.innerHTML = `
            <h3>${name}</h3>
            <p>Monte sua batata recheada intergaláctica do tamanho da sua fome.</p>
            <fieldset>
                <legend>Escolha a Batata *</legend>
                <ul class="option-list">
                    <li class="option" data-value="Batata 300g" data-price="10.00">Batata 300g R$10,00</li>
                    <li class="option" data-value="Batata 400g" data-price="13.00">Batata 400g R$13,00</li>
                </ul>
            </fieldset>
            <fieldset>
                <legend>Escolha a Base (até 2 opções) *</legend>
                <ul class="option-list">
                    <li><input type="checkbox" id="base-mussarela" value="Queijo mussarela" data-price="6.00"><label for="base-mussarela">Queijo mussarela R$6,00</label></li>
                    <li><input type="checkbox" id="base-cheddar" value="Cheddar" data-price="6.00"><label for="base-cheddar">Cheddar R$6,00</label></li>
                    <li><input type="checkbox" id="base-requeijao" value="Requeijão" data-price="6.00"><label for="base-requeijao">Requeijão R$6,00</label></li>
                    <li><input type="checkbox" id="base-cream-chesse" value="Cream chesse" data-price="6.00"><label for="base-cream-chesse">Cream chesse R$6,00</label></li>
                    <li><input type="checkbox" id="base-sem" value="Sem base" data-price="0.00"><label for="base-sem">Sem base R$0,00</label></li>
                </ul>
            </fieldset>
            <fieldset>
            <legend>Escolha a Borda *</legend>
                <ul class="option-list">
                    <li class="option" data-value="Cheddar" data-price="6.00">Cheddar R$6,00</li>
                    <li class="option" data-value="Requeijão" data-price="6.00">Requeijão R$6,00</li>
                    <li class="option" data-value="Sem borda" data-price="0.00">Sem borda R$0,00</li>
                </ul>
            </fieldset>
            <fieldset>
                <legend>Escolha o Sabor *</legend>
                <ul class="option-list">
                    <li class="option" data-value="Frango desfiado" data-price="15.90">Frango desfiado R$15,90</li>
                    <li class="option" data-value="Bacon" data-price="15.90">Bacon R$15,90</li>
                    <li class="option" data-value="Carne de penela" data-price="17.90">Carne de panela R$17,90</li>
                    <li class="option" data-value="Calabresa" data-price="16.90">Calabresa R$16,90</li>
                    <li class="option" data-value="Pizza" data-price="12.90">Pizza R$12,90</li>
                    <li class="option" data-value="Estrogonofe de frango" data-price="17.90">Estrogonofe de frango R$17,90</li>
                    <li class="option" data-value="Estrogonofe de carne" data-price="22.90">Estrogonofe de carne R$22,90</li>
                    <li class="option" data-value="Bolonhesa" data-price="15.90">Bolonhesa R$15,90</li>
                    <li class="option" data-value="Estrogonofe de grão de bico" data-price="12.90">Estrogonofe de grão de bico R$12,90</li>
                    <li class="option" data-value="Queijo" data-price="12.90">Queijo R$12,90</li>
                </ul>
            </fieldset>
            <fieldset>
                <legend>Adicionais (até 2 opções)</legend>
                <ul class="option-list">
                    <li><input type="checkbox" id="cebola-crispy" value="Cebola Crispy" data-price="4.00"><label for="cebola-crispy">Cebola Crispy (R$4,00)</label></li>
                    <li><input type="checkbox" id="alho-crocante" value="Alho crocante" data-price="3.00"><label for="alho-crocante">Alho crocante (R$3,00)</label></li>
                    <li><input type="checkbox" id="azeitona" value="Azeitona" data-price="3.00"><label for="azeitona">Azeitona (R$3,00)</label></li>
                    <li><input type="checkbox" id="bacon" value="Bacon" data-price="7.00"><label for="bacon">Bacon (R$7,00)</label></li>
                    <li><input type="checkbox" id="cheddar" value="Cheddar" data-price="6.00"><label for="cheddar">Cheddar (R$6,00)</label></li>
                    <li><input type="checkbox" id="ervilha" value="Ervilha" data-price="2.50"><label for="ervilha">Ervilha (R$2,50)</label></li>
                    <li><input type="checkbox" id="milho" value="Milho" data-price="2.50"><label for="milho">Milho (R$2,50)</label></li>
                    <li><input type="checkbox" id="mussarela" value="Mussarela" data-price="6.00"><label for="mussarela">Mussarela (R$6,00)</label></li>
                    <li><input type="checkbox" id="presunto" value="Presunto" data-price="3.00"><label for="presunto">Presunto (R$3,00)</label></li>
                    <li><input type="checkbox" id="requeijao" value="Requeijão" data-price="6.00"><label for="requeijao">Requeijão (R$6,00)</label></li>
                    <li><input type="checkbox" id="tomate" value="Tomate" data-price="3.00"><label for="tomate">Tomate (R$3,00)</label></li>
                    <li><input type="checkbox" id="batata-palha" value="Batata Palha" data-price="4.00"><label for="batata-palha">Batata Palha (R$4,00)</label></li>
                </ul>
            </fieldset>
            <button id="add-custom-potato" class="add-pedido">Adicionar ao Pedido</button>
            Campos que contem * são obrigatórios
        `;
        modal.style.display = "block";
    
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', () => {
                option.parentElement.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
    
        document.querySelectorAll('fieldset:nth-of-type(2) input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                const checkedInputs = document.querySelectorAll('fieldset:nth-of-type(2) input[type="checkbox"]:checked');
                if (checkedInputs.length > 2) {
                    alert('Você só pode escolher até 2 opções de base.');
                    input.checked = false;
                }
            });
        });
    
        document.querySelectorAll('fieldset:nth-of-type(5) input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', () => {
                const checkedInputs = document.querySelectorAll('fieldset:nth-of-type(5) input[type="checkbox"]:checked');
                if (checkedInputs.length > 2) {
                    alert('Você só pode escolher até 2 opções de adicionais.');
                    input.checked = false;
                }
            });
        });
    
        document.getElementById('add-custom-potato').addEventListener('click', () => {
            const batata = modalBody.querySelector('fieldset:nth-of-type(1) .option.selected');
            const baseInputs = Array.from(modalBody.querySelectorAll('fieldset:nth-of-type(2) input[type="checkbox"]:checked'));
            const borda = modalBody.querySelector('fieldset:nth-of-type(3) .option.selected');
            const sabor = modalBody.querySelector('fieldset:nth-of-type(4) .option.selected');
            const adicionaisInputs = Array.from(modalBody.querySelectorAll('fieldset:nth-of-type(5) input[type="checkbox"]:checked'));
    
            if (!batata || baseInputs.length === 0 || baseInputs.length > 2 || !borda || !sabor) {
                alert('Por favor, preencha todas as opções obrigatórias corretamente.');
                return;
            }
    
            const basePrice = baseInputs.reduce((total, input) => total + parseFloat(input.dataset.price), 0);
            const adicionaisPrice = adicionaisInputs.reduce((total, input) => total + parseFloat(input.dataset.price), 0);
    
            const totalPrice = basePrice +
                parseFloat(batata.dataset.price) +
                parseFloat(borda.dataset.price) +
                parseFloat(sabor.dataset.price) +
                adicionaisPrice;
    
            const baseList = baseInputs.map(input => input.value);
            const adicionaisList = adicionaisInputs.map(input => input.value);
    
            addPedido(name, totalPrice, sabor.textContent, '', '', adicionaisList, totalPrice, {
                batata: batata.dataset.value,
                base: baseList.join(', '),
                borda: borda.dataset.value
            });
            modal.style.display = "none";
        });
    }
});    

function addPedido(name, price, sabor, queijo, bebida, adicionais, totalPrice, customOptions = {}) {
    const pedido = {
        name,
        price,
        sabor: sabor || '',
        queijo: queijo || '',
        adicionais: adicionais.length ? adicionais.join(', ') : '',
        bebida: bebida || '',
        totalPrice: totalPrice.toFixed(2),
        ...customOptions
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

        const isRosti = pedido.name.includes('Rosti');

        if (pedido.name === 'Monta sua Batata Intergaláctica') {
            item.innerHTML = `<h4>${pedido.name} - R$${pedido.totalPrice}</h4>`;
            item.innerHTML += `<p>Batata: ${pedido.batata || 'Não especificado'}</p>`;
            item.innerHTML += `<p>Base: ${pedido.base || 'Não especificado'}</p>`;
            item.innerHTML += `<p>Borda: ${pedido.borda || 'Não especificado'}</p>`;
            item.innerHTML += `<p>Sabor: ${pedido.sabor || 'Não especificado'}</p>`;
            if (pedido.adicionais) {
                item.innerHTML += `<p>Adicionais: ${pedido.adicionais}</p>`;
            }
        } else {
            item.innerHTML = `<h4>${pedido.name} - R$${pedido.totalPrice}</h4>`;
            if (pedido.sabor) {
                item.innerHTML += `<p>Sabor: ${pedido.sabor}</p>`;
            }
            if (pedido.queijo) {
                const label = isRosti ? 'Queijo' : 'Borda';
                item.innerHTML += `<p>${label}: ${pedido.queijo}</p>`;
            }
            if (pedido.adicionais) {
                item.innerHTML += `<p>Adicionais: ${pedido.adicionais}</p>`;
            }
            if (pedido.bebida) {
                item.innerHTML += `<p>Bebida: ${pedido.bebida}</p>`;
            }
        }

        item.innerHTML += `<button class="excluir-item" data-index="${index}">Excluir</button>`;
        pedidoItens.appendChild(item);
    });

    document.getElementById('total-pedido').textContent = `Total: R$${totalGeral.toFixed(2)}`;

    // Exibir endereço salvo no rascunho
    const endereco = JSON.parse(localStorage.getItem('endereco'));
    const enderecoResumo = document.getElementById('endereco-resumo');
    if (endereco && enderecoResumo) {
        enderecoResumo.innerHTML = `
            <h4>Endereço de Entrega:</h4>
            <p>${endereco.nome}</p>
            <p>${endereco.rua}, ${endereco.numero}${endereco.complemento ? ' - ' + endereco.complemento : ''}</p>
            <p>${endereco.bairro} - ${endereco.cidade}</p>
            <p>CEP: ${endereco.cep}</p>
        `;
    }

    document.querySelectorAll('.excluir-item').forEach(button => {
        button.addEventListener('click', (event) => {
            const index = event.target.getAttribute('data-index');
            excluirPedido(index);
        });
    });
}

function confirmarPedido() {
    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    const endereco = JSON.parse(localStorage.getItem('endereco'));

    if (pedidos.length === 0) {
        alert('Por favor, adicione ao menos um prato ao pedido.');
        return;
    }

    if (!endereco || !endereco.nome || !endereco.rua || !endereco.numero || !endereco.bairro || !endereco.cidade) {
        alert('Por favor, adicione um endereço válido antes de confirmar o pedido.');
        return;
    }

    let mensagem = 'Gostaria de realizar meu pedido!\n\n';

    pedidos.forEach(pedido => {
        const isRosti = pedido.name.includes('Rosti');

        if (pedido.name === 'Monta sua Batata Intergaláctica') {
            mensagem += `Monta sua Batata Intergaláctica - R$${pedido.totalPrice}\n`;
            mensagem += `Batata: ${pedido.batata || 'Não especificado'}\n`;
            mensagem += `Base: ${pedido.base || 'Não especificado'}\n`;
            mensagem += `Borda: ${pedido.borda || 'Não especificado'}\n`;
            mensagem += `Sabor: ${pedido.sabor || 'Não especificado'}\n`;
            mensagem += `Adicionais: ${pedido.adicionais || 'Nenhum'}\n\n`;
        } else {
            mensagem += `1x ${pedido.name} - R$${pedido.totalPrice}\n`;
            if (pedido.sabor) mensagem += `    Sabor: ${pedido.sabor}\n`;
            if (pedido.queijo) {
                const label = isRosti ? 'Queijo' : 'Borda';
                mensagem += `    ${label}: ${pedido.queijo}\n`;
            }
            if (pedido.adicionais) mensagem += `    Adicionais: ${pedido.adicionais}\n`;
            if (pedido.bebida) mensagem += `    Bebida: ${pedido.bebida}\n`;
            mensagem += '\n';
        }
    });

    const totalGeral = document.getElementById('total-pedido').textContent;
    mensagem += `${totalGeral}\n\n`;

    mensagem += `Endereço de entrega:\n`;
    mensagem += `${endereco.nome}\n`;
    mensagem += `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ' - ' + endereco.complemento : ''}\n`;
    mensagem += `${endereco.bairro} - ${endereco.cidade}\n`;
    mensagem += `CEP: ${endereco.cep}`;

    const telefone = '48991354876';
    const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

function excluirPedido(index) {
    const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    pedidos.splice(index, 1);
    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    atualizarResumoPedido();
}

// Mantém o endereço salvo mesmo após recarregar ou adicionar produtos
function salvarEndereco() {
    const endereco = {
        nome: document.getElementById('nome-cliente').value.trim(),
        cep: document.getElementById('cep-cliente').value.trim(),
        rua: document.getElementById('rua-cliente').value.trim(),
        numero: document.getElementById('numero-cliente').value.trim(),
        complemento: document.getElementById('complemento-cliente').value.trim(),
        bairro: document.getElementById('bairro-cliente').value.trim(),
        cidade: document.getElementById('cidade-cliente').value.trim()
    };

    if (!endereco.nome || !endereco.cep || !endereco.rua || !endereco.numero || !endereco.bairro || !endereco.cidade) {
        alert('Por favor, preencha todos os campos obrigatórios do endereço.');
        return;
    }

    localStorage.setItem('endereco', JSON.stringify(endereco));
    alert('Endereço adicionado com sucesso!');
    atualizarResumoPedido();
}

function preencherEndereco(cep) {
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => response.json())
        .then(data => {
            if (data.erro) {
                alert('CEP não encontrado!');
                return;
            }

            document.getElementById('rua-cliente').value = data.logradouro || '';
            document.getElementById('bairro-cliente').value = data.bairro || '';
            document.getElementById('cidade-cliente').value = data.localidade || '';
        })
        .catch(error => {
            console.error('Erro ao buscar o CEP:', error);
            alert('Erro ao buscar o CEP. Tente novamente.');
        });
}

document.getElementById('adicionar-endereco').addEventListener('click', (e) => {
    e.preventDefault();
    salvarEndereco();
});

document.getElementById('cep-cliente').addEventListener('blur', (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
        preencherEndereco(cep);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const endereco = JSON.parse(localStorage.getItem('endereco'));
    if (endereco) {
        document.getElementById('nome-cliente').value = endereco.nome || '';
        document.getElementById('cep-cliente').value = endereco.cep || '';
        document.getElementById('rua-cliente').value = endereco.rua || '';
        document.getElementById('numero-cliente').value = endereco.numero || '';
        document.getElementById('complemento-cliente').value = endereco.complemento || '';
        document.getElementById('bairro-cliente').value = endereco.bairro || '';
        document.getElementById('cidade-cliente').value = endereco.cidade || '';
    }
    atualizarResumoPedido();
});