  // Convertit "rgb(r,g,b)" -> "rgba(r,g,b,a)" (alpha entre 0 et 1)
function toRGBA(rgb, a = 1) {
  if (typeof rgb !== 'string') return rgb;
  if (!rgb.startsWith('rgb(')) return rgb;
  return rgb.replace('rgb(', 'rgba(').replace(')', `, ${a})`);
}

/* ===== EXPORT CSV DES GRAPHIQUES ===== */
function exportChartCSV(chartId, filename){
  const chart = Chart.getChart(chartId);
  if(!chart){
    alert("Graphique non disponible");
    return;
  }

  const csv = [];
  const header = ["Date"];
  chart.data.datasets.forEach(ds => { header.push(ds.label); });
  csv.push(header.join(";"));

  chart.data.labels.forEach((label,i) => {
    const row = [label];
    chart.data.datasets.forEach(ds => { row.push(ds.data[i]); });
    csv.push(row.join(";"));
  });

  const blob = new Blob([csv.join("\n")], { type:"text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/* ===== ZOOM GRAPHIQUE ===== */
Chart.register(ChartZoom);


/* ======================
   MAPPING DES LIBELLÉS
   ====================== */
const DISPLAY_LABELS = {
  // Commun
  "date": "Date",

  // 1) Émissions journalières par scope — EXPORT_daily_scopes.csv
  "scope_vols": "Opérations aéronefs (Scope 3)",
  "scope_acces_ind": "Accès terrestre individuels passagers (Scope 3)",
  "scope_acces_coll": "Accès terrestre collectifs passagers (Scope 3)",
  "scope_employes": "Accès employés (Scope 3)",
  "scope_1_2": "Emissions directes aéroport BVA (Scopes 1 & 2)",
  "total_mvts": "Nombre de mouvements d'aéronefs",

  // 2) Cumul annuel par scope — EXPORT_cumul_scopes.csv
  "cumul_vol": "Opérations aéronefs (Scope 3)",
  "cumul_acces_ind": "Accès terrestre individuels passagers (Scope 3)",
  "cumul_acces_coll": "Accès terrestre collectifs passagers (Scope 3)",
  "cumul_employes": "Accès employés (Scope 3)",
  "cumul_scope_1_2": "Emissions directes aéroport BVA (Scopes 1 & 2)",
  "cumul_total": "Cumul total",
  "cumul_mvts": "Nombre total de mouvements d'aéronefs",

  // 6) Émissions par destination
  "vols": "Nombre de vols (YTD)",

  // 7) Vols départ — EXPORT_departures_YTD.csv
  "numero_vol": "Numéro du vol",
  "compagnie": "Compagnie aérienne",
  "type_avion": "Type d'aéronef",
  "destination": "Destination",
  "distance_km": "Distance 1/2 croisière (km)",
  "emissions": "Emissions GES (t éq CO2)",

  // 8) Vols arrivées — EXPORT_arrivals_YTD.csv
  "origine": "Provenance"
};

/** Retourne le libellé affiché pour une clé CSV. */
function displayName(key) {
  if (typeof key !== "string") return key;
  const k = key.replace(/\uFEFF/g, '').trim();
  return DISPLAY_LABELS[k] || k;
}

/* ====== parseCSV en global (accessible à tout le code) ====== */
function parseCSV(url, callback){
  fetch(url)
    .then(r => r.text())
    .then(data => {
      const rows = data.split('\n').filter(r => r.trim() !== '');
      const sep = rows[0].indexOf(';') !== -1 ? ';' : ',';
      const headers = rows[0].split(sep);
      const result = [];
      for(let i=1; i<rows.length; i++){
        const cols = rows[i].split(sep);
        const obj = {};
        headers.forEach((h, index) => {
          obj[h.trim()] = cols[index] ? cols[index].trim() : "";
        });
        result.push(obj);
      }
      callback(result, headers);
    });
}

//<!-- ========== JS PRINCIPAL (construction des graphiques) ========== -->//
document.addEventListener("DOMContentLoaded", function(){

  /* ========= Utils Périodes & Contrôles ========= */

  // 0.1 Fallback ISO week si date-fns n'est pas dispo
  function _isoWeek(d){
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  }
  function _isoWeekYear(d){
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    return t.getUTCFullYear();
  }

  function makePeriodKey(dateStr, period) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    if (period === "day") return dateStr;
    if (period === "week") {
      const getW  = (window.dateFns && typeof dateFns.getISOWeek      === "function") ? dateFns.getISOWeek      : _isoWeek;
      const getWY = (window.dateFns && typeof dateFns.getISOWeekYear  === "function") ? dateFns.getISOWeekYear  : _isoWeekYear;
      const y = getWY(d);
      const w = String(getW(d)).padStart(2, "0");
      return `${y}-S${w}`;
    }
    if (period === "month") {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }
    return dateStr;
  }

  // 0.2 – Tri des clés de période
  function sortPeriodKeys(keys, period) {
    if (period === "day" || period === "month") {
      return keys.sort((a,b) => a.localeCompare(b));
    }
    if (period === "week") {
      return keys.sort((a,b) => {
        const [ay, aw] = a.split("-S");
        const [by, bw] = b.split("-S");
        if (ay !== by) return Number(ay) - Number(by);
        return Number(aw) - Number(bw);
      });
    }
    return keys;
  }

  // 0.3 – Création des 3 boutons au-dessus d’un canvas
  function ensurePeriodControls(canvasId, onChange) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._periodControls) return canvas._periodControls.value;

    const holder = document.createElement("div");
    holder.className = "period-controls";
    holder.style.display = "flex";
    holder.style.alignItems = "center";
    holder.style.gap = "8px";
    holder.style.margin = "8px 0 4px 0";

    const strong = document.createElement("strong");
    strong.textContent = "Vue :";

    const mkBtn = (label, value) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.value = value;
      b.className = "btn-period";
      Object.assign(b.style, {
        padding: "6px 10px",
        border: "1px solid #cbd5e1",
        borderRadius: "6px",
        background: "#f8fafc",
        cursor: "pointer"
      });
      b.addEventListener("click", () => {
        setActive(value);
        localStorage.setItem(`agg_${canvasId}`, value);
        onChange?.(value);
      });
      return b;
    };

    const btnDay = mkBtn("Par jour", "day");
    const btnWeek = mkBtn("Par semaine", "week");
    const btnMonth = mkBtn("Par mois", "month");

    holder.appendChild(strong);
    holder.appendChild(btnDay);
    holder.appendChild(btnWeek);
    holder.appendChild(btnMonth);

    canvas.parentElement.insertBefore(holder, canvas);

    function setActive(val) {
      [btnDay, btnWeek, btnMonth].forEach(b => {
        b.style.background = (b.dataset.value === val) ? "#e2e8f0" : "#f8fafc";
        b.style.borderColor = (b.dataset.value === val) ? "#94a3b8" : "#cbd5e1";
        b.style.fontWeight = (b.dataset.value === val) ? "600" : "500";
      });
      canvas._periodControls.value = val;
    }

    canvas._periodControls = { setActive, value: "day" };
    const saved = localStorage.getItem(`agg_${canvasId}`) || "day";
    setActive(saved);
    return saved;
  }

/* ====== Contrôles Daily / Annual pour Mvts vs GES ====== */
function ensureMvtsGesControls(canvasId, onChange) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._mvtsControls) return canvas._mvtsControls.value;

    const holder = document.createElement("div");
    holder.className = "period-controls";
    holder.style.display = "flex";
    holder.style.alignItems = "center";
    holder.style.gap = "8px";
    holder.style.margin = "8px 0 4px 0";

    const strong = document.createElement("strong");
    strong.textContent = "Vue :";

    const mkBtn = (label, value) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.dataset.value = value;
        b.className = "btn-period";
        Object.assign(b.style, {
            padding: "6px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            background: "#f8fafc",
            cursor: "pointer"
        });
        b.addEventListener("click", () => {
            setActive(value);
            localStorage.setItem(`agg_${canvasId}_mvts`, value);
            onChange?.(value);
        });
        return b;
    };

    const btnDaily = mkBtn("Quotidienne", "daily");
    const btnAnnual = mkBtn("Annuelle", "annual");

    holder.appendChild(strong);
    holder.appendChild(btnDaily);
    holder.appendChild(btnAnnual);

    canvas.parentElement.insertBefore(holder, canvas);

    function setActive(val) {
        [btnDaily, btnAnnual].forEach(b => {
            const active = b.dataset.value === val;
            b.style.background = active ? "#e2e8f0" : "#f8fafc";
            b.style.borderColor = active ? "#94a3b8" : "#cbd5e1";
            b.style.fontWeight = active ? "600" : "500";
        });
        canvas._mvtsControls.value = val;
    }

    canvas._mvtsControls = { setActive, value: "daily" };

    const saved = localStorage.getItem(`agg_${canvasId}_mvts`) || "daily";
    setActive(saved);
    return saved;
}


  /* ====== Fonction pour le calcul des régression linéaire GES = f(mvts) ====== */
