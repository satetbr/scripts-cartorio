// ==UserScript==
// @name         CRC Analises
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  
// @author       Matheus Filipe
// @match        *://protocolo.registrocivil.org.br/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const MENU_ID = 'crc-analisador-suite';
    const CNS_FIXO = 'PREENCHA SEU CNS AQUI';
    let isMinimizado = false;
    let pedidoDetalhesCache = null;
    let urlUltima = location.href;

    const getPDFLib = () => {
        if (typeof PDFLib !== 'undefined') return PDFLib;
        if (window.PDFLib !== 'undefined') return window.PDFLib;
        return null;
    };

    function injetarEstilos() {
        if (document.getElementById('style-crc-final')) return;
        const style = document.createElement('style');
        style.id = 'style-crc-final';
        style.innerHTML = `
            #${MENU_ID} { position: fixed; top: 5px; right: 10px; z-index: 2147483640; background: #1a252f; color: white; padding: 0; border-radius: 8px; border: 1px solid #3abbc6; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5); width: 220px; transition: all 0.3s ease; overflow: hidden; }
            #crc-header { background: #3abbc6; padding: 10px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: center; color: #fff; user-select: none; }
            #crc-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
            .crc-divider { border: 0; border-top: 1px solid #34495e; margin: 4px 0; width: 100%; }
            .crc-btn-batch { background: #3abbc6; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; transition: 0.2s; font-size: 11px; text-transform: uppercase; }
            .crc-btn-batch:hover { filter: brightness(1.1); transform: translateY(-1px); }
            .btn-anexo { background: #2980b9; } .btn-recibo { background: #27ae60; } .btn-info { background: #e67e22; } .btn-previo { background: #16a085; } .btn-hist { background: #8e44ad; } .btn-print { background: #e74c3c; }
            .status-text { font-size: 14px; margin-top: 5px; text-transform: uppercase; }
            .highlight-green { color: #2ecc71; font-weight: bold; } .highlight-red { color: #e74c3c; font-weight: bold; } .highlight-orange { color: #f39c12; font-weight: bold; }
            #crc-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2147483648; display: flex; justify-content: center; align-items: center; }
            #crc-modal { background: #ecf0f1; width: 600px; max-height: 80vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
            .crc-modal-header { background: #34495e; color: white; padding: 15px; font-weight: bold; display: flex; justify-content: space-between; }
            .crc-modal-body { padding: 15px; overflow-y: auto; color: #2c3e50; }
            .hist-item { background: white; border: 1px solid #bdc3c7; padding: 10px; margin-bottom: 10px; border-left: 5px solid #bdc3c7; }
            #${MENU_ID}.minimized #crc-body { display: none; }
        `;
        document.documentElement.appendChild(style);
    }

    // --- INTERFACE ---
    function construirInterface() {
        injetarEstilos();
        if (document.getElementById(MENU_ID)) return;

        const manager = document.createElement('div');
        manager.id = MENU_ID;
        manager.innerHTML = `
            <div id="crc-header">ANALISADOR ➖</div>
            <div id="crc-body">
                <div style="text-align:center; font-size:12px; color:#bdc3c7">Status: <span id="crc-display" class="highlight-orange">...</span></div>
                <button id="btn-anexos" class="crc-btn-batch btn-anexo">ABRIR ANEXOS</button>
                <button id="btn-recibo" class="crc-btn-batch btn-recibo">GERAR RECIBO</button>
                <hr class="crc-divider">
                <button id="btn-hist-act" class="crc-btn-batch btn-info">HISTÓRICO ATIVIDADES</button>
                <button id="btn-previo" class="crc-btn-batch btn-previo">RECIBO PRÉVIO</button>
                <button id="btn-hist-dev" class="crc-btn-batch btn-hist">HISTÓRICO DEVOLUÇÕES</button>
                <hr class="crc-divider">
                <button id="btn-print" class="crc-btn-batch btn-print">IMPRESSÃO UNIFICADA</button>
            </div>
        `;
        document.body.appendChild(manager);

        document.getElementById('crc-header').onclick = () => {
            isMinimizado = !isMinimizado;
            manager.classList.toggle('minimized', isMinimizado);
            document.getElementById('crc-header').innerText = isMinimizado ? "ANALISADOR ➕" : "ANALISADOR ➖";
        };

        document.getElementById('btn-anexos').onclick = abrirAnexosAPIDireto;
        document.getElementById('btn-recibo').onclick = gerarRecibo;
        document.getElementById('btn-hist-act').onclick = abrirHistoricoAtividades;
        document.getElementById('btn-previo').onclick = gerarReciboPrevio;
        document.getElementById('btn-hist-dev').onclick = abrirHistoricoDevolucoes;
        document.getElementById('btn-print').onclick = prepararImpressaoUnificada;
    }

    function getUUID() {
        const match = window.location.href.match(/\/detalhe\/([a-zA-Z0-9-]+)/);
        return match ? match[1] : null;
    }

    async function obterDetalhesDaAPISeguro(uuid) {
        if (pedidoDetalhesCache) return pedidoDetalhesCache;
        try {
            const res = await fetch(`https://protocolo.registrocivil.org.br/api/requirement/details/${uuid}/${CNS_FIXO}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "profile": "notary" }), credentials: 'include'
            });
            if (res.ok) return pedidoDetalhesCache = await res.json();
        } catch(e) { console.error("Falha API Detalhes:", e); }
        return null;
    }

    async function obterReciboBytes(uuid) {
        const URL_RECIBO = `https://protocolo.registrocivil.org.br/api/requirement/acceptance-receipt/${uuid}/${CNS_FIXO}`;
        const response = await fetch(URL_RECIBO, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "profile": "notary" }), credentials: 'include'
        });
        if (!response.ok) throw new Error("Recibo não disponível.");
        const json = await response.json();
        return new Uint8Array(json.data);
    }

    async function prepararImpressaoUnificada() {
        const lib = getPDFLib();
        if (!lib) return alert("PDFLib não carregada.");

        const uuid = getUUID(); if (!uuid) return;
        const btn = document.getElementById('btn-print');
        const txtOrg = btn.innerText;
        btn.innerText = "⏳ PROCESSANDO...";

        try {
            const { PDFDocument } = lib;
            const pdfFinal = await PDFDocument.create();

            // 1. Recibo
            try {
                const rBytes = await obterReciboBytes(uuid);
                const rDoc = await PDFDocument.load(rBytes);
                const rPages = await pdfFinal.copyPages(rDoc, rDoc.getPageIndices());
                rPages.forEach(p => pdfFinal.addPage(p));
            } catch(e) { console.warn("Sem recibo para mesclar."); }

            // 2. Anexos
            const det = await obterDetalhesDaAPISeguro(uuid);
            if (det?.files) {
                for (const f of det.files) {
                    if (!f.buffer?.data) continue;
                    try {
                        const bArray = new Uint8Array(f.buffer.data);
                        if (bArray[0] === 37) { // PDF
                            const aDoc = await PDFDocument.load(bArray);
                            const aPages = await pdfFinal.copyPages(aDoc, aDoc.getPageIndices());
                            aPages.forEach(p => pdfFinal.addPage(p));
                        } else if (bArray[0] === 255 || bArray[0] === 137) { // IMG
                            const img = bArray[0] === 255 ? await pdfFinal.embedJpg(bArray) : await pdfFinal.embedPng(bArray);
                            const page = pdfFinal.addPage([img.width, img.height]);
                            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                        }
                    } catch(err) { console.error("Erro num anexo."); }
                }
            }

            if (pdfFinal.getPageCount() === 0) throw new Error("Nada para imprimir.");

            const pdfBytes = await pdfFinal.save();
            const blobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
            window.open(blobUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

        } catch (e) {
            alert("Erro: " + e.message);
        } finally {
            btn.innerText = txtOrg;
        }
    }

    // --- AUXILIARES ---
    function atualizarSetorVisual() {
        const display = document.getElementById('crc-display');
        if (!display) return;
        const dd = document.getElementById('selectCategories');
        if (dd?.value?.includes('certidao')) {
            display.innerText = "SETOR 2ª VIA"; display.className = "highlight-green";
        } else {
            display.innerText = "PROCESSO/OUTROS"; display.className = "highlight-red";
        }
    }

    function motorDeEstado() {
        const isDetalhe = /\/requerimento\/detalhe\//.test(window.location.href);
        if (isDetalhe) {
            construirInterface();
            atualizarSetorVisual();
        } else {
            const m = document.getElementById(MENU_ID);
            if (m) m.remove();
        }
    }

     async function abrirAnexosAPIDireto() {

        const uuid = getUUID(); if (!uuid) return;

        const btn = document.getElementById('btn-anexos');

        const txtOriginal = btn.innerText; btn.innerText = "⏳ BAIXANDO...";

        try {

            const detalhes = await obterDetalhesDaAPISeguro(uuid);

            if (detalhes && detalhes.files && Array.isArray(detalhes.files) && detalhes.files.length > 0) {

                let abertos = 0;

                detalhes.files.forEach((fileObj, index) => {

                    if (fileObj.buffer && fileObj.buffer.data) {

                        const byteArray = new Uint8Array(fileObj.buffer.data);

                        let mimeType = 'application/pdf';

                        if (byteArray[0] === 255 && byteArray[1] === 216) mimeType = 'image/jpeg';

                        else if (byteArray[0] === 137 && byteArray[1] === 80) mimeType = 'image/png';


                        const blobUrl = URL.createObjectURL(new Blob([byteArray], { type: mimeType }));

                        setTimeout(() => { window.open(blobUrl, '_blank'); }, index * 200);

                        abertos++;

                        setTimeout(() => { URL.revokeObjectURL(blobUrl); }, 60000);

                    }

                });

                if(abertos === 0) alert("Os arquivos existem, mas o buffer está vazio.");

            } else alert("Nenhum anexo encontrado.");

        } catch (e) { alert("Erro anexos: " + e.message); } finally { btn.innerText = txtOriginal; }

    }


    async function abrirHistoricoDevolucoes() {

        const uuid = getUUID(); if (!uuid) return;

        const btn = document.getElementById('btn-hist-dev');

        const txt = btn.innerText; btn.innerText = "⏳ BUSCANDO ID...";

        try {

            const detalhes = await obterDetalhesDaAPISeguro(uuid);

            const idProtocolo = (detalhes && detalhes.data) ? (detalhes.data.identifier || detalhes.data.id) : null;

            if(!idProtocolo) throw new Error("Protocolo numérico não encontrado.");

            btn.innerText = "⏳ BAIXANDO...";

            const res = await fetch(`https://protocolo.registrocivil.org.br/api/requirement/devolved-or-reject/historic/${idProtocolo}`);

            if(res.ok) mostrarModalHistorico(await res.json(), `Devoluções - Prot. ${idProtocolo}`, "header-devolucao", null);

        } catch(e) { alert("Erro: " + e.message); } finally { btn.innerText = txt; }

    }


    async function gerarReciboPrevio() {

        const uuid = getUUID(); if (!uuid) return;

        const btn = document.getElementById('btn-previo');

        const txtOriginal = btn.innerText; btn.innerText = "⏳...";

        try {

            const response = await fetch(`https://protocolo.registrocivil.org.br/api/requirement/receipt/${uuid}/${CNS_FIXO}`, {

                method: 'POST', headers: { 'Content-Type': 'application/json' }

            });

            if (!response.ok) throw new Error("Erro API");

            const json = await response.json();

            if (json.data && Array.isArray(json.data)) {

                const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(json.data)], { type: 'application/pdf' }));

                window.open(blobUrl, '_blank');

                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

            } else throw new Error("Dados inválidos.");

        } catch (err) { alert("Erro: " + err.message); } finally { btn.innerText = txtOriginal; }

    }


    async function abrirHistoricoAtividades() {

        const uuid = getUUID(); if (!uuid) return;

        const btn = document.getElementById('btn-hist-act');

        const txtOriginal = btn.innerText; btn.innerText = "⏳...";

        try {

            const response = await fetch(`https://protocolo.registrocivil.org.br/api/requirement/historic/${uuid}`, {

                method: 'POST', headers: { 'Content-Type': 'application/json' },

                body: JSON.stringify({ "profile": "notary" })

            });

            if(response.ok) {

                const json = await response.json();

                if(json.data && json.data.activitiesHistory) mostrarModalHistorico(json.data.activitiesHistory, "Histórico de Atividades", "header-atividade", "activity");

            }

        } catch (e) { alert("Erro conexão."); } finally { btn.innerText = txtOriginal; }

    }


    function mostrarModalHistorico(dados, titulo, classeHeader, classeItemPadrao) {

        const old = document.getElementById('crc-modal-overlay'); if(old) old.remove();

        let html = (!dados || dados.length === 0) ? '<div style="padding:20px;text-align:center">Sem registros.</div>' : '';

        if (dados && dados.length > 0) {

            dados.forEach(i => {

                let cls = classeItemPadrao || '';

                if (i.current_status === 'devolved') cls = 'devolved';

                else if (i.current_status === 'request_updated') cls = 'updated';

                let desc = i.activity_description ? i.activity_description.replace(/;/g, '<br>') : 'Sem descrição';

                html += `<div class="hist-item ${cls}"><div class="hist-meta"><span>👤 ${i.username || 'Sistema'}</span><span>📅 ${i.created_at}</span></div><div class="hist-desc">${desc}</div></div>`;

            });

        }

        const overlay = document.createElement('div'); overlay.id = 'crc-modal-overlay';

        overlay.innerHTML = `<div id="crc-modal"><div class="crc-modal-header ${classeHeader}"><span>${titulo}</span><span class="crc-modal-close" onclick="document.getElementById('crc-modal-overlay').remove()">✖</span></div><div class="crc-modal-body">${html}</div></div>`;

        document.body.appendChild(overlay);

        overlay.onclick = e => { if(e.target === overlay) overlay.remove(); }

    }


    function gerarRecibo() {

        let btn = document.querySelector('button.add-protocol') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Gerar recibo'));

        if (btn) btn.click();

    }


    setInterval(motorDeEstado, 500);


})();