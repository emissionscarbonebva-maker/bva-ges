/***************************************************************
 *  js/accueil_kpi.js – PARTIE 1/3
 *  ------------------------------------------------------------
 *  Cette partie contient :
 *    ✔ Utilitaires généraux (couleurs, formats)
 *    ✔ parseCSV() – charge les CSV (séparateur auto)
 *    ✔ displayName() – noms lisibles pour les colonnes
 *    ✔ Helpers numériques robustes
 *    ✔ Lecture du fichier EXPORT_update_time.csv
 *  ------------------------------------------------------------
 *  ❗ Aucune logique KPI ici : uniquement le socle commun.
 ***************************************************************/


/***************************************************************
 * 🔧 1. Conversion RGB → RGBA
 *    Permet d’ajouter de la transparence aux couleurs existantes.
 ***************************************************************/
function toRGBA(rgb, a = 1) {
    if (typeof rgb !== "string") return rgb;
    if (!rgb.startsWith("rgb(")) return rgb;
    return rgb.replace("rgb(", "rgba(").replace(")", `, ${a})`);
}


/***************************************************************
 * 🔧 2. parseCSV(url, callback)
 *    Charge un CSV avec ; ou , et renvoie :
 *      - rows : tableau d’objets
 *      - headers : tableau de noms de colonnes
 *    → Version simplifiée adaptée à la homepage
 ***************************************************************/
function parseCSV(url, callback) {
    fetch(url)
        .then(r => r.text())
        .then(text => {
            const lines = text.split("\n").filter(l => l.trim() !== "");
            const sep = lines[0].includes(";") ? ";" : ",";
            const headers = lines[0].split(sep).map(h => h.trim());
            const rows = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(sep);
                const obj = {};
                headers.forEach((h, idx) => {
                    obj[h] = cols[idx] ? cols[idx].trim() : "";
                });
                rows.push(obj);
            }

            callback(rows, headers);
        });
}


/***************************************************************
 * 🔧 3. displayName()
 *    Convertit les noms de colonnes techniques → libellés lisibles
 *    (Version réduite pour KPI de la homepage)
 ***************************************************************/
const DISPLAY_LABELS = {
    "scope_vols": "Aéronefs (Scope 3)",
    "scope_1_2": "Scopes 1 & 2",
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
    const clean = k.replace(/\uFEFF/g, "").trim();
    return DISPLAY_LABELS[clean] || clean;
}


/***************************************************************
 * 🔧 4. Helpers numériques robustes
 *    Transforme "12 345,6" → 12345.6
 *    Transforme "12.345,6" → 12345.6
 *    Transforme "12,345.6" → 12345.6
 ***************************************************************/
function _toNumberSmart(x) {
    if (x === null || x === undefined || x === "") return 0;
    let s = String(x).trim();

    // Format EU : 12.345,67
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
        s = s.replace(/\./g, "").replace(",", ".");
    }
    // Format US : 12,345.67
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
        s = s.replace(/,/g, "");
    }
    else {
        s = s.replace(/\s+/g, "");
        if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
        s = s.replace(/,/g, "");
    }

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}


/***************************************************************
 * 🔧 5. formatTonsFR
 *    Transforme un nombre → "12 345"
 ***************************************************************/
function formatTonsFR(n) {
    return Math.round(n).toLocaleString("fr-FR");
}


/***************************************************************
 * 🔧 6. Mise à jour automatique :
 *       "Dernière mise à jour le XX mois XXXX à HH:MM"
 *    Source : data/EXPORT_update_time.csv
 ***************************************************************/
