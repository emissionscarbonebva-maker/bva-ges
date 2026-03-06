import { initDailyScopes } from "./charts/dailyScopes.js";
import { initCumulScopes } from "./charts/cumulScopes.js";
import { initTotalCumul } from "./charts/totalCumul.js";
import { initAirlinesEmissions } from "./charts/airlinesEmissions.js";
import { initAirlinesRotations } from "./charts/airlinesRotations.js";
import { initDestinationEmissions } from "./charts/destinationEmissions.js";

import { parseCSV } from "./core/csvParser.js";
import { createTable } from "./core/tableBuilder.js";

document.addEventListener("DOMContentLoaded", () => {

initDailyScopes();
initCumulScopes();
initTotalCumul();
initAirlinesEmissions();
initAirlinesRotations();
initDestinationEmissions();

/* tables */

parseCSV("./data/EXPORT_departures_YTD.csv", data=>{
createTable("tableDepartures", data);
});

parseCSV("./data/EXPORT_arrivals_YTD.csv", data=>{
createTable("tableArrivals", data);
});

});
