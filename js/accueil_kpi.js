/***************************************************************
 *  js/accueil_kpi.js
 *  -----------------------------------------------
 *  Fichier JS dédié EXCLUSIVEMENT à la page d’accueil
 *  du site emissionscarbonebva.fr
 *
 *  Rôle :
 *    - Charger les données nécessaires aux 4 KPI de l’accueil
 *    - Construire :
 *         KPI 1 : Barre empilée (Aéronefs / S1-2 / Autres)
 *         KPI 2 : Total cumul 2026 (gros chiffre)
 *         KPI 4 : Barre verte capacité puits carbone
 *         KPI 3 : Graphique historique (S1-2 vs Aéronefs)
 *    - Générer les textes explicatifs associés
 *
 *  IMPORTANT :
 *    - Code allégé : aucune logique des anciens graphiques
 *    - Compatible avec style.css existant
 *    - Chart.js v3.9.1
 ***************************************************************/


/***************************************************************
 *                 SECTION 1 — UTILITAIRES GÉNÉRAUX
 ***************************************************************/

/**
 * Convertit un "rgb(r,g,b)" en "rgba(r,g,b,a)".
 * Permet de réutiliser tes couleurs existantes et d’ajouter de la transparence.
 */
function toRGBA(rgb, a = 1) {
    if (typeof rgb !== 'string') return rgb;
    if (!rgb.startsWith('rgb(')) return rgb;
    return rgb.replace('rgb(', 'rgba(').replace(')', `, ${a})`);
}


/**
 * parseCSV(url, callback)
 * -----------------------
 * Charge un CSV (soit ; soit ,) puis renvoie :
 *   - rows : tableau d’objets
 *   - headers : tableau des noms de colonnes
 *
 * C’est la même fonction que tu utilises dans ta version complète,
 * mais isolée ici pour ne charger que les fichiers nécessaires à l’accueil.
 */
function parseCSV(url, callback) {
    fetch(url)
        .then(r => r.text())
        .then(data => {
            const rows = data.split('\n').filter(r => r.trim() !== '');
            const sep = rows[0].indexOf(';') !== -1 ? ';' : ',';
            const headers = rows[0].split(sep).map(h => h.trim());
            const result = [];

            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(sep);
                const obj = {};
                headers.forEach((h, index) => {
                    obj[h] = cols[index] ? cols[index].trim() : "";
                });
                result.push(obj);
            }
            callback(result, headers);
        });
}


/**
 * displayName(key)
 * ----------------
 * Convertit les noms de colonnes CSV → libellés lisibles.
 * Ici, version simplifiée uniquement pour les KPI.
 */
const DISPLAY_LABELS = {
    "scope_vols": "Aéronefs (Scope 3)",
    "scope_1_2": "Total S1 & S2",
    "scope_acces_ind": "Accès individuels",
    "scope_acces_coll": "Accès collectifs",
    "scope_employes": "Accès employés",
    "cumul_vol": "Aéronefs",
    "cumul_scope_1_2": "Scopes 1 & 2",
    "cumul_acces_ind": "Accès individuels",
    "cumul_acces_coll": "Accès collectifs",
    "cumul_employes": "Accès employés",
    "cumul_total": "Total"
};

function displayName(k) {
    if (!k) return k;
    const clean = k.replace(/\uFEFF/g, '').trim();
    return DISPLAY_LABELS[clean] || clean;
}


/***************************************************************
 *       SECTION 2 — HELPERS NUMÉRIQUES (sécurité / nettoyage)
 ***************************************************************/

/**
 * Convertit un nombre sous forme texte vers un float propre.
 * Tolère :
 *   - virgules
 *   - espaces
 *   - mix ponctuel
 * Inspiré de ton code existant.
 */
function _toNumberSmart(x) {
    if (x === null || x === undefined || x === '') return 0;
    let s = String(x).trim();

    // formats "12 345,67", "12.345,67", "12345.67", etc.
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
        // format européen : "12.345,67"
        s = s.replace(/\./g, '').replace(',', '.');
    }
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
        // format US : "12,345.67"
        s = s.replace(/,/g, '');
    }
    else {
        // fallback simple
        s = s.replace(/\s+/g, '');
        if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
        s = s.replace(/,/g, '');
    }

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