document.addEventListener("DOMContentLoaded", () => {

    fetch("data/EXPORT_update_time.csv")
        .then(r => r.text())
        .then(text => {
            const lines = text.trim().split(/\r?\n/);
            if (lines.length < 2) return;

            const [dateStr, timeStr] = lines[1].split(",").map(v => v.trim());
            const d = new Date(`${dateStr}T${timeStr}`);

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
 *  js/accueil_kpi.js – PARTIE 2/3
 *  ------------------------------------------------------------
 *  KPI 1 : Barre empilée (Aéronefs / S1‑2 / Autres)
 *  KPI 2 : Gros total cumulé 2026
 *  KPI 4 : Barre verte = capacité annuelle des puits carbone
 *  ------------------------------------------------------------
 *  Source CSV : ./data/EXPORT_cumul_scopes.csv
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    parseCSV("./data/EXPORT_cumul_scopes.csv", (rows, headers) => {

        /***********************************************************
         * 1. Identification des colonnes CSV
         ***********************************************************/
        const K_DATE = headers[0];
        const K_TOT  = headers.find(h => /cumul_total/i.test(h));
        const K_VOL  = headers.find(h => /cumul_vols?/i.test(h));
        const K_S12  = headers.find(h => /cumul_scope_1_2/i.test(h));
        const K_ACI  = headers.find(h => /cumul_acces_ind/i.test(h));
        const K_ACC  = headers.find(h => /cumul_acces_coll/i.test(h));
        const K_EMP  = headers.find(h => /cumul_employes/i.test(h));

        if (!K_TOT || !K_VOL || !K_S12 || !K_ACI || !K_ACC || !K_EMP) {
            console.error("❌ Colonnes manquantes dans EXPORT_cumul_scopes.csv");
            return;
        }

        /***********************************************************
         * 2. Ligne la plus récente (ton CSV est déjà trié)
         ***********************************************************/
        const latest = rows[0];

        const total    = _toNumberSmart(latest[K_TOT]);
        const aero     = _toNumberSmart(latest[K_VOL]);
        const s12      = _toNumberSmart(latest[K_S12]);
        const accesInd = _toNumberSmart(latest[K_ACI]);
        const accesCol = _toNumberSmart(latest[K_ACC]);
        const emp      = _toNumberSmart(latest[K_EMP]);

        const autres = accesInd + accesCol + emp;

        if (!isFinite(total) || total <= 0) return;

        /***********************************************************
         * 3. Mise à jour du titre KPI 1 (date dynamique)
         ***********************************************************/
        const d = new Date(latest[K_DATE]);
        const moisFR = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        document.getElementById("kpi1-title").textContent =
            `Émissions totales 2026 au ${moisFR}`;

        /***********************************************************
         * 4. KPI 2 — Gros total cumulé
         ***********************************************************/
        document.getElementById("kpiTotal").textContent =
            `${formatTonsFR(total)} t éq CO₂`;

        /***********************************************************
         * 5. KPI 1 — Construction de la barre empilée Chart.js
         ***********************************************************/
        const cvBreak = document.getElementById("kpiBreakdown");
        if (window._kpiBreakdownChart) window._kpiBreakdownChart.destroy();

        const colors = {
            aero:   "rgb(31, 120, 180)",   // bleu
            s12:    "rgb(148, 103, 189)",  // violet
            autres: "rgb(255, 127, 14)"    // orange
        };

        window._kpiBreakdownChart = new Chart(cvBreak.getContext("2d"), {
            type: "bar",
            data: {
                labels: [""],
                datasets: [
                    { label: "Aéronefs",           data: [aero],     backgroundColor: toRGBA(colors.aero, 0.85),   stack: "S" },
                    { label: "Scopes 1 & 2",       data: [s12],      backgroundColor: toRGBA(colors.s12, 0.85),    stack: "S" },
                    { label: "Autres émissions",   data: [autres],   backgroundColor: toRGBA(colors.autres, 0.85), stack: "S" }
                ]
            },
            options: {
    indexAxis: "y",
    maintainAspectRatio: false,

    // 🚀 SUPPRESSION DU PADDING INTERNE AUTOMATIQUE
    layout: {
        padding: {
            top: 0,
            bottom: 0
        }
    },

    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (ctx) => {
                    const v = ctx.parsed.x;
                    const pct = (v / total) * 100;
                    return `${ctx.dataset.label} : ${formatTonsFR(v)} t (${pct.toFixed(1)}%)`;
                }
            }
        }
    },

    scales: {
        x: { stacked: true, display: false, max: total },

        // 🚀 ON FORCE LA BARRE À PRENDRE TOUTE LA HAUTEUR DISPONIBLE
        y: {
            stacked: true,
            display: false,
            categoryPercentage: 1.0,
            barPercentage: 1.0
        }
    }
}
        });

        /***********************************************************
         * 6. KPI 4 — Calcul dynamique selon tes règles EXACTES
         ***********************************************************/
        const capacite = 41400;
        let widthKPI1, widthKPI4;

        if (total === capacite) {
            widthKPI1 = 1;
            widthKPI4 = 1;
        } else if (total < capacite) {
            widthKPI1 = total / capacite;
            widthKPI4 = 1;
        } else {
            widthKPI1 = 1;
            widthKPI4 = capacite / total;
        }

        /***********************************************************
         * 7. KPI 4 — Barre verte
         ***********************************************************/
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
                backgroundColor: "rgba(76, 175, 80, 0.70)",
                borderColor: "rgb(76, 175, 80)",
                borderWidth: 1,
                barThickness: 28,

                // 🚀 Ecart entre les deux histogramme KPI 1 et KPI 4
                categoryPercentage: 1.0,
                barPercentage: 1.0
            }
        ]
    },

            