function linearRegression(points) {
    const n = points.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const r2 = (() => {
        let ssTot = 0, ssRes = 0;
        const meanY = sumY / n;
        points.forEach(p => {
            const pred = slope * p.x + intercept;
            ssRes += Math.pow(p.y - pred, 2);
            ssTot += Math.pow(p.y - meanY, 2);
        });
        return 1 - ssRes / ssTot;
    })();

    return { slope, intercept, r2 };
}

  /* ===== Plugin Chart.js : affichage équation + R² ===== */
const regressionLabelPlugin = {
    id: "regressionLabelPlugin",
    afterDatasetsDraw(chart, args, options) {
        if (!options?.display) return;

        const { ctx, chartArea } = chart;

        ctx.save();
        ctx.font = "13px Arial";
        ctx.fillStyle = options.color || "#333";

        const textLines = options.text || [];
        const lineHeight = 16;

        // Position automatiquement dans le coin haut‑droite du CHART AREA
        const paddingX = 10;
        const paddingY = 10;

        const x = chartArea.right - paddingX - 180;  // décalage horizontal (ajuste si besoin)
        const y = chartArea.top + paddingY;

        textLines.forEach((line, i) => {
            ctx.fillText(line, x, y + i * lineHeight);
        });

        ctx.restore();
    }
};

Chart.register(regressionLabelPlugin);
  
  /* ======================================================
     === KPIs MAJ ===
     KPI 1 : bascule sur EXPORT_cumul_scopes.csv (ligne la + récente)
              - Aéronefs = cumul_vols
              - Scope 1 & 2 = cumul_scope_1_2
              - Autres = cumul_acces_ind + cumul_acces_coll + cumul_employes
              - Affiche cumul_total en valeur absolue + ruban 100%
     KPI 2+3 fusion : Histogramme groupé (2010, 2015, 2016→2024)
              - S1&2 vs Aéronefs à même échelle
              - Valeurs visibles sur les barres
              - Ligne explicative en dessous (XX / YY / ZZ)
     ====================================================== */

  /* ---------- Helpers numériques robustes ---------- */
  function _toNumberS12(x){
    if (x === null || x === undefined || x === '') return 0;
    const s = String(x).replace(/\s/g,'').replace(/,/g,'');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function _toNumberAero(x){
    if (x === null || x === undefined || x === '') return 0;
    const s = String(x).replace(/\s/g,'').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function _toNumberSmart(x){
    if (x === null || x === undefined || x === '') return 0;
    let s = String(x).trim();
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else {
      if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function formatTonsFR(n){ return Math.round(n).toLocaleString('fr-FR'); }

  /* ---------- Plugin Chart.js pour afficher les valeurs au-dessus des barres ---------- */
  /* === Étiquettes numériques au-dessus des barres (Aéronefs seulement) === */
const valueLabelsPlugin = {
  id: 'valueLabelsPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '11px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((ds, dsi) => {
      // On ne dessine que pour la série Aéronefs
      if (!/aéronefs/i.test(ds.label)) return;

      const meta = chart.getDatasetMeta(dsi);
      if (!meta || meta.hidden) return;
    
      meta.data.forEach((el, i) => {
        const miss = ds.missingLabels?.[i];
        const val  = ds.data[i];
        if (miss || typeof val !== 'number' || !isFinite(val) || val <= 0) return;

        const { x, y } = el.getProps(['x','y'], true);
        const text = Math.round(val).toLocaleString('fr-FR').replace(/\u202F/g, ' ');
        ctx.fillText(text, x, y - 4); // 4px au-dessus de la barre
      });
    });

    ctx.restore();
  }
};


/* ======= GRAPHIQUE CORRELATION : Mouvements vs GES — Daily & Annual ====== */

let mvtsDaily = null;
let mvtsAnnual = null;

// Charger données quotidiennes
parseCSV('./data/EXPORT_daily_scopes.csv', rows => {
    mvtsDaily = rows;
});

// Charger données annuelles
parseCSV('./data/EXPORT_yearly_total.csv', rows => {
    mvtsAnnual = rows.filter(r => r.année && r.mvt_total && r.emissons_totales);
});

function buildMvtsGesChart(mode = "daily") {
    if (window._chartMvtsGes) window._chartMvtsGes.destroy();

    const points = (mode === "daily")
        ? mvtsDaily.map(r => ({
            x: parseFloat((r.total_mvts || "0").replace(",", ".")),
            y: parseFloat((r.total_scopes || "0").replace(",", ".")),
            label: r.date
        }))
        : mvtsAnnual.map(r => ({
            x: parseFloat((r.mvt_total || "0").replace(",", ".")),
            y: parseFloat((r.emissons_totales || "0").replace(",", ".")),
            label: r.année
        }));

    const labels = points.map(p => p.label);

// Calcul régression

const xs = points.map(p => p.x);
const xMin = Math.min(...xs);
const xMax = Math.max(...xs);

const reg = linearRegression(points);
let regLine = [];

if (reg) {
    regLine = [
        { x: xMin, y: reg.slope * xMin + reg.intercept },
        { x: xMax, y: reg.slope * xMax + reg.intercept }
    ];
}
  
    window._chartMvtsGes = new Chart(
        document.getElementById("chartMvtsVsGES"),
        {
            type: "scatter",
            data: {
                labels,
                datasets: [{
                    label: mode === "daily"
                        ? "Corrélation quotidienne (2026)"
                        : "Corrélation annuelle (2016–2024)",
                    data: points.map(p => ({ x: p.x, y: p.y })),
                    backgroundColor: "rgba(31,119,180,0.6)",
                    borderColor: "#1f77b4",
                    pointRadius: 5,
                    pointHoverRadius: 8
                  },
                    {
                    type: "line",
                    label: "Régression linéaire",
                    data: regLine,
                    borderColor: "red",
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "top" },
                      zoom: {
                          pan:  { enabled: true, mode: 'x' },
                          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                          },
                      tooltip: {
                        callbacks: {
                            label: ctx => {
                                const p = points[ctx.dataIndex];
                                return [
                                    `Mouvements : ${p.x}`,
                                    `GES : ${p.y.toFixed(1)} tCO₂`,
                                    mode === "daily"
                                        ? `Date : ${p.label}`
                                        : `Année : ${p.label}`
                                ];
                            }
                        }
                    },
                  regressionLabelPlugin: {                  
                      display: true,           // active l’affichage
                      color: "#FF0000",           // couleur du texte
                      text: [
                          reg ? `y = ${reg.slope.toFixed(3)}x + ${reg.intercept.toFixed(1)}` : "",
                          reg ? `R² = ${(reg.r2).toFixed(3)}` : ""
                          ]
                    },
                },
                 scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: mode === "daily"
                                ? "Nombre de mouvements quotidiens"
                                : "Nombre de mouvements annuels"
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Émissions de gaz à effet de serre (t éq CO₂)"
                        }
                    }
                }
            }
        }
    );
}