/**
 * Formatte un nombre arrondi en "xx xxx" français.
 */
function formatTonsFR(n) {
    return Math.round(n).toLocaleString('fr-FR');
}


/***************************************************************
 *     SECTION 3 — COMPORTEMENT DYNAMIQUE DE LA PAGE
 *           (mise à jour date "dernière mise à jour")
 ***************************************************************/
document.addEventListener("DOMContentLoaded", () => {

    /**
     * Lecture du fichier EXPORT_update_time.csv
     * pour afficher "dernière mise à jour le XX mois XXXX à HH:MM"
     */
    fetch("data/EXPORT_update_time.csv")
        .then(r => r.text())
        .then(txt => {
            const lines = txt.trim().split(/\r?\n/);
            if (lines.length < 2) return;

            const [date, time] = lines[1].split(",").map(v => v.trim());
            const d = new Date(`${date}T${time}`);
            const el = document.getElementById("update-date");
            if (!el) return;

            if (!isNaN(d)) {
                const fDate = d.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
                const fTime = d.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit"
                });

                el.textContent = `dernière mise à jour le ${fDate} à ${fTime}`;
            } else {
                el.textContent = "date de mise à jour indisponible";
            }
        })
        .catch(() => {
            const el = document.getElementById("update-date");
            if (el) el.textContent = "date de mise à jour indisponible";
        });

});

