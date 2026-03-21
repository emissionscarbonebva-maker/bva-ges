/* ============================================================================
   home_kpi.js — version 2026
   Fonctionne sans data_loader.js : parseurs CSV intégrés dans ce fichier.
   Calcule et affiche tous les KPI de la page Accueil.
============================================================================ */


/* ============================================================================
   1) PARSEUR CSV
============================================================================ */

function parseCSV(path, callback) {
    fetch(path)
        .then(res => res.text())
        .then(text => {
            const lines = text.trim().split(/\r?\n/);

            if (lines.length === 0) return callback([], []);

            const headers = lines[0].split(",").map(h => h.trim());
            const rows = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(",");
                const obj = {};

                headers.forEach((h, idx) => {
                    let val = cols[idx]?.trim() ?? "";
                    if (!isNaN(val) && val !== "") val = Number(val);
                    obj[h] = val;
                });

                rows.push(obj);
            }

            callback(rows, headers);
        })
        .catch(err => {
            console.error("Erreur CSV :", path, err);
            callback([], []);
        });
}

function fmt(n) {
    return Number(n).toLocaleString("fr-FR");
}


/* ============================================================================
   2) STOCKAGE DES DONNÉES CHARGÉES
============================================================================ */

let DATA_SCOPES_CUMUL   = null;
let DATA_SCOPES_DAILY   = null;
let DATA_YEARLY         = null;
let DATA_ARRIVALS       = null;
let DATA_DEPARTURES     = null;


/* ============================================================================
   3) LECTURE DES CSV (versions finales)
============================================================================ */

function loadAllCSVs() {

    // CUMUL (total YTD)
    parseCSV("./data/EXPORT_cumul_scopes.csv", (rows) => {
        DATA_SCOPES_CUMUL = rows;
        tryRenderAllKPI();
    });

    // DAILY SCOPES (vols / scopes 1 & 2 / total)
    parseCSV("./data/EXPORT_daily_scopes.csv", (rows) => {
        DATA_SCOPES_DAILY = rows;
        tryRenderAllKPI();
    });

    // HISTORIQUE (2010 → 2025)
    parseCSV("./data/EXPORT_yearly_total.csv", (rows) => {
        DATA_YEARLY = rows;
        tryRenderAllKPI();
    });

    // ARRIVALS YTD
    parseCSV("./data/EXPORT_arrivals_YTD.csv", (rows) => {
        DATA_ARRIVALS = rows;
        tryRenderAllKPI();
    });

    // DEPARTURES YTD
    parseCSV("./data/EXPORT_departures_YTD.csv", (rows) => {
        DATA_DEPARTURES = rows;
        tryRenderAllKPI();
    });
}


/* ============================================================================
   4) ATTEND QUE TOUT SOIT CHARGÉ AVANT DE RENDRE LES KPI
============================================================================ */

function allLoaded() {
    return (
        DATA_SCOPES_CUMUL &&
        DATA_SCOPES_DAILY &&
        DATA_YEARLY &&
        DATA_ARRIVALS &&
        DATA_DEPARTURES
    );
}

function tryRenderAllKPI() {
    if (allLoaded()) renderAllKPI();
}


/* ============================================================================
   5) CALCULS DES KPI
============================================================================ */

/*** TOTAL 2026 ***/
function computeTotal2026() {
    const last = DATA_SCOPES_CUMUL[DATA_SCOPES_CUMUL.length - 1];
    return Number(last.cumul_total);
}

/*** PART AÉRONEFS ***/
function computePartAeronefs() {
    let total = 0, aircraft = 0;
    for (const r of DATA_SCOPES_DAILY) {
        total += Number(r.total_scopes);
        aircraft += Number(r.scope_vols);
    }
    return (aircraft / total) * 100;
}

/*** SCOPES 1 & 2 ***/
function computeScope12() {
    let total = 0, s12 = 0;
    for (const r of DATA_SCOPES_DAILY) {
        total += Number(r.total_scopes);
        s12 += Number(r.scope_1_2);
    }
    return (s12 / total) * 100;
}

/*** HISTORIQUE 2016 → 2025 ***/
function computeHistoricEvolution() {
    const r2016 = DATA_YEARLY.find(r => r.year == "2016");
    const r2025 = DATA_YEARLY.find(r => r.year == "2025");

    if (!r2016 || !r2025) return null;

    return ((Number(r2025.emissions) - Number(r2016.emissions)) /
            Number(r2016.emissions)) * 100;
}


/*** KPI PCAET (milieux naturels) ***/
const PUITS_SOLS = 7400;
const PUITS_FORETS = 34000;
const CAPACITE_TERRITOIRE = PUITS_SOLS + PUITS_FORETS;

function generateKpiMilieuxNaturelsHTML(total) {

    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end   = new Date(now.getFullYear(), 11, 31);

    const pctAnnee = ((now - start) / (end - start) * 100).toFixed(1);
    const ratio    = ((total / CAPACITE_TERRITOIRE) * 100).toFixed(1);

    return `
        <div style="margin-top:12px; padding:10px 12px;
                    background:#f5f7f5; border-left:4px solid #2e7d32;
                    font-size:1em; line-height:1.4;">
            🌍 <strong>Ordre de grandeur :</strong><br>
            Ces émissions représentent <strong>${ratio}%</strong>
            de la capacité annuelle de stockage de carbone des milieux naturels du Beauvaisis🌲🌱
            (<strong>${fmt(CAPACITE_TERRITOIRE)}</strong> t éq CO₂/an selon le PCAET).
            Et elles ont été générées en seulement
            <strong>${pctAnnee}%</strong> de l’année ${now.getFullYear()} ⏱️.
        </div>`;
}


/* ============================================================================
   6) MISE À JOUR DU DOM
============================================================================ */

function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}


/* ============================================================================
   7) RENDU FINAL DES KPI
============================================================================ */

function renderAllKPI() {

    const total = computeTotal2026();

    setHTML("kpi_total_emissions_2026",
            fmt(total) + " t CO₂e");

    setHTML("kpi_part_aeronefs",
            computePartAeronefs().toFixed(1) + " %");

    setHTML("kpi_scope12",
            computeScope12().toFixed(2) + " %");

    setHTML("kpi_evolution_historique",
            computeHistoricEvolution().toFixed(1) + " %");

    setHTML("kpi_puits_carbone",
            generateKpiMilieuxNaturelsHTML(total));
}


/* ============================================================================
   8) LANCEMENT
============================================================================ */

document.addEventListener("DOMContentLoaded", loadAllCSVs);
