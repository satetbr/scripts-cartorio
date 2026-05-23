// ==UserScript==
// @name         SISTEMA INTEGRADO E-PROTOCOLO 2.0
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  
// @author       Matheus Filipe
// @match        https://protocolo.registrocivil.org.br/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const estadoPedidos = new Map();
    const filaSniper = new Set();
    let processandoFila = false;
    let observer;
    const CNS_FIXO = 'PREENCHA SEU CNS AQUI';


    const style = document.createElement('style');
    style.innerHTML = `
        #sirc-manager { position: fixed; top: 10px; left: 10px; z-index: 10000; background: #1a252f; color: white; border-radius: 8px; border: 1px solid #3abbc6; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5); width: 220px; transition: 0.3s; overflow: hidden; }
        #sirc-header { background: #3abbc6; padding: 10px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: center; }
        #sirc-body { padding: 15px; }
        .sirc-btn-batch { background: #3abbc6; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 8px; font-size: 11px; }
        .sirc-btn-batch:hover { background: #2a9ba5; }
        .sirc-btn-new { background: #e67e22; } .sirc-btn-more { background: #808080; } .sirc-btn-returned { background: #c0392b; }
        .sirc-counter-box { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; color: #bdc3c7; border-bottom: 1px solid #2c3e50; padding-bottom: 5px; }
        #loading-status { color: #f1c40f; font-weight: bold; display: none; font-size: 12px; text-align: center; margin-top: 5px; }
        .minimized { width: 150px !important; } .minimized #sirc-body { display: none; }

        .crc-tags-container { display: inline-flex; align-items: center; gap: 5px; margin-left: 15px; }
        .tags-wrapper { display: inline-flex; gap: 4px; }
        .badge-crc { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .badge-type { background: #8e44ad; } .badge-cat { background: #e67e22; } .badge-srv { background: #16a085; } .badge-loading { background: #7f8c8d; }
        .btn-anexo-rapido { color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; background: #2980b9; transition: 0.2s;}
        .btn-anexo-rapido:hover { filter: brightness(1.1); transform: scale(1.05); }
    `;
    document.head.appendChild(style);

    const manager = document.createElement('div');
    manager.id = 'sirc-manager';
    manager.innerHTML = `
        <div id="sirc-header">GERENCIADOR ➖</div>
        <div id="sirc-body">
            <div class="sirc-counter-box"><span>Novos:</span><span id="new-count">0</span></div>
            <div class="sirc-counter-box"><span>Devolvidos:</span><span id="returned-count">0</span></div>
            <div class="sirc-counter-box"><span>Total carregado:</span><span id="total-count">0</span></div>
            <div id="loading-status">CARREGANDO...</div>
            <button id="btn-load-all" class="sirc-btn-batch sirc-btn-more">CARREGAR TODOS</button>
            <button id="btn-open-new" class="sirc-btn-batch sirc-btn-new">ABRIR NOVOS</button>
            <button id="btn-open-returned" class="sirc-btn-batch sirc-btn-returned">ABRIR DEVOLVIDOS</button>
            <button id="btn-open-visible" class="sirc-btn-batch">ABRIR TODOS</button>
        </div>
    `;
    document.body.appendChild(manager);
    document.getElementById('sirc-header').onclick = () => { document.getElementById('sirc-manager').classList.toggle('minimized'); };

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const url = args[0] || "";
        const res = await originalFetch(...args);
        const clone = res.clone();

        clone.json().then(data => {
            if (typeof url === 'string' && url.includes('/api/requirement/all/')) {
                if (url.includes('/all/1/')) estadoPedidos.clear();
                if (data && data.data && Array.isArray(data.data)) {
                    data.data.forEach(pedido => {
                        const existente = estadoPedidos.get(String(pedido.id));
                        if (existente && existente.detalhesSniper) {
                            pedido.detalhesSniper = existente.detalhesSniper;
                        }
                        estadoPedidos.set(String(pedido.id), pedido);
                    });
                    atualizarContadores();
                    window.dispatchEvent(new Event('crc-dados-atualizados'));
                }
            }
        }).catch(() => {});
        return res;
    };

    function atualizarContadores() {
        document.getElementById('total-count').innerText = estadoPedidos.size;
        document.getElementById('new-count').innerText = Array.from(estadoPedidos.values()).filter(p => p.viewed_responsible_notary_at === null).length;
        document.getElementById('returned-count').innerText = Array.from(estadoPedidos.values()).filter(p => p.status && p.status.id === 'devolved').length;
    }

    function renderizarInterface() {
        const xpath = "//div[strong[contains(text(), 'Número do Protocolo:')]]";
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        for (let i = 0; i < result.snapshotLength; i++) {
            const div = result.snapshotItem(i);
            const match = div.textContent.match(/Número do Protocolo:\s*(\d+)/);

            if (match && match[1]) {
                const idPedido = match[1];
                const pedido = estadoPedidos.get(idPedido);

                if (pedido && pedido.hash) {
                    if (!div.querySelector('.btn-liberado')) {
                        const link = document.createElement('a');
                        link.className = "btn-liberado";
                        link.target = "_blank";
                        link.style.cssText = "color: #3abbc6; font-weight: bold; margin-left: 8px; text-decoration: none; font-size: 13px; cursor: pointer;";
                        link.innerHTML = " 🔗 [ABRIR]";
                        link.href = `https://protocolo.registrocivil.org.br/requerimento/detalhe/${pedido.hash}`;
                        div.appendChild(link);
                    }

                    let container = div.querySelector('.crc-tags-container');
                    if (!container) {
                        container = document.createElement('span');
                        container.className = "crc-tags-container";
                        const tagsDiv = document.createElement('span');
                        tagsDiv.className = 'tags-wrapper';
                        const btnAnexo = document.createElement('button');
                        btnAnexo.innerText = "📂 ANEXOS";
                        btnAnexo.className = "btn-anexo-rapido";
                        btnAnexo.onclick = (e) => { e.preventDefault(); e.stopPropagation(); baixarAnexos(pedido.hash, btnAnexo); };

                        container.appendChild(tagsDiv);
                        container.appendChild(btnAnexo);
                        div.appendChild(container);
                    }

                    const tagsDiv = container.querySelector('.tags-wrapper');

                    if (pedido.detalhesSniper) {
                        if (tagsDiv.dataset.renderizado !== "true") {
                            let html = '';
                            if (pedido.detalhesSniper.tipo) html += `<span class="badge-crc badge-type">${formatarNome(pedido.detalhesSniper.tipo)}</span>`;
                            if (pedido.detalhesSniper.cat) html += `<span class="badge-crc badge-cat">${formatarNome(pedido.detalhesSniper.cat)}</span>`;
                            if (pedido.detalhesSniper.serv) html += `<span class="badge-crc badge-srv">${formatarNome(pedido.detalhesSniper.serv)}</span>`;
                            tagsDiv.innerHTML = html;
                            tagsDiv.dataset.renderizado = "true";
                        }
                    } else {
                        tagsDiv.innerHTML = `<span class="badge-crc badge-loading">⏳ PROCESSANDO...</span>`;
                        tagsDiv.dataset.renderizado = "false";
                        if (!pedido.sniperEnfileirado) {
                            pedido.sniperEnfileirado = true;
                            filaSniper.add(idPedido);
                            processarFilaSniper();
                        }
                    }
                }
            }
        }
    }

    let timeoutRender;
    observer = new MutationObserver(() => {
        clearTimeout(timeoutRender);
        timeoutRender = setTimeout(renderizarInterface, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('crc-dados-atualizados', renderizarInterface);

    async function processarFilaSniper() {
        if (processandoFila || filaSniper.size === 0) return;
        processandoFila = true;

        for (let idPedido of filaSniper) {
            filaSniper.delete(idPedido);
            const pedido = estadoPedidos.get(idPedido);
            if (pedido && !pedido.detalhesSniper) {
                await extrairTags(pedido);
                await new Promise(r => setTimeout(r, 150));
            }
        }
        processandoFila = false;
    }

    async function extrairTags(pedido) {
        const controller = new AbortController();
        let tipo, cat, serv;
        try {
            const response = await fetch(`https://protocolo.registrocivil.org.br/api/requirement/details/${pedido.hash}/${CNS_FIXO}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                body: JSON.stringify({ "profile": "notary" }), credentials: 'include', signal: controller.signal
            });
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8", { fatal: false });
            let textData = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                textData += decoder.decode(value, { stream: true });
                if (!tipo) { const m = textData.match(/"record_type":"([^"]+)"/); if(m) tipo = m[1]; }
                if (!cat) { const m = textData.match(/"category":"([^"]+)"/); if(m) cat = m[1]; }
                if (!serv) { const m = textData.match(/"service_type":"([^"]+)"/); if(m) serv = m[1]; }

                if (textData.includes('"files":[') || (tipo && cat && serv)) {
                    controller.abort(); break;
                }
            }
        } catch (err) {}
        finally {
            pedido.detalhesSniper = { tipo, cat, serv };
            renderizarInterface();
        }
    }

    function formatarNome(str) {
        if (!str || str === 'null') return null;
        const map = {
            'nascimento': 'Nascimento', 'casamento': 'Casamento', 'obito': 'Óbito', 'livro-e': 'Livro E',
            'casamento-alteracao-de-estado-civil': 'Alt. Est. Civil', 'casamento-retificacao': 'Retificação',
            'casamento-habilitacao-de-casamento': 'Habilitação', 'casamento-certidao': 'Certidão',
            'casamento-lavratura-de-registro-de-casamento': 'Lavratura',
            'casamento-certidao-inteiro-teor': 'Inteiro Teor', 'casamento-certidao-certidao-gratuita': 'Gratuita',
            'casamento-certidao-certidao-por-quesitos': 'Por Quesitos',
            'nascimento-certidao-inteiro-teor': 'Inteiro Teor', 'obito-certidao-inteiro-teor': 'Inteiro Teor'
        };
        if (map[str]) return map[str];
        return str.split('-').pop().toUpperCase();
    }

    async function baixarAnexos(hash, btnElement) {
        if (btnElement.innerText.includes("⏳")) return;
        const txtOriginal = btnElement.innerText;
        btnElement.innerText = "⏳ BAIXANDO...";
        btnElement.style.background = "#e67e22";

        try {
            const response = await fetch(`https://protocolo.registrocivil.org.br/api/requirement/details/${hash}/${CNS_FIXO}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                body: JSON.stringify({ "profile": "notary" }),
                credentials: 'include'
            });

            if (!response.ok) throw new Error("Erro API");
            const json = await response.json();

            if (json.files && Array.isArray(json.files) && json.files.length > 0) {
                let abertos = 0;
                json.files.forEach((file, index) => {
                    if (file.buffer && file.buffer.data) {
                        const byteArray = new Uint8Array(file.buffer.data);
                        let mimeType = 'application/pdf';
                        if (byteArray[0] === 255 && byteArray[1] === 216) mimeType = 'image/jpeg';
                        else if (byteArray[0] === 137 && byteArray[1] === 80) mimeType = 'image/png';

                        const blob = new Blob([byteArray], { type: mimeType });
                        const blobUrl = URL.createObjectURL(blob);

                        setTimeout(() => { window.open(blobUrl, '_blank'); }, index * 200);
                        abertos++;

                        setTimeout(() => { URL.revokeObjectURL(blobUrl); }, 60000);
                    }
                });

                if (abertos > 0) {
                    btnElement.innerText = "✅ ABERTOS";
                    btnElement.style.background = "#27ae60";
                } else throw new Error("Vazio");
            } else {
                btnElement.innerText = "❌ SEM ANEXO";
                btnElement.style.background = "#c0392b";
            }
        } catch (err) {
            btnElement.innerText = "⚠️ ERRO";
            btnElement.style.background = "#c0392b";
        }

        setTimeout(() => {
            if (btnElement.innerText !== "❌ SEM ANEXO") {
                btnElement.innerText = txtOriginal;
                btnElement.style.background = "#2980b9";
            }
        }, 3000);
    }

    const abrirLinksViaDados = (filtroLogico) => {
        const linksParaAbrir = [];
        estadoPedidos.forEach(pedido => {
            if (filtroLogico(pedido)) {
                linksParaAbrir.push(`https://protocolo.registrocivil.org.br/requerimento/detalhe/${pedido.hash}`);
            }
        });

        if (linksParaAbrir.length > 0) {
            if(confirm(`Confirmar abertura de ${linksParaAbrir.length} abas?`)) {
                linksParaAbrir.forEach((url, index) => {
                    setTimeout(() => window.open(url, '_blank'), index * 300);
                });
            }
        } else alert("Nenhum pedido encontrado com este critério na memória.");
    };

    document.getElementById('btn-open-new').onclick = () => abrirLinksViaDados(pedido => pedido.viewed_responsible_notary_at === null);
    document.getElementById('btn-open-returned').onclick = () => abrirLinksViaDados(pedido => pedido.status && pedido.status.id === 'devolved');
    document.getElementById('btn-open-visible').onclick = () => abrirLinksViaDados(pedido => true);

    let carregandoTodos = false;
    window.addEventListener('crc-dados-atualizados', () => {
        if (carregandoTodos) {
            setTimeout(() => {
                const btn = document.getElementById('loadMore');
                if (btn && btn.offsetParent !== null && !btn.disabled) {
                    btn.click();
                } else {
                    carregandoTodos = false;
                    document.getElementById('loading-status').style.display = 'none';
                    alert("Carga completa!");
                }
            }, 1000); 
        }
    });

    document.getElementById('btn-load-all').onclick = () => {
        carregandoTodos = true;
        document.getElementById('loading-status').style.display = 'block';
        const btn = document.getElementById('loadMore');
        if (btn) btn.click();
        else {
            carregandoTodos = false;
            document.getElementById('loading-status').style.display = 'none';
            alert("Botão de carregar não encontrado.");
        }
    };
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    window.addEventListener('focus', (e) => e.stopImmediatePropagation(), true);
})();