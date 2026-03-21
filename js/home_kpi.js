/* =========================================================================
   HOME KPI ENGINE — emissionscarbonebva.fr
   Basé sur les CSV réels fournis par Félicien
   ========================================================================== */

import { loadCSV } from "./utils_csv.js";   // ton parseur CSV modulable

// === PARAMÈTRES PUITS NATURELS (PCAET) ===
const PUITS_SOLS = 7400;
const PUITS_FORETS = 34000;
const CAPACITE_TERRITOIRE = PUITS_SOLS + PUITS_FORETS;

/* --------------------------------------------------------------------------
   CHARGEMENT DES DONNÉES CSV
-------------------------------------------------------------------------- */

async function loadAll() {
    return {
        dailyScopes:  await loadCSV("data/EXPORT_daily_scopes.csv"),
        cumulScopes:  await loadCSV("data/EXPORT_cumul_scopes.csv"),
        arrivalsYTD:  await loadCSV("data/EXPORT_arrivals_YTD.csv"),
        departuresYTD:await loadCSV("data/EXPORT_departures_YTD.csv"),
        yearly:       await loadCSV("data/EXPORT_yearly_total.csv"),
    };
}

/* --------------------------------------------------------------------------
   CALCULS
-------------------------------------------------------------------------- */

function getTotal2026(cumul) {
    const last = cumul[cumul.length - 1];
    return last ? Number(last.cumul_total) : 0;
}

function computePartAeronefs(daily) {
    let sum = 0, aircraft = 0;
    for (const row of daily) {
        sum += Number(row.total_scopes);
        aircraft += Number(row.scope_vols);
    }
    return (aircraft / sum) * 100;
}

function computeScopes12(daily) {
    let sum = 0, s12 = 0;
    for (const row of daily) {
        sum += Number(row.total_scopes);
        s12 += Number(row.scope_1_2);
    }
    return (s12 / sum) * 100;
}

function computeHistoric(yearly) {
    const y2016 = Number(yearly.find(r => r.year === "2016")?.emissions || 0);
    const y2025 = Number(yearly.find(r => r.year === "2025")?.emissions || 0);
    return ((y2025 - y2016) / y2016) * 100;
}

function generateKpiMilieuxNaturels(total) {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const pctAnnee = ((now - start) / (end - start) * 100).toFixed(1);
    const ratio = ((total / CAPACITE_TERRITOIRE) * 100).toFixed(1);

    return `
    <div style="margin-top:12px; padding:10px 12px; background:#f5f7f5; border-left:4px solid #2e7d32; font-size:1em; line-height:1.4;">
        🌍 <strong>Ordre de grandeur :</strong><br>
        Ces émissions représentent <strong>${ratio}%</strong>
        de la capacité annuelle de stockage de carbone des milieux naturels du Beauvaisis🌲🌱
        (<strong>${CAPACITE_TERRITOIRE.toLocaleString("fr-FR")}</strong> t éq CO₂/an selon le PCAET).
        Et elles ont été générées en seulement <strong>${pctAnnee}%</strong> de l’année ${now.getFullYear()} ⏱️.
    </div>`;
}

/* --------------------------------------------------------------------------
   AFFICHAGE
-------------------------------------------------------------------------- */

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}

/* --------------------------------------------------------------------------
   LANCEMENT
-------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {

    const data = await loadAll();

    // TOTAL
    const total = getTotal2026(data.cumulScopes);
    setText("kpi_total_emissions_2026", `${total.toLocaleString("fr-FR")} t CO₂e`);

    // AÉRONEFS
    setText("kpi_part_aeronefs", computePartAeronefs(data.dailyScopes).toFixed(1) + " %");

    // SCOPE 1+2
    setText("kpi_scope12", computeScopes12(data.dailyScopes).toFixed(2) + " %");

    // KPI NATUREL
    setText("kpi_puits_carbone", generateKpiMilieuxNaturels(total));

    // HISTORIQUE
    setText("kpi_evolution_historique", computeHistoric(data.yearly).toFixed(1) + " %");
});
