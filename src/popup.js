// a mapping of tab IDs to request details object lives in chrome.storage.local
// this function helps generate the key for it
// NOTE: this is duplicated in background.js
// TODO: switch to message passing to keep this in one place
const getStorageKeyForTab = (tabId) => {
  return `tab-request-details-${tabId}`;
};

function getTitle() {
  return document.title;
}

const getProtocolVersion = () => {
  if (performance && performance.getEntriesByType) {
    let entry = performance.getEntriesByType("navigation")[0];
    let protocol = entry && entry.nextHopProtocol;

    return protocol;
  }
};

let servedByCloudflare;
let protocolVersion;

// get the current tab's ID and extract request info
// from the extension object
const queryInfo = {
  active: true,
  windowId: chrome.windows.WINDOW_ID_CURRENT,
};
chrome.tabs.query(queryInfo, async (tabs) => {
  console.log(tabs);
  const tabId = tabs[0].id;
  const storageKey = getStorageKeyForTab(tabId);
  const storedValue = await chrome.storage.local.get(storageKey);
  const requestInfo = storedValue[storageKey];

  document.getElementById("additionalWebsiteInfo").innerHTML =
    `<div>IP Address: ${requestInfo.ipAddress}</div>`;
  if (requestInfo.servedByCloudflare) {
    document.getElementById("cloudflareOrNot").style.borderBottomColor =
      "#E7883B";
    document.getElementById("notUsingCloudflare").style.display = "none";
    document.getElementById("greyCloud").style.display = "none";
    const [rayId, dataCenterCode] =
      requestInfo.cloudflareRayHeaderValue.split("-");
    const traceUrl = new URL(requestInfo.url);
    traceUrl.pathname = "/cdn-cgi/trace";

    document.getElementById("cloudflareInfo").innerHTML =
      `<div>Ray ID: ${rayId}</div><div>Data Center: ${dataCenterCode}</div><div><a href="${traceUrl.toString()}" target="_blank">Trace</a></div>`;
  } else {
    document.getElementById("usingCloudflare").style.display = "none";
    document.getElementById("orangeCloud").style.display = "none";
  }
  if (requestInfo.ipAddress.includes(".")) {
    document.getElementById("ipVersion").textContent = "4";
  } else if (requestInfo.ipAddress.includes(":")) {
    document.getElementById("ipVersion").textContent = "6";
  } else {
    document.getElementById("ipVersion").textContent = "?";
  }
  console.log(`in popup, request details for tab ${tabId}`, requestInfo);
  // document.getElementById("websiteInfo").textContent =
  //   JSON.stringify(requestInfo);
  chrome.scripting
    .executeScript({
      target: { tabId },
      func: getProtocolVersion,
    })
    .then((injectionResults) => {
      const injectionsResultsForMainFrame = injectionResults[0];
      console.log(
        `popup scripting result for tab ${tabId} is`,
        injectionsResultsForMainFrame,
      );
      const protocolVersion = injectionsResultsForMainFrame["result"];
      document.getElementById("httpProtocolVersion").textContent =
        protocolVersion;
    });
});
