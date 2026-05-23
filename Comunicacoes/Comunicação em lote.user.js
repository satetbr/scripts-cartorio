// ==UserScript==
// @name         Comunicação em lote
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  comu nicação
// @author       Matheus
// @match        https://sistema.registrocivil.org.br/recebidas/comunicacao_imprimir_arquivar_lote.cfm*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const btn = document.createElement('button');
    btn.innerHTML = 'IMPRIMIR';
    btn.setAttribute('style', `
        position: fixed; top: 10px; right: 10px; z-index: 99999;
        padding: 15px; background-color: #000; color: #fff;
        border: 2px solid #fff; font-weight: bold; cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.5); font-family: Arial;
    `);
    document.body.appendChild(btn);

    btn.addEventListener('click', function() {
       
        let todosCenters = Array.from(document.querySelectorAll('center'));

        let comunicacoesValidas = todosCenters.filter(center => {
            if (center.querySelector('center')) return false;
            if (!center.innerText.includes('Comunicação') && !center.innerText.includes('RCPN')) return false;
            return true;
        });

        if (comunicacoesValidas.length === 0) {
            alert("Nenhuma comunicação encontrada.");
            return;
        }

        comunicacoesValidas.sort((a, b) => {
            return b.innerText.length - a.innerText.length;
        });

        let linhasHTML = '';
        for (let i = 0; i < comunicacoesValidas.length; i += 4) {
            let chunk = comunicacoesValidas.slice(i, i + 4);

            linhasHTML += '<div class="linha-corte">';

            chunk.forEach(center => {
                let htmlLimpo = center.innerHTML;
                htmlLimpo = htmlLimpo.replace(/<hr>|<meta.*?>|<title>.*?<\/title>|<head>.*?<\/head>|<body>|<\/body>|<html>|<\/html>|<!DOCTYPE.*?>/gi, '');
                htmlLimpo = htmlLimpo.replace(/(<br\s*\/?>\s*){3,}/gi, '<br>');
                htmlLimpo = htmlLimpo.trim();

                linhasHTML += `<div class="etiqueta">${htmlLimpo}</div>`;
            });

            while (chunk.length < 4) {
                 linhasHTML += `<div class="etiqueta vazia"></div>`;
                 chunk.push('vazio');
            }
            linhasHTML += '</div>';
        }

        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>${comunicacoesValidas.length} Itens</title>
                <style>
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 0.5cm;
                        }
                    }

                    body {
                        font-family: 'Times New Roman', serif;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                    }

                    .container {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        /* Centraliza o bloco todo na página se sobrar espaço lateral */
                        align-items: flex-start;
                    }

                    .linha-corte {
                        display: flex;
                        width: 100%;

                        margin-top: -0.5pt;

                        break-inside: avoid;
                        page-break-inside: avoid;
                    }

                    .linha-corte:first-child {
                        margin-top: 0;
                    }

                    .etiqueta {
                        flex: 0 0 4.95cm;
                        width: 4.95cm;

                        border: 0.5pt solid #000;

                        margin-left: -0.5pt;

                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;

                        box-sizing: border-box;
                        font-size: 6.5pt;
                        line-height: 1.1;
                        text-align: center !important;
                        padding: 2px;

                        background-color: white;
                    }

                    .etiqueta:first-child {
                        margin-left: 0;
                    }

                    .etiqueta.vazia {
                        border: 0.5pt solid #000;
                    }

                    .etiqueta br { display: block; content: ""; margin: 0; }
                    .etiqueta div, .etiqueta p {
                        margin: 0 !important;
                        padding: 0 !important;
                        text-align: center !important;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    ${linhasHTML}
                </div>
            </body>
            </html>
        `);
        win.document.close();
    });
})();