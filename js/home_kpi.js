/* =========================================================================
   HOME KPI ENGINE — emissionscarbonebva.fr
   -------------------------------------------------------------------------
   Ce fichier alimente dynamiquement les KPI de la page d'accueil :
   - kpi_total_emissions_2026
   - kpi_part_aeronefs
   - kpi_scope12
   - kpi_puits_carbone
   - kpi_evolution_historique

   IMPORTANT :
   Remplace les URL des fichiers JSON par tes sources réelles.
   Tout est encapsulé et robuste : erreurs → messages discrets.
   ========================================================================== */


/* --------------------------------------------------------------------------
   1️⃣ UTILITAIRES GÉNÉRIQUES
-------------------------------------------------------------------------- */

async function loadJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`Erreur lors du chargement du fichier : ${url}`, err);
        return null;
    }
}

function formatNumber(n) {
    return n.toLocaleString("fr-FR");
}


/* --------------------------------------------------------------------------
   2️⃣ CHARGEMENT DES DONNÉES SOURCES
   --------------------------------------------------------------------------
   ⚠️ À ADAPTER EN FONCTION DE TES VRAIS FICHIERS
-------------------------------------------------------------------------- */

async function loadAllData() {
    return {
        today: await loadJSON("data/emissions_2026_daily.json"),   // émissions journalières
        cumul: await loadJSON("data/emissions_2026_cumul.json"),   // cumul total 2026
        scopes: await loadJSON("data/emissions_scopes.json"),      // split aéronefs / scope 1-2
        historic: await loadJSON("data/emissions_historique.json"),// 2016→2025
        puits: await loadJSON("data/puits_carbone.json")           // données PCAET / territoire
    };
}


/* --------------------------------------------------------------------------
   3️⃣ CALCUL DES KPI
-------------------------------------------------------------------------- */

function computeTotalEmissions(data) {
    if (!data.cumul || !data.cumul.total) return null;
    return data.cumul.total;
}

function computePartAeronefs(data) {
    if (!data.scopes) return null;
    const aeronefs = data.scopes.aeronefs;
    const total = data.scopes.total;
    return total ? (aeronefs / total) * 100 : null;
}

function computePartScopes12(data) {
    if (!data.scopes) return null;
    const s12 = data.scopes.scope12;
    const total = data.scopes.total;
    return total ? (s12 / total) * 100 : null;
}

function computePuitsCarboneComparison(data) {
    if (!data.puits || !data.cumul) return null;

    const totalEmissions = data.cumul.total;
    const equivalentResidents = totalEmissions / data.puits.emission_moyenne_habitant;

    return Math.round(equivalentResidents);
}

function computeHistoricEvolution(data) {
    if (!data.historic) return null;

    const y2016 = data.historic["2016"];
    const yLast = data.historic["2025"] || data.historic["2024"];

    if (!y2016 || !yLast) return null;

    return ((yLast - y2016) / y2016) * 100;
}


/* --------------------------------------------------------------------------
   4️⃣ MISE À JOUR DU DOM
-------------------------------------------------------------------------- */

function updateText(id, value, suffix = "") {
    const el = document.getElementById(id);
    if (!el) return;

    if (value === null || value === undefined || Number.isNaN(value)) {
        el.textContent = "—";
        return;
    }

    el.textContent = `${formatNumber(value)}${suffix}`;
}

function updateKPIs(data) {

    // TOTAL 2026
    updateText(
        "kpi_total_emissions_2026",
        computeTotalEmissions(data),
        " t CO₂e depuis le 1er janvier 2026"
    );

    // % AÉRONEFS
    const partAeronefs = computePartAeronefs(data);
    updateText("kpi_part_aeronefs", partAeronefs?.toFixed(1), " %");

    // % SCOPE 1 & 2
    const partS12 = computePartScopes12(data);
    updateText("kpi_scope12", partS12?.toFixed(2), " %");

    // ÉQUIVALENT HABITANTS
    const eqResidents = computePuitsCarboneComparison(data);
    updateText("kpi_puits_carbone", eqResidents, " habitants");

    // EVOLUTION HISTORIQUE
    const evo = computeHistoricEvolution(data);
    updateText("kpi_evolution_historique", evo?.toFixed(1), " %");
}


/* --------------------------------------------------------------------------
   5️⃣ INITIALISATION
-------------------------------------------------------------------------- */

async function initHomeKPI() {
    const data = await loadAllData();
    updateKPIs(data);
}

// Lance le calcul dès que la page est prête
document.addEventListener("DOMContentLoaded", initHomeKPI);