/***************************************************************
 *                 SECTION 4 — KPI 1 / KPI 2 / KPI 4
 *  Lecture : EXPORT_cumul_scopes.csv
 *  Objectifs :
 *    - Extraire les données cumulées 2026
 *    - Construire :
 *        KPI 2 : total cumul (gros chiffre)
 *        KPI 1 : barre empilée (3 composantes)
 *        KPI 4 : barre verte = capacité puits carbone
 *    - Générer les textes explicatifs
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    // Charger le CSV principal pour les KPI cumulés
    parseCSV("./data/EXPORT_cumul_scopes.csv", (rows, headers) => {

        /**********************************************
         * 1. Trouver les colonnes pertinentes
         **********************************************/
        const K_DATE  = headers[0];  // première colonne = date
        const K_TOT   = headers.find(h => /cumul_total/i.test(h));
        const K_VOL   = headers.find(h => /cumul_vols?/i.test(h));
        const K_S12   = headers.find(h => /cumul_scope_1_2/i.test(h));
        const K_ACI   = headers.find(h => /cumul_acces_ind/i.test(h));
        const K_ACC   = headers.find(h => /cumul_acces_coll/i.test(h));
        const K_EMP   = headers.find(h => /cumul_employes/i.test(h));

        if (!K_TOT || !K_VOL || !K_S12 || !K_ACI || !K_ACC || !K_EMP) {
            console.error("CSV cumul — colonnes manquantes");
            return;
        }

        /**********************************************
         * 2. Choisir la ligne la plus récente
         **********************************************/
        const latest = rows[0]; // ton CSV a déjà la ligne la plus récente en premier

        // extraction numérique propre
        const total   = _toNumberSmart(latest[K_TOT]);
        const aero    = _toNumberSmart(latest[K_VOL]);
        const s12     = _toNumberSmart(latest[K_S12]);
        const accesInd= _toNumberSmart(latest[K_ACI]);
        const accesCol= _toNumberSmart(latest[K_ACC]);
        const emp     = _toNumberSmart(latest[K_EMP]);

        const autres  = accesInd + accesCol + emp;

        if (!isFinite(total) || total <= 0) {
            console.error("Total cumul invalide");
            return;
        }

        /**********************************************
         * 3. Mettre à jour le titre KPI 1
         **********************************************/
        const d = new Date(latest[K_DATE]);
        const moisFR = d.toLocaleDateString("fr-FR", { day:"numeric", month:"long" });
        document.getElementById("kpi1-title").textContent =
            `Émissions totales 2026 au ${moisFR}`;

        /**********************************************
         * 4. Mettre à jour le gros KPI 2
         **********************************************/
        document.getElementById("kpiTotal").textContent =
            `${formatTonsFR(total)} t éq CO₂`;

        /**********************************************
         * 5. Construire le KPI 1 (barre empilée)
         **********************************************/
        const cv1 = document.getElementById("kpiBreakdown");
        if (window._kpiBreakdownChart) window._kpiBreakdownChart.destroy();

        // couleurs identiques à celles de ton site
        const colors = {
            aero:   "rgb(31, 120, 180)",   // bleu
            s12:    "rgb(148, 103, 189)",  // violet
            autres: "rgb(255, 127, 14)"    // orange
        };

        window._kpiBreakdownChart = new Chart(cv1.getContext("2d"), {
            type: "bar",
            data: {
                labels: [""],
                datasets: [
                    {
                        label: "Aéronefs",
                        data: [aero],
                        backgroundColor: toRGBA(colors.aero, 0.85),
                        stack: "stack"
                    },
                    {
                        label: "Scopes 1 & 2",
                        data: [s12],
                        backgroundColor: toRGBA(colors.s12, 0.85),
                        stack: "stack"
                    },
                    {
                        label: "Autres émissions",
                        data: [autres],
                        backgroundColor: toRGBA(colors.autres, 0.85),
                        stack: "stack"
                    }
                ]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed.x;
                                const pct = (v / total) * 100;
                                return `${ctx.dataset.label} : ${formatTonsFR(v)} t  (${pct.toFixed(1)}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked:true, display:false, max: total },
                    y: { stacked:true, display:false }
                }
            }
        });

        /**********************************************
         * 6. Légende KPI 1
         **********************************************/
        const pctA = (aero / total * 100).toFixed(1);
        const pctS = (s12  / total * 100).toFixed(1);
        const pctO = (autres / total * 100).toFixed(1);

        document.getElementById("kpiBreakdownLegend").innerHTML = `
            <span style="color:${colors.aero}">■</span> Aéronefs ${pctA}% &nbsp;&nbsp;
            <span style="color:${colors.s12}">■</span> Scopes 1 & 2 ${pctS}% &nbsp;&nbsp;
            <span style="color:${colors.autres}">■</span> Autres ${pctO}%
        `;

        /***********************************************************
         * 7. KPI 4 — Barre verte (capacité puits carbone)
         *
         * Règles données PAR TOI :
         *    capacite = 41 400 tCO₂
         *
         * CAS 1 : total == capacite
         *         KPI1 = 100% ; KPI4 = 100%
         *
         * CAS 2 : total < capacite
         *         KPI4 = 100% (barre verte pleine)
         *         KPI1 = total / capacite
         *
         * CAS 3 : total > capacite
         *         KPI1 = 100%
         *         KPI4 = capacite / total
         ***********************************************************/
        const capacite = 41400;
        let widthKPI1, widthKPI4;

        if (total === capacite) {
            widthKPI1 = 1;
            widthKPI4 = 1;
        } else if (total < capacite) {
            widthKPI4 = 1;
            widthKPI1 = total / capacite;
        } else {
            widthKPI1 = 1;
            widthKPI4 = capacite / total;
        }

        /**********************************************
         * 8. Construction du KPI 4 (barre horizontale seule)
         **********************************************/
        const cvPuits = document.getElementById("kpiPuits");
        if (window._kpiPuitsChart) window._kpiPuitsChart.destroy();

        window._kpiPuitsChart = new Chart(cvPuits.getContext("2d"), {
            type: "bar",
            data: {
                labels: [""],
                datasets: [
                    {
                        label: "Capacité annuelle du puits carbone (41 400 t CO₂)",
                        data: [widthKPI4],
                        backgroundColor: "rgba(76, 175, 80, 0.70)", // vert
                        borderColor: "rgb(76, 175, 80)",
                        borderWidth: 1,
                        barThickness: 28
                    }
                ]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: () =>
                                `Capacité du puits : 41 400 t CO₂ (${(widthKPI4*100).toFixed(0)}% de la longueur)`
                        }
                    }
                },
                scales: {
                    x: {
                        min: 0,
                        max: 1,
                        display: false
                    },
                    y: { display:false }
                }
            }
        });

        /**********************************************
         * 9. Légende KPI 4
         **********************************************/
        document.getElementById("kpiPuitsLegend").innerHTML = `
            <span style="color:rgb(76, 175, 80)">■</span>
            Capacité annuelle du stockage naturel du Beauvaisis : <b>41 400 t éq CO₂</b>
        `;

        /**********************************************
         * 10. Texte explicatif (ACA 4 + ratios)
         **********************************************/
        const exp = document.getElementById("kpiS12AeroExplain");

        const partAero = (aero / total * 100).toFixed(1);
        const ratioTerritoire = (total / capacite * 100).toFixed(1);

        exp.innerHTML = `
            <p><b>Ordre de grandeur :</b>  
            Ces émissions représentent <b>${ratioTerritoire}%</b> de la capacité annuelle de stockage des milieux naturels du Beauvaisis  
            estimée à <b>41 400 t éq CO₂ / an</b> par le PCAET.</p>

            <p>L’accréditation ACA 4 mise en avant concerne uniquement les émissions de GES directes de l’aéroport (scopes 1 & 2),  
            qui représentent une part limitée des émissions lorsque l’on intègre les transports passagers (aériens et routiers)  
            dans le périmètre d’analyse.</p>

            <p>Les émissions pour l’année 2025 seront ajoutées lorsque l’ensemble des sources nécessaires à leur estimation seront disponibles.</p>
        `;
    });

});

/***************************************************************
 *                 SECTION 5 — KPI 3 : Émissions historiques
 *  Lecture : EXPORT_yearly_total.csv
 *  Objectifs :
 *    - Afficher les émissions annuelles 2010 → 2024 (ou plus)
 *    - Dessiner un histogramme groupé :
 *         - Barres "Location based (scope 1 & 2)"
 *         - Barres "Aéronefs"
 *    - Gestion des valeurs manquantes (étiquettes "NM")
 *    - Ajout des valeurs au-dessus des barres (Aéronefs)
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    parseCSV("./data/EXPORT_yearly_total.csv", (rows, headers) => {

        /**********************************************
         * 1. Identifier les colonnes pertinentes
         **********************************************/
        const K_YEAR = headers.find(h => /année/i.test(h)) || headers[0];
        const K_S12  = headers.find(h => /scope_1_2/i.test(h));
        const K_AERO = headers.find(h => /aeronefs/i.test(h));

        if (!K_YEAR || !K_S12 || !K_AERO) {
            console.error("CSV annuel — colonnes manquantes");
            return;
        }

        /**********************************************
         * 2. Préparer les données annuelles
         **********************************************/
        const data = rows.map(r => {
            const year = Number(String(r[K_YEAR]).replace(/[^\d]/g, ""));
            const s12  = _toNumberSmart(r[K_S12]);
            const aero = _toNumberSmart(r[K_AERO]);

            return {
                year,
                s12:  s12  > 0 ? s12  : null,
                aero: aero > 0 ? aero : null
            };
        }).filter(r => r.year).sort((a,b) => a.year - b.year);

        const years     = data.map(r => r.year);
        const valsS12   = data.map(r => r.s12  ?? 0);
        const valsAero  = data.map(r => r.aero ?? 0);
        const missingS12  = data.map(r => r.s12  === null ? "NM" : "");
        const missingAero = data.map(r => r.aero === null ? "NM" : "");

        /**********************************************
         * 3. Plugins Chart.js pour :
         *     a) dessiner les valeurs sur barres Aéronefs
         *     b) afficher pastilles "NM"
         ***********************************************/

        /** a) Valeurs au-dessus des barres Aéronefs */
        const pluginAeroLabels = {
            id: "pluginAeroLabels",
            afterDatasetsDraw(chart, args, opts) {
                const {
                    ctx,
                    chartArea: { top },
                    scales: { x, y }
                } = chart;

                ctx.save();
                ctx.font = "11px Arial";
                ctx.fillStyle = "#222";
                ctx.textAlign = "center";

                const dsIndex = chart.data.datasets.findIndex(ds => ds.label.includes("Aéronefs"));
                if (dsIndex === -1) return;

                const meta = chart.getDatasetMeta(dsIndex);
                meta.data.forEach((bar, i) => {
                    const val = valsAero[i];
                    if (val > 0) {
                        const { x: bx, y: by } = bar.getProps(["x","y"], true);
                        ctx.fillText(
                            formatTonsFR(val),
                            bx,
                            by - 4
                        );
                    }
                });

                ctx.restore();
            }
        };

        /** b) Pastilles NM */
        const pluginMissingData = {
            id: "pluginMissingData",
            afterDatasetsDraw(chart) {
                const {
                    ctx,
                    chartArea,
                    scales: { x, y }
                } = chart;

                ctx.save();
                ctx.font = "10px Arial";
                ctx.fillStyle = "#000";

                chart.data.datasets.forEach((ds, dsi) => {
                    const meta = chart.getDatasetMeta(dsi);
                    if (!meta || meta.hidden) return;

                    const missing = ds.missingLabels || [];
                    meta.data.forEach((bar, i) => {
                        if (!missing[i]) return;
                        const { x: bx, y: by } = bar.getProps(["x","y"], true);

                        // pastille rect arrondie
                        const text = missing[i];
                        const w = ctx.measureText(text).width + 10;
                        const h = 16;
                        const px = bx - w/2;
                        const py = chartArea.bottom - 22;

                        ctx.fillStyle = "#F6C96E"; // jaune
                        ctx.beginPath();
                        const r = 6;
                        ctx.moveTo(px+r, py);
                        ctx.lineTo(px+w-r, py);
                        ctx.quadraticCurveTo(px+w, py, px+w, py+r);
                        ctx.lineTo(px+w, py+h-r);
                        ctx.quadraticCurveTo(px+w, py+h, px+w-r, py+h);
                        ctx.lineTo(px+r, py+h);
                        ctx.quadraticCurveTo(px, py+h, px, py+h-r);
                        ctx.lineTo(px, py+r);
                        ctx.quadraticCurveTo(px, py, px+r, py);
                        ctx.closePath();
                        ctx.fill();

                        ctx.fillStyle = "#1B1D22";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, bx, py + h/2);
                    });
                });

                ctx.restore();
            }
        };

        /**********************************************
         * 4. Construction du graphique KPI 3
         **********************************************/
        const cv3 = document.getElementById("kpiScope12");
        if (window._chartKPI3) window._chartKPI3.destroy();

        window._chartKPI3 = new Chart(cv3.getContext("2d"), {
            type: "bar",
            data: {
                labels: years,
                datasets: [
                    {
                        label: "Location based (scope 1 & 2) (t éq CO₂)",
                        data: valsS12,
                        backgroundColor: toRGBA("#9467bd", 0.70),
                        borderColor: "#9467bd",
                        borderWidth: 1,
                        missingLabels: missingS12
                    },
                    {
                        label: "Aéronefs (t éq CO₂)",
                        data: valsAero,
                        backgroundColor: toRGBA("#1f78b4", 0.70),
                        borderColor: "#1f78b4",
                        borderWidth: 1,
                        missingLabels: missingAero
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: { position: "top" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.raw ?? 0;
                                return `${ctx.dataset.label} : ${formatTonsFR(v)} t éq CO₂`;
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        ticks: { autoSkip: false, maxRotation: 0 }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "t éq CO₂"
                        }
                    }
                }
            },

            plugins: [pluginAeroLabels, pluginMissingData]
        });

    }); // end parseCSV EXPORT_yearly_total

}); // end DOMContentLoaded
