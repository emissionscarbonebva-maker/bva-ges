import { initDailyScopes } from "./charts/dailyScopes.js";
import { initCumulScopes } from "./charts/cumulScopes.js";
import { initTotalCumul } from "./charts/totalCumul.js";
import { initScopesDonut } from "./charts/scopesDonut.js";
import { initDestination } from "./charts/destination.js";

import { parseCSV } from "./core/csvParser.js";
import { createTable } from "./core/tableBuilder.js";

document.addEventListener("DOMContentLoaded", () => {

initDailyScopes();
initCumulScopes();
initTotalCumul();
initScopesDonut();
initDestination();

/* tables */

parseCSV("./data/EXPORT_departures_YTD.csv", data => {
createTable("tableDepartures", data);
});

parseCSV("./data/EXPORT_arrivals_YTD.csv", data => {
createTable("tableArrivals", data);
});

});