// Création automatique des contrôles et affichage initial
const mvtsInitMode = ensureMvtsGesControls("chartMvtsVsGES", buildMvtsGesChart);
setTimeout(() => buildMvtsGesChart(mvtsInitMode), 400);

  
  /* ====== 1. Émissions journalières par scope ====== */
  parseCSV('./data/EXPORT_daily_scopes.csv', (data,headers) => {
    data.sort((a,b) => new Date(a[headers[0]]) - new Date(b[headers[0]]));

    let chartDailyInstance = null;

    function buildChartDaily(period) {
      const dateKey   = headers[0];
      const scopeKeys = headers.slice(1, 6);

      const perScope = {};
      scopeKeys.forEach(k => perScope[k] = {});
      const periodsSet = new Set();

      data.forEach(row => {
        const pkey = makePeriodKey(row[dateKey], period);
        periodsSet.add(pkey);
        scopeKeys.forEach(k => {
          const raw = row[k];
          let v = raw ? parseFloat(String(raw).replace(',', '.')) : 0;
          if (isNaN(v)) v = 0;
          perScope[k][pkey] = (perScope[k][pkey] || 0) + v;
        });
      });

      const labels = sortPeriodKeys(Array.from(periodsSet), period);
      const isDay  = (period === "day");

      const colorMap = {
        "scope_1_2":        "#9467bd",
        "scope_employes":   "#d62728",
        "scope_acces_coll": "#2ca02c",
        "scope_acces_ind":  "#ff7f0e",
        "scope_vols":       "#1f77b4"
      };

      const desiredOrder = [
        "scope_1_2",
        "scope_employes",
        "scope_acces_coll",
        "scope_acces_ind",
        "scope_vols"
      ];
      const orderedKeys = desiredOrder
        .filter(k => scopeKeys.includes(k))
        .concat(scopeKeys.filter(k => !desiredOrder.includes(k)));

      const datasets = orderedKeys.map(k => {
        const c  = colorMap[k] || "#888888";
        const bg = isDay ? (c + "33") : (c + "AA");
        return {
          type: isDay ? "line" : "bar",
          label: displayName(k),
          data: labels.map(pk => perScope[k][pk] || 0),
          borderColor: c,
          backgroundColor: bg,
          borderWidth: 2,
          fill: isDay,
          stack: "stackS"
        };
      });

      if (chartDailyInstance) chartDailyInstance.destroy();
      chartDailyInstance = new Chart(document.getElementById("chartDaily"), {
        type: isDay ? "line" : "bar",
        data: { labels, datasets },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            zoom: {
              pan:  { enabled: true, mode: 'x' },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y ?? 0;
                  const idx = ctx.dataIndex;
                  const stackKey = ctx.dataset.stack;
                  const datasets = ctx.chart.data.datasets || [];

                  let totalAtIndex = 0;
                  datasets.forEach(ds => {
                    if (ds && ds.stack === stackKey && Array.isArray(ds.data)) {
                      const rawVal = ds.data[idx];
                      const num = (typeof rawVal === 'number')
                        ? rawVal
                        : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                      if (!isNaN(num)) totalAtIndex += num;
                    }
                  });

                  const pct = totalAtIndex > 0 ? (v / totalAtIndex) * 100 : 0;
                  const pctStr = pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

                  return `${ctx.dataset.label} : ${Math.round(v).toLocaleString('fr-FR')} t éq CO₂ ; soit ${pctStr} %`;
                },
                footer: (items) => {
                  if (!items?.length) return '';
                  const idx = items[0].dataIndex;
                  const stackKey = items[0].dataset.stack;
                  const datasets = items[0].chart.data.datasets || [];

                  let totalAtIndex = 0;
                  datasets.forEach(ds => {
                    if (ds && ds.stack === stackKey && Array.isArray(ds.data)) {
                      const rawVal = ds.data[idx];
                      const num = (typeof rawVal === 'number')
                        ? rawVal
                        : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                      if (!isNaN(num)) totalAtIndex += num;
                    }
                  });

                  return `Total : ${Math.round(totalAtIndex).toLocaleString('fr-FR')} t éq CO₂`;
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: isDay ? "Date" : (period === "week" ? "Semaine (ISO)" : "Mois") },
              stacked: !isDay
            },
            y: {
              beginAtZero: true,
              stacked: true,
              title: { display: true, text: "Emissions de gaz à effet de serre (en t éq CO₂)" }
            }
          }
        }
      });
    }

    const initDailyPeriod = ensurePeriodControls("chartDaily", buildChartDaily);
    buildChartDaily(initDailyPeriod);
  });

  /* ====== 2. Cumul annuel par scope ====== */
  parseCSV('./data/EXPORT_cumul_scopes.csv', (data,headers) => {
    if(!data || data.length === 0) return;

    headers = headers.map(h => h.replace(/\uFEFF/g,'').trim());

    let chartCumulInstance = null;

    function buildChartCumul(period) {
      const dateKey  = headers[0];
      const totalKey = headers.find(h => h === "cumul_total");
      const excluded = ["cumul_total", "cumul_mvts"];
      const scopeCols = headers.filter(h => h !== dateKey && !excluded.includes(h));



      const periodLastRow = {};
      data.forEach(row => {
        const pkey = makePeriodKey(row[dateKey], period);
        const current = periodLastRow[pkey];
        if (!current || new Date(row[dateKey]) > new Date(current[dateKey])) {
          periodLastRow[pkey] = row;
        }
      });

      const labels = sortPeriodKeys(Object.keys(periodLastRow), period);
      const isDay  = (period === "day");

      const colorMap = {
        "cumul_scope_1_2":  "#9467bd",
        "cumul_employes":   "#d62728",
        "cumul_acces_coll": "#2ca02c",
        "cumul_acces_ind":  "#ff7f0e",
        "cumul_vol":        "#1f77b4"
      };

      const desiredOrder = [
        "cumul_scope_1_2",
        "cumul_employes",
        "cumul_acces_coll",
        "cumul_acces_ind",
        "cumul_vol"
      ];
      const orderedCols = desiredOrder
        .filter(k => scopeCols.includes(k))
        .concat(scopeCols.filter(k => !desiredOrder.includes(k)));

      const datasets = orderedCols.map(col => {
        const c = colorMap[col] || "#888888";
        return {
          label: displayName(col),
          data: labels.map(pk => {
            const raw = periodLastRow[pk][col];
            let v = raw ? parseFloat(String(raw).replace(',', '.').trim()) : 0;
            return isNaN(v) ? 0 : v;
          }),
          borderWidth: 1.5,
          fill: true,
          backgroundColor: isDay ? (c + "33") : (c + "55"),
          borderColor: c,
          stack: "stack1"
        };
      });

      if (chartCumulInstance) chartCumulInstance.destroy();
      chartCumulInstance = new Chart(document.getElementById("chartCumul"), {
        type: isDay ? 'line' : 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          interaction: { mode:'index', intersect:false },
          plugins: {
            legend: { position:'top' },
            tooltip: {
              itemSort: (a, b) => {
                const va = (a.parsed && typeof a.parsed.y === 'number') ? a.parsed.y : 0;
                const vb = (b.parsed && typeof b.parsed.y === 'number') ? b.parsed.y : 0;
                if (vb === va) return 0;
                return vb - va;
              },
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y ?? 0;
                  const idx = ctx.dataIndex;
                  const stackKey = ctx.dataset.stack;
                  const datasets = ctx.chart.data.datasets || [];

                  let totalAtIndex = 0;
                  datasets.forEach(ds => {
                    if (ds && ds.stack === stackKey && Array.isArray(ds.data)) {
                      const rawVal = ds.data[idx];
                      const num = (typeof rawVal === 'number')
                        ? rawVal
                        : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                      if (!isNaN(num)) totalAtIndex += num;
                    }
                  });

                  const pct = totalAtIndex > 0 ? (v / totalAtIndex) * 100 : 0;
                  const pctStr = pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

                  return `${ctx.dataset.label} : ${Math.round(v).toLocaleString('fr-FR')} t éq CO₂ ; soit ${pctStr} %`;
                },
                footer: (items) => {
                  if (!items?.length) return '';
                  const idx = items[0].dataIndex;
                  const stackKey = items[0].dataset.stack;
                  const datasets = items[0].chart.data.datasets || [];

                  let totalAtIndex = 0;
                  datasets.forEach(ds => {
                    if (ds && ds.stack === stackKey && Array.isArray(ds.data)) {
                      const rawVal = ds.data[idx];
                      const num = (typeof rawVal === 'number')
                        ? rawVal
                        : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                      if (!isNaN(num)) totalAtIndex += num;
                    }
                  });

                  return `Total : ${Math.round(totalAtIndex).toLocaleString('fr-FR')} t éq CO₂`;
                }
              }
            },
            zoom: { pan:{enabled:true, mode:'x'}, zoom:{ wheel:{enabled:true}, pinch:{enabled:true}, mode:'x' } }
          },
          scales: {
            x: { title: { display: true, text: (isDay ? "Date" : (period === "week" ? "Semaine (ISO)" : "Mois")) }, stacked: !isDay },
            y: { beginAtZero: true, stacked: !isDay, title: { display: true, text: "Emissions de gaz à effet de serre (en t éq CO₂)" } }
          }
        }
      });
    }

    const initCumulPeriod = ensurePeriodControls("chartCumul", buildChartCumul);
    buildChartCumul(initCumulPeriod);
  });

  /* ====== 3. Émissions par compagnie ====== */
  parseCSV('./data/EXPORT_daily_airlines.csv', (dataRaw) => {
    const data = dataRaw.map(r => ({
      date: r.date,
      compagnie: String(r.compagnie ?? '').trim(),
      emissions: (() => {
        const n = parseFloat(String(r.emissions ?? 0).replace(',', '.'));
        return isNaN(n) ? 0 : n;
      })()
    }));

    let chartAirlinesInstance = null;

    function buildChartAirlines(period, data) {
      const labelsSet = new Set();
      const compSet   = new Set();
      const agg = {};

      data.forEach(r => {
        const comp = r.compagnie;
        const pkey = makePeriodKey(r.date, period);
        compSet.add(comp);
        labelsSet.add(pkey);
        if (!agg[comp]) agg[comp] = {};
        agg[comp][pkey] = (agg[comp][pkey] || 0) + r.emissions;
      });

      const labels = sortPeriodKeys(Array.from(labelsSet), period);

      const palette = {
        "Ryanair":  "rgb(223,186,47)",
        "Wizz Air": "rgb(225,14,73)",
        "HiSky":    "rgb(19,62,103)",
        "SkyUp":    "rgb(255,58,32)",
        "Volotea":  "rgb(0,0,0)",
        "Autres":   "rgb(127,127,127)"
      };

      const desiredOrder = ["Ryanair","Wizz Air","HiSky","SkyUp","Volotea","Autres"];
      const compagniesAll = Array.from(compSet);
      const compagniesOrdered = desiredOrder
        .filter(c => compSet.has(c))
        .concat(compagniesAll.filter(c => !desiredOrder.includes(c)).sort());

      const datasets = compagniesOrdered.map(comp => ({
        type: (period === "day" ? "line" : "bar"),
        label: comp,
        data: labels.map(pk => agg[comp]?.[pk] || 0),
        borderWidth: 2,
        fill: false,    
        borderColor: palette[comp] || "rgb(120,120,120)",
        backgroundColor: (period === "day")
              ? toRGBA(palette[comp] || "rgb(120,120,120)", 0.25)
              : toRGBA(palette[comp] || "rgb(120,120,120)", 0.85),
        stack: (period === "day" ? undefined : "stackAir")
      }));

      if (period !== "day") {
        datasets.forEach(ds => {
          const sum = Array.isArray(ds.data)
            ? ds.data.reduce((s, v) => s + (Number(v) || 0), 0)
            : 0;
          ds.order = sum;
        });
      }
  
      if (chartAirlinesInstance) chartAirlinesInstance.destroy();
      chartAirlinesInstance = new Chart(document.getElementById("chartAirlines"),{
        type: (period === "day" ? "line" : "bar"),
        data:{ labels, datasets },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                sort: (a, b) => {
                  const order = { "Ryanair":0, "Wizz Air":1, "HiSky":2, "SkyUp":3, "Volotea":4, "Autres":5 };
                  const ia = (a?.text in order) ? order[a.text] : 999;
                  const ib = (b?.text in order) ? order[b.text] : 999;
                  if (ia !== ib) return ia - ib;
                  return String(a.text).localeCompare(String(b.text));
                },
                generateLabels: (chart) => {
                  const base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                  const order = { "Ryanair":0, "Wizz Air":1, "HiSky":2, "SkyUp":3, "Volotea":4, "Autres":5 };
                  base.sort((a, b) => {
                    const ia = (a?.text in order) ? order[a.text] : 999;
                    const ib = (b?.text in order) ? order[b.text] : 999;
                    if (ia !== ib) return ia - ib;
                    return String(a.text).localeCompare(String(b.text));
                  });
                  return base;
                }
              }
            },
            zoom: {
              pan:  { enabled: true, mode: 'x' },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
            },
            tooltip: {
              itemSort: (a, b) => {
                const va = (a.parsed && typeof a.parsed.y === 'number') ? a.parsed.y : 0;
                const vb = (b.parsed && typeof b.parsed.y === 'number') ? b.parsed.y : 0;
                if (vb === va) return 0;
                return vb - va;
              },
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y ?? 0;
                  const idx = ctx.dataIndex;
                  const stackKey = ctx.dataset.stack;
                  const ds = ctx.chart.data.datasets || [];

                  let totalAtIndex = 0;
                  ds.forEach(dset => {
                    const sameScope = stackKey ? (dset.stack === stackKey) : true;
                    if (!sameScope || !Array.isArray(dset.data)) return;

                    const rawVal = dset.data[idx];
                    const num = (typeof rawVal === 'number')
                      ? rawVal
                      : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                    if (!isNaN(num)) totalAtIndex += num;
                  });

                  const pct = totalAtIndex > 0 ? (v / totalAtIndex) * 100 : 0;
                  const pctStr = pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

                  return `${ctx.dataset.label} : ${Math.round(v).toLocaleString('fr-FR')} t éq CO₂ ; soit ${pctStr} %`;
                },
                footer: (items) => {
                  if (!items?.length) return '';
                  const idx = items[0].dataIndex;
                  const stackKey = items[0].dataset.stack;
                  const ds = items[0].chart.data.datasets || [];

                  let totalAtIndex = 0;
                  ds.forEach(dset => {
                    const sameScope = stackKey ? (dset.stack === stackKey) : true;
                    if (!sameScope || !Array.isArray(dset.data)) return;

                    const rawVal = dset.data[idx];
                    const num = (typeof rawVal === 'number')
                      ? rawVal
                      : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                    if (!isNaN(num)) totalAtIndex += num;
                  });

                  return `Total : ${Math.round(totalAtIndex).toLocaleString('fr-FR')} t éq CO₂`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: (period === "day" ? "Date" : (period === "week" ? "Semaine (ISO)" : "Mois"))
              }
            },
            y: {
              beginAtZero: true,
              stacked: (period !== "day"),
              title: { display: true, text: "Emissions de gaz à effet de serre (en t éq CO₂)" }
            }
          }
        }
      });
    }     

    const airlinesPeriod = ensurePeriodControls("chartAirlines", (p) => buildChartAirlines(p, data));
    buildChartAirlines(airlinesPeriod, data);
  });

  /* ====== 4. Rotations par compagnie ====== */
  parseCSV('./data/EXPORT_daily_airlines.csv', (data) => {
    let chartRotationsInstance = null;

    function buildChartRotations(period, data) {
      const labelsSet = new Set();
      const compSet = new Set();
      const agg = {};

      data.forEach(r => {
        const comp = r.compagnie;
        const pkey = makePeriodKey(r.date, period);
        compSet.add(comp);
        labelsSet.add(pkey);
        if (!agg[comp]) agg[comp] = {};
        let v = r.rotations ? parseFloat(String(r.rotations).replace(',', '.')) : 0;
        if (isNaN(v)) v = 0;
        agg[comp][pkey] = (agg[comp][pkey] || 0) + v;
      });

      const labels = sortPeriodKeys(Array.from(labelsSet), period);

      const palette = {
        "Ryanair":  "rgb(223,186,47)",
        "Wizz Air": "rgb(225,14,73)",
        "HiSky":    "rgb(19,62,103)",
        "SkyUp":    "rgb(255,58,32)",
        "Volotea":  "rgb(0,0,0)",
        "Autres":   "rgb(127,127,127)"
      };

      const desiredOrder = ["Ryanair","Wizz Air","HiSky","SkyUp","Volotea","Autres"];
      const compagniesAll = Array.from(compSet);
      const compagniesOrdered = desiredOrder
        .filter(c => compSet.has(c))
        .concat(compagniesAll.filter(c => !desiredOrder.includes(c)).sort());

      const datasets = compagniesOrdered.map(comp => ({
        type: (period === "day" ? "line" : "bar"),
        label: comp,
        data: labels.map(pk => agg[comp]?.[pk] || 0),
        borderWidth: 2,
        fill: false,
        borderColor: palette[comp] || "rgb(120,120,120)",
        backgroundColor: (period === "day")
               ? toRGBA(palette[comp] || "rgb(120,120,120)", 0.25)
               : toRGBA(palette[comp] || "rgb(120,120,120)", 0.85),
        stack: (period === "day" ? undefined : "stackRot")
      }));

      if (period !== "day") {
        datasets.forEach(ds => {
          const sum = Array.isArray(ds.data)
            ? ds.data.reduce((s, v) => s + (Number(v) || 0), 0)
            : 0;
          ds.order = sum;
        });
      }
   
      if (chartRotationsInstance) chartRotationsInstance.destroy();
      chartRotationsInstance = new Chart(document.getElementById("chartRotations"),{
        type: (period === "day" ? "line" : "bar"),
        data:{ labels, datasets },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                sort: (a, b) => {
                  const order = { "Ryanair":0, "Wizz Air":1, "HiSky":2, "SkyUp":3, "Volotea":4, "Autres":5 };
                  const ia = (a?.text in order) ? order[a.text] : 999;
                  const ib = (b?.text in order) ? order[b.text] : 999;
                  if (ia !== ib) return ia - ib;
                  return String(a.text).localeCompare(String(b.text));
                },
                generateLabels: (chart) => {
                  const base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                  const order = { "Ryanair":0, "Wizz Air":1, "HiSky":2, "SkyUp":3, "Volotea":4, "Autres":5 };
                  base.sort((a, b) => {
                    const ia = (a?.text in order) ? order[a.text] : 999;
                    const ib = (b?.text in order) ? order[b.text] : 999;
                    if (ia !== ib) return ia - ib;
                    return String(a.text).localeCompare(String(b.text));
                  });
                  return base;
                }
              }
            },
            tooltip: {
              itemSort: (a, b) => {
                const va = (a.parsed && typeof a.parsed.y === 'number') ? a.parsed.y : 0;
                const vb = (b.parsed && typeof b.parsed.y === 'number') ? b.parsed.y : 0;
                if (vb === va) return 0;
                return vb - va;
              },
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y ?? 0;
                  const idx = ctx.dataIndex;
                  const stackKey = ctx.dataset.stack;
                  const datasets = ctx.chart.data.datasets || [];

                  let totalAtIndex = 0;
                  datasets.forEach(ds => {
                    if (!Array.isArray(ds.data)) return;
                    const sameScope = stackKey ? (ds.stack === stackKey) : true;
                    if (!sameScope) return;

                    const rawVal = ds.data[idx];
                    const num = (typeof rawVal === 'number')
                      ? rawVal
                      : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                    if (!isNaN(num)) totalAtIndex += num;
                  });

                  const pct = totalAtIndex > 0 ? (v / totalAtIndex) * 100 : 0;
                  const pctStr = pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

                  return `${ctx.dataset.label} : ${Math.round(v).toLocaleString('fr-FR')} rotations ; soit ${pctStr} %`;
                },
                footer: (items) => {
                  if (!items?.length) return '';
                  const idx = items[0].dataIndex;
                  const stackKey = items[0].dataset.stack;
                  const datasets = items[0].chart.data.datasets || [];

                  let totalAtIndex = 0;
                  datasets.forEach(ds => {
                    if (!Array.isArray(ds.data)) return;
                    const sameScope = stackKey ? (ds.stack === stackKey) : true;
                    if (!sameScope) return;

                    const rawVal = ds.data[idx];
                    const num = (typeof rawVal === 'number')
                      ? rawVal
                      : (rawVal && typeof rawVal.y === 'number' ? rawVal.y : 0);
                    if (!isNaN(num)) totalAtIndex += num;
                  });

                  return `Total : ${Math.round(totalAtIndex).toLocaleString('fr-FR')} rotations`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: (period === "day" ? "Date" : (period === "week" ? "Semaine (ISO)" : "Mois"))
              }
            },
            y: {
              beginAtZero: true,
              stacked: (period !== "day"),
              title: { display: true, text: "Nombre de rotations" }
            }
          }
        }
      });
    }

    const rotationsPeriod = ensurePeriodControls("chartRotations", (p) => buildChartRotations(p, data));
    buildChartRotations(rotationsPeriod, data);
  });

  /* ====== 5. Emissions par destination (Départs + Arrivées) ====== */
  parseCSV('./data/EXPORT_departures_YTD.csv', function (departures) {
    parseCSV('./data/EXPORT_arrivals_YTD.csv', function (arrivals) {

      const destinationMap = {};
      let totalEmissions = 0;
      let totalVols = 0; 

      const toNum = (x) => {
        const n = parseFloat(String(x).replace(',', '.'));
        return isNaN(n) ? 0 : n;
      };

      function addAgg(dest, emission) {
        const key = dest && String(dest).trim() ? String(dest).trim() : "Inconnue";
        if (!destinationMap[key]) destinationMap[key] = { emission: 0, vols: 0 };
        destinationMap[key].emission += emission;
        destinationMap[key].vols += 1;
        totalEmissions += emission;
        totalVols += 1;
      }

      departures.forEach(row => addAgg(row.destination, toNum(row.emissions)));
      arrivals.forEach(row => addAgg(row.origine, toNum(row.emissions)));

      (function ensureSortControls(){
        const canvas = document.getElementById("chartDestination");
        if (!canvas) return;
        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.alignItems = "center";
        controls.style.gap = "8px";
        controls.style.margin = "6px 0 4px 0";

        const strong = document.createElement("strong");
        strong.textContent = "Trier par :";
        const btnEmi = document.createElement("button");
        const btnVols = document.createElement("button");
        btnEmi.textContent = "Émissions";
        btnVols.textContent = "Vols";

        [btnEmi, btnVols].forEach(b => {
          b.style.padding = "6px 10px";
          b.style.border = "1px solid #cbd5e1";
          b.style.borderRadius = "6px";
          b.style.background = "#f8fafc";
          b.style.cursor = "pointer";
        });

        controls.appendChild(strong);
        controls.appendChild(btnEmi);
        controls.appendChild(btnVols);
        canvas.parentElement.insertBefore(controls, canvas);

        canvas._sortBtns = { btnEmi, btnVols };
      })();

      let sortKey = "emission";
      let chartDest = null;

      function buildDestinationChart() {
        const destinationArray = Object.keys(destinationMap).map(dest => ({
          destination: dest,
          emission: destinationMap[dest].emission,
          vols: destinationMap[dest].vols
        }));
        destinationArray.sort((a, b) => b[sortKey] - a[sortKey]);

        const filteredDestinations = [];
        let cumulative = 0;
        let otherEmission = 0;
        let otherVols = 0;
        let otherCount = 0;

        destinationArray.forEach(item => {
          if (filteredDestinations.length < 50 && (totalEmissions === 0 ? 0 : (cumulative / totalEmissions)) < 0.90) {
            filteredDestinations.push(item);
            cumulative += item.emission;
          } else {
            otherEmission += item.emission;
            otherVols += item.vols;
            otherCount++;
          }
        });

        if (otherEmission > 0 || otherVols > 0) {
          filteredDestinations.push({
            destination: `Autres (${otherCount} destinations)`,
            emission: otherEmission,
            vols: otherVols
          });
        }

        const labels = filteredDestinations.map(d => d.destination);
        const valuesEmissions = filteredDestinations.map(d => Math.round(d.emission * 10) / 10);
        const valuesVols = filteredDestinations.map(d => d.vols);

        const ctx = document.getElementById("chartDestination");
        if (chartDest) chartDest.destroy();

        chartDest = new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: displayName("emissions"),
                data: valuesEmissions,
                yAxisID: "y",
                backgroundColor: "rgba(31, 60, 136, 0.25)",
                borderColor: "#1f3c88",
                borderWidth: 1,
                maxBarThickness: 28
              },
              {
                type: "line",
                label: "Nombre de mouvements",
                data: valuesVols,
                yAxisID: "y1",
                borderColor: "#d62728",
                backgroundColor: "rgba(214, 39, 40, 0.15)",
                borderWidth: 2,
                pointRadius: 2,
                tension: 0.2,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: true },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    const i = context.dataIndex;
                    const item = filteredDestinations[i] || { emission: 0, vols: 0 };

                    if (context.dataset.yAxisID === "y") {
                      const value = item.emission || 0;
                      const percent = totalEmissions > 0 ? ((value / totalEmissions) * 100).toFixed(1) : 0;
                      const avg = item.vols > 0 ? (item.emission / item.vols) : 0;
                      const avgStr = avg.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      const valueRounded = Math.round(value).toLocaleString('fr-FR');
                      return [
                        `${context.dataset.label} : ${valueRounded} t éq CO₂ (${percent} %)`,
                        `Moyenne par vol : ${avgStr} t éq CO₂`
                      ];
                    } else {
                      const vols = item.vols || 0;
                      const percentVol = totalVols > 0 ? ((vols / totalVols) * 100).toFixed(1) : 0;
                      return [
                        `${context.dataset.label} : ${vols.toLocaleString('fr-FR')} vols`,
                        `Part des vols : ${percentVol} %`
                      ];
                    }
                  }
                }
              }
            },
            scales: {
              x: { ticks: { maxRotation: 90, minRotation: 45 } },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Emissions de gaz à effet de serre (en t éq CO₂)" }
              },
              y1: {
                beginAtZero: true,
                position: "right",
                grid: { drawOnChartArea: false },
                title: { display: true, text: "Nombre de vols (cumul depuis le 1er janvier)" },
                ticks: {
                  stepSize: 1,
                  callback: (v) => Number.isInteger(v) ? v : ""
                }
              }
            }
          }
        });
      }

      const btns = document.getElementById("chartDestination")._sortBtns || {};
      btns.btnEmi?.addEventListener("click", () => { sortKey = "emission"; buildDestinationChart(); });
      btns.btnVols?.addEventListener("click", () => { sortKey = "vols"; buildDestinationChart(); });

      buildDestinationChart();
    }); // arrivals
  });   // departures

  /* ====== 6 & 7. TABLE DATA PRO ====== */
  function createTable(containerId, data){
    if(!data || data.length === 0){
      document.getElementById(containerId).innerHTML = "<p>Aucune donnée disponible</p>";
      return;
    }

    const container = document.getElementById(containerId);
    const headers = Object.keys(data[0]);
    let activeFilters = {};
    let sortDirection = 1;
    let currentPage = 1;
    const rowsPerPage = 200;
    let filteredData = [...data];
    let debounceTimer;

    function formatDistance(value){
      const n = parseFloat(String(value).replace(',','.'));
      if(isNaN(n)) return value;
      return Math.round(n).toLocaleString('fr-FR');
    }
    function formatEmission(value){
      const n = parseFloat(String(value).replace(',','.'));
      if(isNaN(n)) return value;
      return n.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 });
    }
    function formatDateFR(value){
      if(!value) return "";
      const d = new Date(value);
      if(isNaN(d)) return value;
      const str = d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' });
      return str.charAt(0).toUpperCase()+str.slice(1);
    }
    function formatValue(header,value){
      const lower = header.toLowerCase();
      if(lower.includes("date")) return formatDateFR(value);
      if(lower.includes("distance")) return formatDistance(value);
      if(lower.includes("emission")) return formatEmission(value);
      return value;
    }

    let html = "";
    html += '<div style="margin-bottom:10px; display:flex; justify-content:space-between;">';
    html += '<div><strong id="'+containerId+'-count"></strong> vols affichés</div>';
    html += '<div>';
    html += '<button id="'+containerId+'-reset">Réinitialiser</button> ';
    html += '<button id="'+containerId+'-export">Exporter</button>';
    html += '</div></div>';

    html += '<div class="table-wrapper">';
    html += '<table class="data-table"><thead>';

    html += '<tr>';
    headers.forEach((h,i) => {
      const label = displayName(h);
      html += '<th class="'+(i===0?'sticky-col':'')+' filtered-header" data-header="'+h+'">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
      html += '<span>'+label+'</span>';
      html += '<span class="col-menu" data-col="'+h+'" style="cursor:pointer;">⋮</span>';
      html += '</div></th>';
    });
    html += '</tr>';

    html += '<tr>';
    headers.forEach((h,i) => {
      html += '<th class="'+(i===0?'sticky-col':'')+'">';
      html += '<div style="position:relative;">';
      html += '<input type="text" data-filter="'+h+'" placeholder="Filtrer ‘'+displayName(h)+'’..." style="width:100%">';
      html += '<span class="clear-filter" data-clear="'+h+'" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); cursor:pointer;">✕</span>';
      html += '</div></th>';
    });
    html += '</tr></thead><tbody>';

    html += '<tr class="total-row"></tr>';
    html += '</tbody></table></div>';

    html += '<div style="margin-top:10px; text-align:center;">';
    html += '<button id="'+containerId+'-prev">◀</button> ';
    html += '<span id="'+containerId+'-page"></span>';
    html += ' <button id="'+containerId+'-next">▶</button>';
    html += '</div>';

    container.innerHTML = html;

    // Export CSV table
    const exportBtn = document.getElementById(containerId + "-export");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        const rows = [];
        rows.push(headers.map(h => displayName(h)).join(";"));
        const dataToExport = filteredData.length ? filteredData : data;
        dataToExport.forEach(rowObj => {
          const row = headers.map(h => {
            let val = (rowObj[h] ?? "").toString();
            val = val.replace(/;/g, ",");
            return val;
          });
          rows.push(row.join(";"));
        });
        const csvContent = "\uFEFF" + rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const fileBase =
          containerId === "tableDepartures" ? "vols_depart" :
          containerId === "tableArrivals"  ? "vols_arrivee" : containerId;
        a.download = fileBase + "_export.csv";
        a.click();
      });
    }
   
    const tbody = container.querySelector("tbody");
    const totalRow = tbody.querySelector(".total-row");

    function renderTable(){
      tbody.querySelectorAll("tr:not(.total-row)").forEach(tr => tr.remove());

      const start = (currentPage-1)*rowsPerPage;
      const end = start + rowsPerPage;
      const pageData = filteredData.slice(start,end);

      pageData.forEach(row => {
        const tr = document.createElement("tr");
        headers.forEach(h => {
          const td = document.createElement("td");
          if(h.toLowerCase().includes("date") ||
             h.toLowerCase().includes("distance") ||
             h.toLowerCase().includes("emission")){
            td.className="center";
          }
          td.innerText = formatValue(h, row[h] || "");
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      updateTotal();
      updateCount();
      updatePagination();
      updateBadges();
    }

    function applyFilters(){
      filteredData = data.filter(row =>
        headers.every(h => {
          if(!activeFilters[h]) return true;
          const value = String(row[h]||"").toLowerCase();
          return value.includes(activeFilters[h].toLowerCase());
        })
      );
      currentPage = 1;
      renderTable();
    }

    function updateTotal(){
      const sourceData = (Object.keys(activeFilters).length===0) ? data : filteredData;
      let total = 0;

      sourceData.forEach(row => {
        headers.forEach(h => {
          if(h.toLowerCase().includes("emission")){
            const n = parseFloat(String(row[h]).replace(',','.'));
            if(!isNaN(n)) total += n;
          }
        });
      });

      totalRow.innerHTML = "";
      headers.forEach((h,i) => {
        const td = document.createElement("td");
        if(i===0){
          td.innerHTML = "<strong>TOTAL</strong>";
        } else if(h.toLowerCase().includes("emission")){
          td.className = "center";
          td.innerHTML = "<strong>"+total.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 })+"</strong>";
        }
        totalRow.appendChild(td);
      });
    }

    function updatePagination(){
      const totalPages = Math.ceil(filteredData.length / rowsPerPage);
      container.querySelector("#"+containerId+"-page").innerText = "Page "+currentPage+" / "+totalPages;

      document.getElementById(containerId+"-prev").onclick = function(){
        if(currentPage > 1){ currentPage--; renderTable(); }
      };
      document.getElementById(containerId+"-next").onclick = function(){
        if(currentPage < totalPages){ currentPage++; renderTable(); }
      };
    }

    function updateCount(){
      container.querySelector("#"+containerId+"-count").innerText = filteredData.length.toLocaleString('fr-FR');
    }

    function updateBadges(){
      container.querySelectorAll(".filtered-header").forEach(th => {
        const header = th.getAttribute("data-header");
        if(activeFilters[header]) th.classList.add("filtered"); else th.classList.remove("filtered");
      });
    }

    container.querySelectorAll(".col-menu").forEach(btn => {
      btn.addEventListener("click", function(e){
        e.stopPropagation();

        const col = btn.getAttribute("data-col");
        const index = headers.indexOf(col);

        const old = document.querySelector(".column-menu");
        if(old) old.remove();

        const menu = document.createElement("div");
        menu.className="column-menu";
        menu.style.position="fixed";
        menu.style.background="#fff";
        menu.style.border="1px solid #ccc";
        menu.style.borderRadius="8px";
        menu.style.boxShadow="0 8px 20px rgba(0,0,0,0.15)";
        menu.style.padding="6px 0";
        menu.style.zIndex="99999";

        const rect = btn.getBoundingClientRect();
        menu.style.left = rect.left+"px";
        menu.style.top  = rect.bottom+"px";

        function addItem(label, action){
          const item=document.createElement("div");
          item.innerText=label;
          item.style.padding="8px 14px";
          item.style.cursor="pointer";
          item.addEventListener("click",function(){ action(); menu.remove(); });
          menu.appendChild(item);
        }

        addItem("Tri ascendant", function(){ sortDirection=1; sortColumn(index); });
        addItem("Tri descendant", function(){ sortDirection=-1; sortColumn(index); });
        addItem("Effacer le filtre", function(){
          delete activeFilters[col];
          container.querySelector('[data-filter="'+col+'"]').value="";
          applyFilters();
        });

        document.body.appendChild(menu);
        document.addEventListener("click", function(){ menu.remove(); }, {once:true});
      });
    });

    function sortColumn(index){
      filteredData.sort((a,b) => {
        const A=a[headers[index]];
        const B=b[headers[index]];
        const numA=parseFloat(String(A).replace(',','.'));
        const numB=parseFloat(String(B).replace(',','.'));
        if(!isNaN(numA) && !isNaN(numB)) return (numA-numB)*sortDirection;
        return String(A).localeCompare(String(B))*sortDirection;
      });
      renderTable();
    }

    container.querySelectorAll("[data-filter]").forEach(input => {
      input.addEventListener("input", function(){
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function(){
          const col=input.getAttribute("data-filter");
          activeFilters[col]=input.value.trim();
          if(!activeFilters[col]) delete activeFilters[col];
          applyFilters();
        },300);
      });
    });

    container.querySelectorAll(".clear-filter").forEach(btn => {
      btn.addEventListener("click", function(e){
        e.stopPropagation();
        const col = btn.getAttribute("data-clear");
        const input = container.querySelector('[data-filter="'+col+'"]');
        input.value="";
        delete activeFilters[col];
        clearTimeout(debounceTimer);
        applyFilters();
      });
    });

    document.getElementById(containerId+"-reset").addEventListener("click",function(){
      activeFilters={};
      container.querySelectorAll("[data-filter]").forEach(i => i.value="");
      const dateIndex = headers.findIndex(h => h.toLowerCase().includes("date"));
      if(dateIndex!==-1){
        data.sort((a,b) => new Date(b[headers[dateIndex]]) - new Date(a[headers[dateIndex]]));
      }
      filteredData=[...data];
      currentPage=1;
      renderTable();
    });

    renderTable();
  }

  const style = document.createElement("style");
  style.innerHTML = `
  .filtered { background:#e6f2ff !important; position:relative; }
  .filtered::after{ content:""; width:8px; height:8px; background:#007bff; border-radius:50%; position:absolute; top:6px; right:6px; }
  `;
  document.head.appendChild(style);

  parseCSV('./data/EXPORT_departures_YTD.csv', function(data){
    createTable("tableDepartures", data);
  });
  parseCSV('./data/EXPORT_arrivals_YTD.csv', function(data){
    createTable("tableArrivals", data);
  });

}); // DOMContentLoaded