options: {
    indexAxis: "y",
    maintainAspectRatio: false,

    layout: {
        padding: {
            top: 0,
            bottom: 0
        }
    },

    plugins: {
        legend: { display:false },
        tooltip: {
            callbacks: {
                label: () => `Capacité : 41 400 t CO₂`
            }
        }
    },

    scales: {
        x: { min: 0, max: 1, display: false },
        y: { display: false }

                }
            }
        });

        /***********************************************************
         * 8. Légende KPI 1 (ordre exact demandé)
         ***********************************************************/
        const pctA = (aero / total * 100).toFixed(1);
        const pctS = (s12  / total * 100).toFixed(1);
        const pctO = (autres / total * 100).toFixed(1);

        document.getElementById("kpiBreakdownLegend").innerHTML = `
            <span style="color:${colors.aero}">■</span> Aéronefs ${pctA}% &nbsp;&nbsp;
            <span style="color:${colors.s12}">■</span> Scopes 1 & 2 ${pctS}% &nbsp;&nbsp;
            <span style="color:${colors.autres}">■</span> Autres ${pctO}%
        `;

        /***********************************************************
         * 9. Légende KPI 4
         ***********************************************************/
        document.getElementById("kpiPuitsLegend").innerHTML = `
            <span style="color:rgb(76,175,80)">■</span>
            Capacité annuelle de stockage des milieux naturels du Beauvaisis : <strong>41 400 t éq CO₂</strong>
        `;

        /***********************************************************
         * 10. Bloc "Ordre de grandeur" EXACTEMENT comme ton image
         ***********************************************************/
        const pctTerritoire = ((total / capacite) * 100).toFixed(1);

        const now = new Date(latest[K_DATE]);
        const startYear = new Date(now.getFullYear(), 0, 1);
        const endYear   = new Date(now.getFullYear(), 11, 31);
        const pctYear   = ((now - startYear) / (endYear - startYear) * 100).toFixed(1);

        const ordreHTML = `
            <div style="
                margin-top:12px;
                padding:14px 18px;
                background:#e6ffe6;
                border-left:5px solid #2e7d32;
                border-radius:10px;
                font-size:0.95rem;
                line-height:1.45;">
                
                <p style="margin:0 0 6px 0;">
                    <span style="color:#1f3c88; font-weight:bold;"> 🌍📊 <stong>Ordre de grandeur</strong> :</span>
                </p>

                <p style="margin:0;">
                    Ces émissions représentent <strong>${pctTerritoire}%</strong>  
                    de la capacité annuelle de stockage de carbone des milieux naturels  
                    du Beauvaisis 🌱🌳 estimée à <strong>41 400 t éq CO₂ / an</strong> par le PCAET.
                    <br>
                    Et elles ont été générées en seulement <strong>${pctYear}%</strong>  
                    de l’année 2026 ⏱️.
                </p>
            </div>
        `;

        // On place ce bloc EXACTEMENT sous les deux légendes
        document.getElementById("kpiPuitsLegend")
            .insertAdjacentHTML("afterend", ordreHTML);

        /***********************************************************
         * 11. Texte explicatif complet EXACTEMENT comme ta page
         ***********************************************************/
        const explainHTML = `
            <p>
                L’accréditation ACA 4 mise en avant concerne uniquement les émissions  
                de GES directes de l’aéroport (“Location based” ou “scopes 1 & 2”)  
                qui représentent une part limitée des émissions de l’aéroport  
                dès lors que l’on intègre les transports passagers (aériens et routiers)  
                dans le périmètre d’analyse.
            </p>

            <p>
                Quand bien même ces émissions “Location based” ont été réduites de 20%  
                entre 2017 et 2024, ceci n’a aucune incidence puisque dans le même temps  
                les émissions des aéronefs ont <strong>augmenté de 72.5%</strong>.
            </p>

            <p>
                Les émissions pour l’année 2025 seront ajoutées lorsque l’ensemble  
                des sources nécessaires à leur estimation seront disponibles.
            </p>
        `;

        document.getElementById("kpiS12AeroExplain").innerHTML = explainHTML;

    });

});