//<!-- ========== JS : Mise à jour "dernière mise à jour" + sidebar + alignement containers ========== -->//

// Date de mise à jour
fetch("data/EXPORT_update_time.csv")
.then(response => response.text())
.then(text => {
  const lines = text.trim().split(/\r?\n/);
  const data = lines[1].split(",");
  const date = data[0].trim();
  const time = data[1].trim();
  const d = new Date(date + "T" + time);
  if(!isNaN(d)){
    const formatted =
      d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}) +
      " à " +
      d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    document.getElementById("update-date").innerHTML = "dernière mise à jour le " + formatted;
  } else {
    document.getElementById("update-date").innerHTML = "date de mise à jour indisponible";
  }
})
.catch(() => {
  document.getElementById("update-date").innerHTML = "date de mise à jour indisponible";
});

/***** === Alignement de taille : container KPIs = container Analyse 2026 === *****/
function matchContainerSizeOnce() {
  const target = document.querySelector('[data-match-size]');
  if (!target) return;

  const refSelector = target.getAttribute('data-match-size');
  if (!refSelector) return;

  const ref = document.querySelector(refSelector);
  if (!ref) return;

  const rect = ref.getBoundingClientRect();

  // Calque la width/height sur la carte de référence
  target.style.width  = rect.width + 'px';
  target.style.height = rect.height + 'px';

  // Ajuste la chart-host pour occuper le maximum d'espace vertical restant
  const chartHost = target.querySelector('.chart-host');
  if (chartHost) {
    const headers = Array.from(target.querySelectorAll('.metric-title,.metric-header'));
    const headerHeights = headers.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
    const paddings = parseFloat(getComputedStyle(target).paddingTop || '0')
                   + parseFloat(getComputedStyle(target).paddingBottom || '0');
    const available = rect.height - headerHeights - paddings - 40;
    if (available > 220) {
      chartHost.style.height = available + 'px';
    }
  }

  if (window._kpiS12AeroGrouped && typeof window._kpiS12AeroGrouped.resize === 'function') {
    window._kpiS12AeroGrouped.resize();
  }
}   

/* ===== RESET ZOOM GRAPHIQUE ===== */
function resetZoomChart(canvasId) {
    const chart = Chart.getChart(canvasId);
    if(chart) chart.resetZoom();
}