/***************************************************************
 *  js/accueil_kpi.js – PARTIE 3/3
 *  ------------------------------------------------------------
 *  KPI 3 : Historique annuel des émissions
 *          “Location based (scope 1 & 2)” vs “Aéronefs”
 *
 *  Objectifs :
 *    ✔ Reproduire le graphe de ta page actuelle
 *    ✔ Barres groupées par année
 *    ✔ Valeurs affichées au-dessus des barres Aéronefs
 *    ✔ Pastilles “NM” sur données manquantes
 *    ✔ Même couleurs, même logique, même style
 *
 *  Source CSV : ./data/EXPORT_yearly_total.csv
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    parseCSV("./data/EXPORT_yearly_total.csv", (rows, headers) => {

        /***********************************************************
         * 1. Identifier les colonnes
         ***********************************************************/
        const K_YEAR = headers.find(h => /année/i.test(h)) || headers[0];
        const K_S12  = headers.find(h => /scope_1_2/i.test(h));
        const K_AERO = headers.find(h => /aeronefs/i.test(h));

        if (!K_YEAR || !K_S12 || !K_AERO) {
            console.error("❌ Colonnes manquantes dans EXPORT_yearly_total.csv");
            return;
        }

        /***********************************************************
         * 2. Formater les données pour Chart.js
         ***********************************************************/
        const data = rows
            .map(r => ({
                year: Number(String(r[K_YEAR]).replace(/[^\d]/g, "")),
                s12 : _toNumberSmart(r[K_S12])  || null,
                aero: _toNumberSmart(r[K_AERO]) || null
            }))
            .filter(r => r.year)
            .sort((a,b) => a.year - b.year);

        const years = data.map(r => r.year);
        const valsS12  = data.map(r => r.s12  ?? 0);
        const valsAero = data.map(r => r.aero ?? 0);

        const missingS12  = data.map(r => r.s12  === null ? "NM" : "");
        const missingAero = data.map(r => r.aero === null ? "NM" : "");

        /***********************************************************
         * 3. Plugin Chart.js : valeurs au-dessus des barres Aéronefs
         ***********************************************************/
        const pluginAeroLabels = {
            id: "pluginAeroLabels",
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                ctx.save();
                ctx.font = "11px Arial";
                ctx.fillStyle = "#222";
                ctx.textAlign = "center";

                const dsA = chart.data.datasets.findIndex(ds =>
                    ds.label && ds.label.includes("Aéronefs")
                );
                if (dsA === -1) return;

                const meta = chart.getDatasetMeta(dsA);
                meta.data.forEach((bar, i) => {
                    if (missingAero[i]) return; // pas d’étiquette si NM

                    const val = valsAero[i];
                    if (val > 0) {
                        const { x, y } = bar.getProps(["x","y"], true);
                        ctx.fillText(formatTonsFR(val), x, y - 4);
                    }
                });

                ctx.restore();
            }
        };

        /***********************************************************
         * 4. Plugin Chart.js : pastilles "NM"
         ***********************************************************/
        const pluginMissingData = {
            id: "pluginMissingData",
            afterDatasetsDraw(chart) {
                const { ctx, chartArea, scales: { x } } = chart;

                ctx.save();
                ctx.font = "11px Arial";

                chart.data.datasets.forEach((ds, dsi) => {
                    const missing = ds.missingLabels || [];
                    const meta = chart.getDatasetMeta(dsi);
                    if (!meta || meta.hidden) return;

                    meta.data.forEach((bar, i) => {
                        if (!missing[i]) return; // pas de pastille

                        const text = missing[i];
                        const { x: bx } = bar.getProps(["x"], true);
                        const y = chartArea.bottom - 22;

                        // Pastille arrondie jaune
                        const paddingX = 6;
                        const h = 18;
                        const w = Math.max(28, ctx.measureText(text).width + paddingX * 2);
                        const left = bx - w / 2;
                        const top  = y;

                        ctx.fillStyle = "#F6C96E";
                        const r = 9;

                        ctx.beginPath();
                        ctx.moveTo(left + r, top);
                        ctx.lineTo(left + w - r, top);
                        ctx.quadraticCurveTo(left + w, top, left + w, top + r);
                        ctx.lineTo(left + w, top + h - r);
                        ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
                        ctx.lineTo(left + r, top + h);
                        ctx.quadraticCurveTo(left, top + h, left, top + h - r);
                        ctx.lineTo(left, top + r);
                        ctx.quadraticCurveTo(left, top, left + r, top);
                        ctx.closePath();
                        ctx.fill();

                        ctx.fillStyle = "#1B1D22";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, bx, top + h / 2);
                    });
                });

                ctx.restore();
            }
        };

        /***********************************************************
         * 5. Création du graphique KPI 3
         ***********************************************************/
        const cv = document.getElementById("kpiScope12");
        if (window._chartKPI3) window._chartKPI3.destroy();

        window._chartKPI3 = new Chart(cv.getContext("2d"), {
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
                                const val = ctx.raw ?? 0;
                                return `${ctx.dataset.label} : ${formatTonsFR(val)} t éq CO₂`;
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

            plugins: [pluginAeroLabels]
        });

    });

});
